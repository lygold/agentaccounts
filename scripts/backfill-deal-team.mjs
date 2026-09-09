/**
 * Phase 4c — set `team` on every deal from the owning agent's current team.
 * Deals created before the agent picker (Phase 4c) have no `team`; the
 * team-leader scoping filter reads `deal.agentId` primarily, but keeping
 * `team` populated is cheap and future-proofs it.
 *
 *   cd app
 *   node --env-file=.env.local scripts/backfill-deal-team.mjs           # dry run
 *   node --env-file=.env.local scripts/backfill-deal-team.mjs --write   # apply
 *
 * Re-runnable — updates any deal whose `team` differs from the agent's.
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
  console.error("Missing env — run with:  node --env-file=.env.local scripts/backfill-deal-team.mjs");
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
      new ScanCommand({ TableName: table, ProjectionExpression: projection, ExclusiveStartKey: lastKey }),
    );
    out.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

console.log(WRITE ? "MODE: write\n" : "MODE: dry run (pass --write to apply)\n");

const teamById = new Map();
for (const a of await scanAll(AGENTS, "id, team")) {
  teamById.set(String(a.id), a.team ?? null);
}

const deals = await scanAll(DEALS, "id, agentId, agentName, team");
let updated = 0;
let same = 0;
let unmatched = 0;

for (const d of deals) {
  if (!teamById.has(String(d.agentId))) {
    unmatched++;
    console.log(`  ?  deal ${d.id}  agentId ${d.agentId} (${d.agentName}) not in agents table`);
    continue;
  }
  const want = teamById.get(String(d.agentId));
  const have = d.team ?? null;
  if (want === have) {
    same++;
    continue;
  }
  console.log(`  →  deal ${d.id}  team ${have ?? "∅"} → ${want ?? "∅"}  (${d.agentName})`);
  if (WRITE) {
    await doc.send(
      new UpdateCommand({
        TableName: DEALS,
        Key: { id: d.id },
        UpdateExpression: want === null ? "REMOVE team" : "SET team = :t",
        ...(want === null ? {} : { ExpressionAttributeValues: { ":t": want } }),
      }),
    );
  }
  updated++;
}

console.log(
  `\n${WRITE ? "updated" : "would update"} ${updated} · ${same} already correct · ${unmatched} unmatched (${deals.length} deals)`,
);
