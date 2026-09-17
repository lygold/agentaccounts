/**
 * Phase 9 — add a `byOfficeId` GSI to agent-ledger-referrals, the same way
 * scripts/add-office-gsis.mjs added one to agent-ledger-properties: the
 * table was pre-provisioned (Phase 0, create-tables.mjs) with only
 * {id, dealId} + byDealId, before this feature defined what it actually
 * needs to list referrals per office.
 *
 * Run ONCE, with admin AWS creds (the scoped `agent-ledger-app` user has no
 * dynamodb:UpdateTable):
 *
 *   cd app
 *   AWS_REGION=eu-north-1 AWS_PROFILE=<admin> node scripts/add-referrals-office-gsi.mjs
 *
 * Idempotent — a no-op if the table doesn't exist yet (create-tables.mjs
 * already defines officeId/byOfficeId for a fresh create) or already has
 * the index. Hash-only GSI (no range key) — referral volume at this office
 * is a few dozen rows a year, no need for a sorted range query yet.
 */
import {
  DynamoDBClient,
  DescribeTableCommand,
  UpdateTableCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION || "eu-north-1";
const client = new DynamoDBClient({ region });

const TABLE = "agent-ledger-referrals";
const INDEX = "byOfficeId";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function describe() {
  const res = await client.send(new DescribeTableCommand({ TableName: TABLE }));
  return res.Table;
}

async function waitForIndex() {
  for (;;) {
    const t = await describe();
    const gsi = (t.GlobalSecondaryIndexes ?? []).find((g) => g.IndexName === INDEX);
    const status = gsi?.IndexStatus;
    const backfilling = gsi?.Backfilling ?? false;
    process.stdout.write(`\r    ${INDEX}: ${status}${backfilling ? " (backfilling)" : ""}      `);
    if (status === "ACTIVE" && !backfilling) {
      process.stdout.write("\n");
      return;
    }
    await sleep(10_000);
  }
}

console.log(`region: ${region}\n${TABLE} ... `);

let table;
try {
  table = await describe();
} catch (e) {
  if (e instanceof ResourceNotFoundException) {
    console.log(
      "table doesn't exist yet — nothing to migrate; run scripts/create-tables.mjs " +
        "(it already defines officeId/byOfficeId for a fresh create)",
    );
    process.exit(0);
  }
  throw e;
}

if ((table.GlobalSecondaryIndexes ?? []).some((g) => g.IndexName === INDEX)) {
  console.log("already has byOfficeId, skipped");
  process.exit(0);
}

console.log("creating");
await client.send(
  new UpdateTableCommand({
    TableName: TABLE,
    AttributeDefinitions: [{ AttributeName: "officeId", AttributeType: "S" }],
    GlobalSecondaryIndexUpdates: [
      {
        Create: {
          IndexName: INDEX,
          KeySchema: [{ AttributeName: "officeId", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
        },
      },
    ],
  }),
);
await waitForIndex();
console.log("done");
