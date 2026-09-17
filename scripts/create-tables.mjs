/**
 * Phase 0 — create the new DynamoDB tables for the Agent Hub. Run ONCE, with
 * AWS credentials that can create tables (your personal admin creds, NOT the
 * scoped `agent-ledger-app` user, which is Get/Put/Query/Scan only).
 *
 *   cd app
 *   AWS_REGION=eu-north-1 AWS_PROFILE=<admin> node scripts/create-tables.mjs
 *   # or: AWS_REGION=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... node scripts/create-tables.mjs
 *
 * Idempotent — a table that already exists is skipped. Nothing is deleted or
 * altered. All tables are PAY_PER_REQUEST, matching the existing four.
 *
 * After it finishes, add the table names to .env.local / Amplify env and wire
 * them into src/lib/store/dynamo-client.ts (Phase 1).
 */
import {
  CreateTableCommand,
  DynamoDBClient,
  DescribeTableCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION || "eu-north-1";
const client = new DynamoDBClient({ region });

/** [attrName, "S" | "N"] for every key attribute referenced below. */
const S = "S";

const TABLES = [
  {
    // Renamed from agent-ledger-ledger-entries. After this runs, re-import
    // (scripts/import-weiser.mjs --write) and delete the old table.
    name: "agent-ledger-agent-account",
    attrs: { id: S, agentId: S },
    gsis: [["byAgentId", "agentId"]],
  },
  {
    // The office's agent directory — canonical identity store (Phase 4),
    // replacing per-request reads of Daf Kesher. Populate with
    // scripts/import-agents-from-monday.mjs. email/phone GSIs back the login
    // lookup; an item with no email/phone is simply absent from that index.
    name: "agent-ledger-agents",
    attrs: { id: S, officeId: S, email: S, phone: S },
    gsis: [
      ["byOfficeId", "officeId"],
      ["byEmail", "email"],
      ["byPhone", "phone"],
    ],
  },
  {
    name: "agent-ledger-signed-contracts",
    attrs: { id: S, agentId: S },
    gsis: [["byAgentId", "agentId"]],
  },
  {
    name: "agent-ledger-properties",
    attrs: { id: S, agentId: S },
    gsis: [["byAgentId", "agentId"]],
  },
  {
    name: "agent-ledger-offers",
    attrs: { id: S, agentId: S },
    gsis: [["byAgentId", "agentId"]],
  },
  {
    // Agent-to-agent lead handoffs (Phase 9), replacing the Monday
    // "Referrals" board. byOfficeId added when this feature was built —
    // if the table was already created before then, run this script again
    // (idempotent) and separately add the byOfficeId GSI via an UpdateTable
    // migration (see scripts/add-office-gsis.mjs for the precedent); a
    // CreateTableCommand only applies to a table that doesn't exist yet.
    name: "agent-ledger-referrals",
    attrs: { id: S, dealId: S, officeId: S },
    gsis: [
      ["byDealId", "dealId"],
      ["byOfficeId", "officeId"],
    ],
  },
  {
    name: "agent-ledger-deal-notes",
    attrs: { id: S, dealId: S },
    gsis: [["byDealId", "dealId"]],
  },
  {
    name: "agent-ledger-gi-documents",
    attrs: { id: S, dealId: S, giClientId: S },
    gsis: [
      ["byDealId", "dealId"],
      ["byGiClientId", "giClientId"],
    ],
  },
  {
    // Per-agent standing monthly charges (דמי משרד / מדלן / פרמי). The monthly
    // cron reads these and writes `expense` rows into agent-account. Phase 6.
    name: "agent-ledger-recurring-expenses",
    attrs: { id: S, agentId: S, officeId: S },
    gsis: [
      ["byAgentId", "agentId"],
      ["byOfficeId", "officeId"],
    ],
  },
  {
    // Non-agent office costs (Phase 7): CC fees, עירייה, cleaning, pension,
    // loan, ad vendors. GSI is date-range queryable per office (the daily
    // report reads "this office, this date").
    name: "agent-ledger-office-expenses",
    attrs: { id: S, officeId: S, date: S },
    gsis: [["byOfficeId", "officeId", "date"]],
  },
  {
    // Bank statement lines, imported (not typed) — Phase 7 §2 + the cash-flow
    // reconciliation. Key is a fresh id per line; byOfficeId+date for the
    // daily report and for de-duping an import (reference+date+amount).
    name: "agent-ledger-bank-transactions",
    attrs: { id: S, officeId: S, date: S },
    gsis: [["byOfficeId", "officeId", "date"]],
  },
  {
    // One row per office per day — the settled end-of-day balance. Key is
    // deterministic (`${officeId}:${date}`) so re-importing a day overwrites
    // rather than duplicating; no GSI needed (always fetched by that id).
    name: "agent-ledger-bank-balances",
    attrs: { id: S },
    gsis: [],
  },
  {
    // Manual entry (Phase 7 §3): deals where the client pays RE/MAX Israel,
    // which issues the tax doc and remits to the office.
    name: "agent-ledger-remax-israel-receipts",
    attrs: { id: S, officeId: S, date: S },
    gsis: [["byOfficeId", "officeId", "date"]],
  },
];

function buildInput(t) {
  return {
    TableName: t.name,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: Object.entries(t.attrs).map(([name, type]) => ({
      AttributeName: name,
      AttributeType: type,
    })),
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    ...(t.gsis.length > 0
      ? {
          GlobalSecondaryIndexes: t.gsis.map(([indexName, hashAttr, rangeAttr]) => ({
            IndexName: indexName,
            KeySchema: [
              { AttributeName: hashAttr, KeyType: "HASH" },
              ...(rangeAttr ? [{ AttributeName: rangeAttr, KeyType: "RANGE" }] : []),
            ],
            Projection: { ProjectionType: "ALL" },
          })),
        }
      : {}),
  };
}

async function exists(name) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch (e) {
    if (e.name === "ResourceNotFoundException") return false;
    throw e;
  }
}

console.log(`region: ${region}\n`);
let created = 0;
let skipped = 0;

for (const t of TABLES) {
  process.stdout.write(`${t.name} ... `);
  if (await exists(t.name)) {
    console.log("already exists, skipped");
    skipped++;
    continue;
  }
  try {
    await client.send(new CreateTableCommand(buildInput(t)));
    await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName: t.name });
    console.log(
      `created  (key: id  ·  GSIs: ${t.gsis.map(([n]) => n).join(", ")})`,
    );
    created++;
  } catch (e) {
    console.log(`FAILED  ${e.name}: ${e.message}`);
  }
}

console.log(`\ndone — ${created} created, ${skipped} already existed`);
