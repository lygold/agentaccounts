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
    name: "agent-ledger-referrals",
    attrs: { id: S, dealId: S },
    gsis: [["byDealId", "dealId"]],
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
    GlobalSecondaryIndexes: t.gsis.map(([indexName, keyAttr]) => ({
      IndexName: indexName,
      KeySchema: [{ AttributeName: keyAttr, KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    })),
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
