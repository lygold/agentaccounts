import "server-only";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let _doc: DynamoDBDocumentClient | null = null;

/** Scoped IAM user (agent-ledger-app) — DynamoDB + S3 attachments only, not
 *  a personal AWS account's broad credentials. See .env.local. */
export function getDynamoDoc(): DynamoDBDocumentClient {
  if (_doc) return _doc;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS not configured: set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    );
  }
  const client = new DynamoDBClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  _doc = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return _doc;
}

export const TABLES = {
  deals: () => requireTableName("DYNAMODB_TABLE_DEALS"),
  billing: () => requireTableName("DYNAMODB_TABLE_BILLING"),
  income: () => requireTableName("DYNAMODB_TABLE_INCOME"),
  ledgerEntries: () => requireTableName("DYNAMODB_TABLE_LEDGER_ENTRIES"),
};

function requireTableName(envVar: string): string {
  const name = process.env[envVar];
  if (!name) throw new Error(`${envVar} is not set`);
  return name;
}
