/**
 * Phase 5a — add a `byOfficeId` GSI to the four core tables so office-scoped
 * list queries replace the full-table scans (`listDeals`, `listAgentBalances`).
 *
 * Run ONCE, with admin AWS creds (the scoped `agent-ledger-app` user has no
 * dynamodb:UpdateTable):
 *
 *   cd app
 *   AWS_REGION=eu-north-1 AWS_PROFILE=<admin> node scripts/add-office-gsis.mjs
 *   # or: AWS_REGION=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... node scripts/add-office-gsis.mjs
 *
 * DynamoDB allows one GSI add per UpdateTable call and the index must finish
 * backfilling before the next add on the same table — this script does them one
 * at a time and waits. Backfill is online: reads/writes keep working throughout.
 * Idempotent — a table that already has `byOfficeId` is skipped.
 *
 * HASH is `officeId` on every index. RANGE is `createdAt` (deals / billing /
 * income) or `date` (agent-account — also serves the Phase 7 daily report's
 * date-bounded queries). Every existing row already carries these attributes.
 */
import {
  DynamoDBClient,
  DescribeTableCommand,
  UpdateTableCommand,
} from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION || "eu-north-1";
const client = new DynamoDBClient({ region });

const INDEX = "byOfficeId";

/** table name → the RANGE key attribute for its byOfficeId index. */
const TARGETS = [
  { name: "agent-ledger-deals", range: "createdAt" },
  { name: "agent-ledger-billing", range: "createdAt" },
  { name: "agent-ledger-income", range: "createdAt" },
  { name: "agent-ledger-agent-account", range: "date" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function describe(name) {
  const res = await client.send(new DescribeTableCommand({ TableName: name }));
  return res.Table;
}

async function hasIndex(name) {
  const t = await describe(name);
  return (t.GlobalSecondaryIndexes ?? []).some((g) => g.IndexName === INDEX);
}

/** Wait until the byOfficeId index is ACTIVE and not backfilling. */
async function waitForIndex(name) {
  for (;;) {
    const t = await describe(name);
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

async function addIndex(name, range) {
  await client.send(
    new UpdateTableCommand({
      TableName: name,
      AttributeDefinitions: [
        { AttributeName: "officeId", AttributeType: "S" },
        { AttributeName: range, AttributeType: "S" },
      ],
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: INDEX,
            KeySchema: [
              { AttributeName: "officeId", KeyType: "HASH" },
              { AttributeName: range, KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        },
      ],
    }),
  );
}

console.log(`region: ${region}\n`);
let added = 0;
let skipped = 0;

for (const { name, range } of TARGETS) {
  process.stdout.write(`${name}  (RANGE ${range}) ... `);
  try {
    if (await hasIndex(name)) {
      console.log("already has byOfficeId, skipped");
      skipped++;
      continue;
    }
    console.log("creating");
    await addIndex(name, range);
    await waitForIndex(name);
    console.log(`    done`);
    added++;
  } catch (e) {
    console.log(`\n    FAILED  ${e.name}: ${e.message}`);
  }
}

console.log(`\n${added} index(es) added, ${skipped} already present`);
if (added > 0) {
  console.log(
    "Next: deploy the Phase 5a code that queries byOfficeId instead of scanning.",
  );
}
