/**
 * Phase 9 (offers) — add `byOfficeId` and `byToken` to the existing
 * `agent-ledger-offers` table, which was originally created (Phase 0, see
 * create-tables.mjs) with only `byAgentId`. Needed for the native offers
 * feature: the list page queries byOfficeId, and the public buyer-facing
 * link (src/app/offer/[token]) looks itself up by byToken — it must not
 * scan.
 *
 * Run ONCE, with admin AWS creds (the scoped `agent-ledger-app` user has no
 * dynamodb:UpdateTable):
 *
 *   cd app
 *   AWS_REGION=eu-north-1 AWS_PROFILE=<admin> node scripts/add-offer-gsis.mjs
 *
 * DynamoDB allows one GSI add per UpdateTable call and the index must finish
 * backfilling before the next add on the same table — this script does them
 * one at a time and waits. Backfill is online: reads/writes keep working
 * throughout. Idempotent — an index that already exists is skipped.
 *
 * The table is empty of real data today (offers feature unbuilt until now),
 * so there's no meaningful backfill concern either way.
 */
import {
  DynamoDBClient,
  DescribeTableCommand,
  UpdateTableCommand,
} from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION || "eu-north-1";
const client = new DynamoDBClient({ region });

const TABLE = "agent-ledger-offers";

const INDEXES = [
  {
    name: "byOfficeId",
    attrs: [
      { AttributeName: "officeId", AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "S" },
    ],
    keySchema: [
      { AttributeName: "officeId", KeyType: "HASH" },
      { AttributeName: "createdAt", KeyType: "RANGE" },
    ],
  },
  {
    name: "byToken",
    attrs: [{ AttributeName: "token", AttributeType: "S" }],
    keySchema: [{ AttributeName: "token", KeyType: "HASH" }],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function describe() {
  const res = await client.send(new DescribeTableCommand({ TableName: TABLE }));
  return res.Table;
}

async function hasIndex(indexName) {
  const t = await describe();
  return (t.GlobalSecondaryIndexes ?? []).some((g) => g.IndexName === indexName);
}

async function waitForIndex(indexName) {
  for (;;) {
    const t = await describe();
    const gsi = (t.GlobalSecondaryIndexes ?? []).find((g) => g.IndexName === indexName);
    const status = gsi?.IndexStatus;
    const backfilling = gsi?.Backfilling ?? false;
    process.stdout.write(`\r    ${indexName}: ${status}${backfilling ? " (backfilling)" : ""}      `);
    if (status === "ACTIVE" && !backfilling) {
      process.stdout.write("\n");
      return;
    }
    await sleep(10_000);
  }
}

async function addIndex({ name, attrs, keySchema }) {
  await client.send(
    new UpdateTableCommand({
      TableName: TABLE,
      AttributeDefinitions: attrs,
      GlobalSecondaryIndexUpdates: [
        { Create: { IndexName: name, KeySchema: keySchema, Projection: { ProjectionType: "ALL" } } },
      ],
    }),
  );
}

console.log(`region: ${region}\ntable: ${TABLE}\n`);
let added = 0;
let skipped = 0;

for (const index of INDEXES) {
  process.stdout.write(`${index.name} ... `);
  try {
    if (await hasIndex(index.name)) {
      console.log("already exists, skipped");
      skipped++;
      continue;
    }
    console.log("creating");
    await addIndex(index);
    await waitForIndex(index.name);
    console.log("    done");
    added++;
  } catch (e) {
    console.log(`\n    FAILED  ${e.name}: ${e.message}`);
  }
}

console.log(`\n${added} index(es) added, ${skipped} already present`);
