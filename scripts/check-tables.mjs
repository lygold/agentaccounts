/**
 * Verifies the DynamoDB tables + GSIs this app expects are reachable with
 * the app's own (deliberately least-privilege) credentials. It does NOT
 * call DescribeTable — the runtime IAM user isn't allowed to — it runs the
 * exact operations the store code uses (Scan + Query-by-GSI) and reports
 * whether each succeeds.
 *
 *   cd app
 *   node --env-file=.env.local scripts/check-tables.mjs
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

// table env var -> the GSI(s) the store code queries: indexName -> keyAttr
const EXPECTED = {
  DYNAMODB_TABLE_DEALS: { byAgentId: "agentId" },
  DYNAMODB_TABLE_BILLING: { byDealId: "dealId" },
  DYNAMODB_TABLE_INCOME: { byDealId: "dealId" },
  DYNAMODB_TABLE_AGENT_ACCOUNT: { byAgentId: "agentId" },
  DYNAMODB_TABLE_AGENTS: { byOfficeId: "officeId", byEmail: "email", byPhone: "phone" },
};

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
if (!region || !accessKeyId || !secretAccessKey) {
  console.error("Missing AWS_* env — run with:  node --env-file=.env.local scripts/check-tables.mjs");
  process.exit(2);
}

const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, credentials: { accessKeyId, secretAccessKey } }),
);

const diagnose = (e) => {
  if (e.name === "ResourceNotFoundException") return "table does not exist (or wrong name/region)";
  if (e.name === "AccessDeniedException") return "credentials lack read permission on this table";
  if (e.name === "ValidationException" && /index/i.test(e.message)) return "that GSI does not exist on the table";
  return `${e.name}: ${e.message}`;
};

console.log(`region: ${region}\n`);
let ok = true;

for (const [envVar, gsis] of Object.entries(EXPECTED)) {
  const table = process.env[envVar];
  console.log(`${envVar} = ${table ?? "(NOT SET)"}`);
  if (!table) {
    ok = false;
    console.log("  ✗ env var not set\n");
    continue;
  }

  // 1. table reachable? (Scan Limit 1 — what listAll/listDeals do)
  try {
    const res = await doc.send(new ScanCommand({ TableName: table, Limit: 1 }));
    console.log(`  table  ✓ reachable (${res.ScannedCount ?? 0} row scanned)`);
  } catch (e) {
    ok = false;
    console.log(`  table  ✗ ${diagnose(e)}`);
    console.log();
    continue;
  }

  // 2. each GSI queryable? (what queryByIndex does)
  for (const [idxName, idxKey] of Object.entries(gsis)) {
    try {
      const res = await doc.send(
        new QueryCommand({
          TableName: table,
          IndexName: idxName,
          KeyConditionExpression: "#k = :v",
          ExpressionAttributeNames: { "#k": idxKey },
          ExpressionAttributeValues: { ":v": "__none__" },
          Limit: 1,
        }),
      );
      console.log(`  GSI ${idxName} (${idxKey})  ✓ queryable (${res.Count} rows)`);
    } catch (e) {
      ok = false;
      console.log(`  GSI ${idxName} (${idxKey})  ✗ ${diagnose(e)}`);
    }
  }
  console.log();
}

console.log(ok ? "✅ all tables + indexes are reachable and correct" : "⚠️  problems above — see ✗");
process.exit(ok ? 0 : 1);
