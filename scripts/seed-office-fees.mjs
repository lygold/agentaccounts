/**
 * Phase 6 — seed the "דמי משרד" recurring-expense row for every existing agent
 * (new agents get it on create). Idempotent: id is `rex-<agentId>-officefee`,
 * skipped if present.
 *
 *   node --env-file=.env.local scripts/seed-office-fees.mjs           # dry run
 *   node --env-file=.env.local scripts/seed-office-fees.mjs --write
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const WRITE = process.argv.includes("--write");
const STANDARD_OFFICE_FEE = 300;

const AGENTS = process.env.DYNAMODB_TABLE_AGENTS;
const REX = process.env.DYNAMODB_TABLE_RECURRING_EXPENSES;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
if (!AGENTS || !REX || !region || !accessKeyId || !secretAccessKey) {
  console.error("Missing env — run with: node --env-file=.env.local scripts/seed-office-fees.mjs");
  process.exit(2);
}

const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, credentials: { accessKeyId, secretAccessKey } }),
);

async function scanAll(table) {
  const out = [];
  let key;
  do {
    const r = await doc.send(new ScanCommand({ TableName: table, ExclusiveStartKey: key }));
    out.push(...(r.Items ?? []));
    key = r.LastEvaluatedKey;
  } while (key);
  return out;
}

console.log(WRITE ? "MODE: write\n" : "MODE: dry run (--write to apply)\n");

const agents = await scanAll(AGENTS);
const existing = new Set((await scanAll(REX)).map((r) => r.id));
const now = new Date().toISOString();
let created = 0;
let skipped = 0;

for (const a of agents) {
  const id = `rex-${a.id}-officefee`;
  if (existing.has(id)) {
    skipped++;
    continue;
  }
  const amount = a.officeFeeExVat ?? STANDARD_OFFICE_FEE;
  console.log(`  ${a.name}  →  דמי משרד ₪${amount} + VAT`);
  if (WRITE) {
    await doc.send(
      new PutCommand({
        TableName: REX,
        Item: {
          id,
          officeId: a.officeId,
          agentId: a.id,
          label: "דמי משרד",
          catalogNum: "דמי משרד",
          amountExVat: amount,
          active: true,
          startMonth: null,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
  }
  created++;
}

console.log(`\n${WRITE ? "seeded" : "would seed"} ${created}, skipped ${skipped} (${agents.length} agents)`);
