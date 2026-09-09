/**
 * Phase 4 — rename the `district` attribute to `team` on every row of
 * agent-ledger-agents. (Product-wide the grouping key is now "team"; the
 * app reads `team ?? district` transitionally, this clears the old name.)
 *
 *   cd app
 *   node --env-file=.env.local scripts/rename-district-to-team.mjs           # dry run
 *   node --env-file=.env.local scripts/rename-district-to-team.mjs --write   # apply
 *
 * Idempotent — a row with no `district` attribute is left alone.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const WRITE = process.argv.includes("--write");
const TABLE = process.env.DYNAMODB_TABLE_AGENTS;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!TABLE || !region || !accessKeyId || !secretAccessKey) {
  console.error(
    "Missing env — run with:  node --env-file=.env.local scripts/rename-district-to-team.mjs",
  );
  process.exit(2);
}

const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, credentials: { accessKeyId, secretAccessKey } }),
);

console.log(WRITE ? "MODE: write\n" : "MODE: dry run (pass --write to apply)\n");

let touched = 0;
let clean = 0;
let lastKey;
do {
  const res = await doc.send(
    new ScanCommand({
      TableName: TABLE,
      ProjectionExpression: "id, #n, district, team",
      ExpressionAttributeNames: { "#n": "name" },
      ExclusiveStartKey: lastKey,
    }),
  );
  for (const it of res.Items ?? []) {
    if (it.district === undefined) {
      clean++;
      continue;
    }
    const value = it.team ?? it.district;
    console.log(`  ${it.name}  district=${it.district} → team=${value}`);
    if (WRITE) {
      await doc.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { id: it.id },
          UpdateExpression: "SET team = :v REMOVE district",
          ExpressionAttributeValues: { ":v": value },
        }),
      );
    }
    touched++;
  }
  lastKey = res.LastEvaluatedKey;
} while (lastKey);

console.log(
  `\n${WRITE ? "updated" : "would update"} ${touched} row(s) · ${clean} already on 'team'`,
);
