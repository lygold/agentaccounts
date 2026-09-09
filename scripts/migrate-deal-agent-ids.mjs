/**
 * Phase 4 — repoint existing rows from a Daf Kesher pulse id to the new
 * `agents` table id. Deals/billing/income were imported before Phase 4 with
 * `agentId` = the Monday pulse id (e.g. David Weiser = "1593093187"); Phase 4
 * gives every agent a fresh `agt_<uuid>`, so those references need rewriting.
 *
 * Build the mapping from the `agents` table itself (mondayItemId -> id), then
 * rewrite `agentId` on every matching row in `agent-ledger-deals`. Billing and
 * income carry no agent reference (they key off dealId), so they're untouched.
 *
 *   cd app
 *   node --env-file=.env.local scripts/migrate-deal-agent-ids.mjs           # dry run
 *   node --env-file=.env.local scripts/migrate-deal-agent-ids.mjs --write   # apply
 *
 * Run AFTER import-agents-from-monday.mjs --write. Idempotent — a row whose
 * agentId is already an `agt_` id is left alone.
 *
 * NOTE: the old `agent-ledger-ledger-entries` table (67 Weiser rows) is NOT
 * handled here — re-run scripts/import-weiser.mjs against the new agent id to
 * repopulate `agent-ledger-agent-account`, then delete the old table.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const WRITE = process.argv.includes("--write");

const AGENTS = process.env.DYNAMODB_TABLE_AGENTS;
const DEALS = process.env.DYNAMODB_TABLE_DEALS;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!AGENTS || !DEALS || !region || !accessKeyId || !secretAccessKey) {
  console.error(
    "Missing env — run with:  node --env-file=.env.local scripts/migrate-deal-agent-ids.mjs",
  );
  process.exit(2);
}

const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, credentials: { accessKeyId, secretAccessKey } }),
);

async function scanAll(table, projection) {
  const out = [];
  let lastKey;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: table,
        ProjectionExpression: projection,
        ExclusiveStartKey: lastKey,
      }),
    );
    out.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

console.log(WRITE ? "MODE: write\n" : "MODE: dry run (pass --write to apply)\n");

// mondayItemId -> new agents-table id
const map = new Map();
for (const a of await scanAll(AGENTS, "id, mondayItemId")) {
  if (a.mondayItemId) map.set(String(a.mondayItemId), String(a.id));
}
console.log(`${map.size} agents with a mondayItemId\n`);

const deals = await scanAll(DEALS, "id, agentId, agentName");
let updated = 0;
let already = 0;
let unmatched = 0;

for (const d of deals) {
  const current = String(d.agentId);
  if (current.startsWith("agt_")) {
    already++;
    continue;
  }
  const next = map.get(current);
  if (!next) {
    unmatched++;
    console.log(`  ?  deal ${d.id}  agentId ${current} (${d.agentName}) — no agent row with that mondayItemId`);
    continue;
  }
  console.log(`  →  deal ${d.id}  ${current} → ${next}  (${d.agentName})`);
  if (WRITE) {
    await doc.send(
      new UpdateCommand({
        TableName: DEALS,
        Key: { id: d.id },
        UpdateExpression: "SET agentId = :new",
        ConditionExpression: "agentId = :old",
        ExpressionAttributeValues: { ":new": next, ":old": current },
      }),
    );
  }
  updated++;
}

console.log(
  `\n${WRITE ? "updated" : "would update"} ${updated} deal(s) · ${already} already migrated · ${unmatched} unmatched (${deals.length} total)`,
);
if (unmatched > 0) {
  console.log("unmatched rows: the agent isn't in the agents table yet — run import-agents-from-monday.mjs --write first");
}
