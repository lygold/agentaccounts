/**
 * Demo data for the exclusivity Gantt (/properties/gantt) — 5 fictitious
 * exclusivities (biladiut) spread across the four color bands (<50% green,
 * 50-75% yellow, 76-90% orange, 90%+ red) plus 2 haskama-only listings for
 * the plain list underneath. Only the dates are the point here — names/
 * addresses/owners are all made up. Real officeId + real agent ids so the
 * rows actually show up under your existing office/agent scoping.
 *
 * Idempotent (fixed ids, ConditionExpression attribute_not_exists) — safe
 * to re-run. Remove with --remove once you're done with the demo.
 *
 *   node --env-file=.env.local scripts/seed-demo-gantt.mjs            # dry run
 *   node --env-file=.env.local scripts/seed-demo-gantt.mjs --write    # seed
 *   node --env-file=.env.local scripts/seed-demo-gantt.mjs --remove   # delete the demo rows
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const WRITE = process.argv.includes("--write");
const REMOVE = process.argv.includes("--remove");

const TABLE = process.env.DYNAMODB_TABLE_PROPERTIES;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
if (!TABLE || !region || !accessKeyId || !secretAccessKey) {
  console.error("Missing env — run with: node --env-file=.env.local scripts/seed-demo-gantt.mjs");
  process.exit(2);
}

const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, credentials: { accessKeyId, secretAccessKey } }),
);

const OFFICE_ID = "remax-jerusalem";
const PERIOD_DAYS = 182; // ~6 months — Levi's own example for calibrating the color bands
const now = new Date();
const nowIso = now.toISOString();

function daysAgo(n) {
  return new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
}
function plusDays(isoDate, n) {
  return new Date(new Date(isoDate).getTime() + n * 86400000).toISOString().slice(0, 10);
}

// Real agent ids (agent-ledger-agents, remax-jerusalem) — spread across a
// few different agents so the manager view shows a realistic mix.
const AGENTS = {
  alroei: { id: "agt_f98dde2f-5b23-43c8-a2da-0f50b70e8822", name: "אלרועי בוזגלו" },
  shira: { id: "agt_5ccbb1b2-b4ca-435f-ae18-a90ba7c1daf1", name: "שירה שני" },
  binyamin: { id: "agt_5c4e9656-fd90-4d62-a26b-33c68655e324", name: "בנימין  זרביב" },
  betzalel: { id: "agt_c800bee9-8b20-4c36-b9b3-35602764adf7", name: "בצלאל בלוך" },
  levi: { id: "agt_dbadc548-153d-47e3-b553-5ec2ae55a57b", name: "לוי גולדפיין" },
  ora: { id: "agt_6dd20c80-6a80-4b5d-bfa8-fd2185a71a4a", name: "אורה חביב" },
  menachem: { id: "agt_f6a01c81-1480-4a27-8344-e00c1bddced1", name: "מנחם סקלאר" },
};

function exclusivity(elapsedPercent) {
  const start = daysAgo(Math.round((PERIOD_DAYS * elapsedPercent) / 100));
  return { exclusivityStartDate: start, exclusivityEndDate: plusDays(start, PERIOD_DAYS) };
}

const rows = [
  // --- 5 exclusivities (biladiut), one per color band + a near-expiry red ---
  {
    id: "demo-excl-1",
    agent: AGENTS.alroei,
    dealType: "sale",
    street: "עמק רפאים",
    buildingNumber: "12",
    ownerName: "דוד כהן",
    commissionPercent: 2,
    ...exclusivity(20), // green
  },
  {
    id: "demo-excl-2",
    agent: AGENTS.shira,
    dealType: "sale",
    street: "הרב קוק",
    buildingNumber: "5",
    ownerName: "רחל לוי",
    commissionPercent: 2,
    ...exclusivity(45), // green, near the boundary
  },
  {
    id: "demo-excl-3",
    agent: AGENTS.binyamin,
    dealType: "rental",
    street: "קרן היסוד",
    buildingNumber: "8",
    ownerName: "משה אברהם",
    commissionPercent: 8.33,
    ...exclusivity(65), // yellow
  },
  {
    id: "demo-excl-4",
    agent: AGENTS.betzalel,
    dealType: "sale",
    street: "יפו",
    buildingNumber: "100",
    ownerName: "שרה מזרחי",
    commissionPercent: 2,
    ...exclusivity(85), // orange
  },
  {
    id: "demo-excl-5",
    agent: AGENTS.levi,
    dealType: "sale",
    street: "עזה",
    buildingNumber: "45",
    ownerName: "יעקב פרידמן",
    commissionPercent: 2,
    ...exclusivity(97), // red, days from expiring
  },
  // --- 2 haskamot (agreement only, no exclusivity dates) ---
  {
    id: "demo-haskama-1",
    agent: AGENTS.ora,
    dealType: "sale",
    street: "דרך חברון",
    buildingNumber: "54",
    ownerName: "מרים גולן",
    commissionPercent: 2,
  },
  {
    id: "demo-haskama-2",
    agent: AGENTS.menachem,
    dealType: "rental",
    street: "כנפי נשרים",
    buildingNumber: "20",
    ownerName: "אליהו שוורץ",
    commissionPercent: 8.33,
  },
];

console.log(REMOVE ? "MODE: remove\n" : WRITE ? "MODE: write\n" : "MODE: dry run (--write to apply, --remove to delete)\n");

for (const r of rows) {
  const hasExclusivity = Boolean(r.exclusivityStartDate);
  console.log(
    `  ${r.id}  ${r.street} ${r.buildingNumber}  ·  ${r.agent.name}  ·  ${
      hasExclusivity ? `${r.exclusivityStartDate} → ${r.exclusivityEndDate}` : "haskama only"
    }`,
  );
  if (REMOVE) {
    await doc.send(new DeleteCommand({ TableName: TABLE, Key: { id: r.id } }));
    continue;
  }
  if (WRITE) {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          id: r.id,
          officeId: OFFICE_ID,
          agentId: r.agent.id,
          agentName: r.agent.name,
          status: "active",
          dealType: r.dealType,
          contractType: hasExclusivity ? "biladiut" : "haskama",
          street: r.street,
          buildingNumber: r.buildingNumber,
          ownerName: r.ownerName,
          commissionPercent: r.commissionPercent,
          commissionVatMode: "plus",
          ...(hasExclusivity
            ? { exclusivityStartDate: r.exclusivityStartDate, exclusivityEndDate: r.exclusivityEndDate }
            : {}),
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
  }
}

console.log(`\n${REMOVE ? "removed" : WRITE ? "seeded" : "would seed"} ${rows.length} demo properties`);
