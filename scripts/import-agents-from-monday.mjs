/**
 * Phase 4 — one-time import of the Daf Kesher (Monday) agent roster into the
 * app's own `agent-ledger-agents` table. Each agent gets a fresh `agt_<uuid>`
 * id; the Monday pulse id is kept as `mondayItemId` for the migration bridge
 * and for scripts/migrate-deal-agent-ids.mjs.
 *
 *   cd app
 *   node --env-file=.env.local scripts/import-agents-from-monday.mjs            # dry run
 *   node --env-file=.env.local scripts/import-agents-from-monday.mjs --write    # apply
 *   node --env-file=.env.local scripts/import-agents-from-monday.mjs --write --overwrite
 *
 * Idempotent: an agent whose `mondayItemId` already exists in the table is
 * skipped, unless --overwrite (which replaces the row but KEEPS its existing
 * `agt_` id, so downstream references stay valid).
 *
 * Requires: MONDAY_API_TOKEN, MONDAY_AGENTS_BOARD_ID, DYNAMODB_TABLE_AGENTS,
 * AWS_REGION + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, and optionally
 * OFFICE_ID (default "remax-jerusalem"), BOOTSTRAP_ADMIN_PHONE/EMAIL.
 */
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const WRITE = process.argv.includes("--write");
const OVERWRITE = process.argv.includes("--overwrite");

const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
const BOARD_ID = process.env.MONDAY_AGENTS_BOARD_ID;
const TABLE = process.env.DYNAMODB_TABLE_AGENTS;
const OFFICE_ID = process.env.OFFICE_ID || "remax-jerusalem";
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!MONDAY_TOKEN || !BOARD_ID) {
  console.error("Missing MONDAY_API_TOKEN / MONDAY_AGENTS_BOARD_ID");
  process.exit(2);
}
if (!TABLE || !region || !accessKeyId || !secretAccessKey) {
  console.error(
    "Missing DYNAMODB_TABLE_AGENTS / AWS_* — run with:  node --env-file=.env.local scripts/import-agents-from-monday.mjs",
  );
  process.exit(2);
}

// --- Daf Kesher column ids (mirror of src/lib/monday/columns.ts) -------------
const COL = {
  phone: "phone__1",
  email: "email__1",
  firstNameHebrew: "name__1",
  fullNameEnglish: "text_mm01ab4y",
  surname: "surname__1",
  status: "status__1",
  team: "numeric_mm0dwhxf",
  isTeamLeader: "color_mm1j9dvy",
};

function normalizePhone(raw) {
  if (!raw) return null;
  const c = raw.replace(/[\s\-().]/g, "");
  if (c.startsWith("+972")) return "0" + c.slice(4);
  if (c.startsWith("972")) return "0" + c.slice(3);
  return c || null;
}

async function mondayQuery(query, variables) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: MONDAY_TOKEN,
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error("Monday GraphQL: " + body.errors.map((e) => e.message).join("; "));
  }
  if (body.error_message) throw new Error("Monday API: " + body.error_message);
  return body.data;
}

async function fetchAllAgents() {
  const colIds = Object.values(COL).map((c) => `"${c}"`).join(",");
  const first = await mondayQuery(
    /* GraphQL */ `
      query($boardId: ID!) {
        boards(ids: [$boardId]) {
          items_page(limit: 100) {
            cursor
            items { id name column_values(ids: [${colIds}]) { id text value } }
          }
        }
      }
    `,
    { boardId: BOARD_ID },
  );
  const page = first.boards?.[0]?.items_page;
  if (!page) throw new Error("board not found or no items_page");
  let items = page.items;
  let cursor = page.cursor;
  while (cursor) {
    const next = await mondayQuery(
      /* GraphQL */ `
        query($cursor: String!) {
          next_items_page(cursor: $cursor, limit: 100) {
            cursor
            items { id name column_values(ids: [${colIds}]) { id text value } }
          }
        }
      `,
      { cursor },
    );
    items = items.concat(next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }
  return items;
}

const bootstrapPhone = normalizePhone(process.env.BOOTSTRAP_ADMIN_PHONE || "");
const bootstrapEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").toLowerCase() || null;

function resolveRole({ isTeamLeader, email, phone }) {
  // Daf Kesher's "app role" column never got created — role falls back to the
  // "Is Team Leader" flag, then "agent". The bootstrap allowlist can promote
  // to admin regardless. (Mirror of src/lib/auth/roles.ts.)
  if (bootstrapPhone && phone === bootstrapPhone) return "admin";
  if (bootstrapEmail && email === bootstrapEmail) return "admin";
  return isTeamLeader ? "team_leader" : "agent";
}

function text(cols, id) {
  const c = cols.find((x) => x.id === id);
  const t = c?.text?.trim();
  return t || null;
}

function mapAgent(item) {
  const cols = item.column_values;
  const email = text(cols, COL.email)?.toLowerCase() ?? null;
  const phone = normalizePhone(text(cols, COL.phone) ?? "");
  const teamText = text(cols, COL.team);
  const mondayStatus = text(cols, COL.status);
  const isTeamLeader = text(cols, COL.isTeamLeader) === "Yes";
  return {
    mondayItemId: String(item.id),
    name: item.name,
    email,
    phone,
    firstNameHebrew: text(cols, COL.firstNameHebrew),
    fullNameEnglish: text(cols, COL.fullNameEnglish),
    surname: text(cols, COL.surname),
    team: teamText ? Number(teamText) : null,
    isTeamLeader,
    role: resolveRole({ isTeamLeader, email, phone }),
    // Inactive / Offboarding on Daf Kesher → archived here (no login, hidden
    // from pickers), so the directory is still complete.
    status:
      mondayStatus === "Inactive" || mondayStatus === "Offboarding"
        ? "archived"
        : "active",
  };
}

// --- run -------------------------------------------------------------------
const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, credentials: { accessKeyId, secretAccessKey } }),
  { marshallOptions: { removeUndefinedValues: true } },
);

async function existingByMondayId() {
  const map = new Map();
  let lastKey;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: TABLE,
        ProjectionExpression: "id, mondayItemId, createdAt",
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const it of res.Items ?? []) {
      if (it.mondayItemId) {
        map.set(String(it.mondayItemId), {
          id: String(it.id),
          createdAt: it.createdAt ? String(it.createdAt) : now,
        });
      }
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return map;
}

console.log(`board ${BOARD_ID}  ·  office ${OFFICE_ID}  ·  table ${TABLE}`);
console.log(WRITE ? (OVERWRITE ? "MODE: write + overwrite\n" : "MODE: write\n") : "MODE: dry run (pass --write to apply)\n");

const now = new Date().toISOString();
const items = await fetchAllAgents();
const existing = await existingByMondayId();

let created = 0;
let overwritten = 0;
let skipped = 0;

for (const raw of items) {
  const a = mapAgent(raw);
  const prior = existing.get(a.mondayItemId);

  if (prior && !OVERWRITE) {
    skipped++;
    console.log(`  skip   ${a.name}  (already imported as ${prior.id})`);
    continue;
  }

  const id = prior?.id ?? `agt_${randomUUID()}`;
  const record = {
    id,
    officeId: OFFICE_ID,
    name: a.name,
    ...(a.email ? { email: a.email } : {}),
    ...(a.phone ? { phone: a.phone } : {}),
    firstNameHebrew: a.firstNameHebrew,
    fullNameEnglish: a.fullNameEnglish,
    surname: a.surname,
    team: a.team,
    isTeamLeader: a.isTeamLeader,
    role: a.role,
    status: a.status,
    mondayItemId: a.mondayItemId,
    createdAt: prior?.createdAt ?? now,
    updatedAt: now,
  };

  const tag = prior ? "over " : "new  ";
  console.log(
    `  ${tag}  ${a.name}  ·  ${a.role}${a.status === "archived" ? " (archived)" : ""}  ·  ${a.phone ?? a.email ?? "no contact"}  →  ${id}`,
  );

  if (WRITE) {
    await doc.send(new PutCommand({ TableName: TABLE, Item: record }));
    prior ? overwritten++ : created++;
  } else {
    prior ? overwritten++ : created++;
  }
}

console.log(
  `\n${WRITE ? "done" : "would"} — ${created} new, ${overwritten} overwritten, ${skipped} skipped (${items.length} on the board)`,
);
if (!WRITE) console.log("re-run with --write to apply");
