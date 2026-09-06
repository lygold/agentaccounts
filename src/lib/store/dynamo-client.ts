import "server-only";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let _doc: DynamoDBDocumentClient | null = null;

/**
 * Local dev supplies the scoped `agent-ledger-app` static keys via
 * .env.local. On Amplify/Lambda the runtime injects the compute role's
 * credentials (with a session token) — there we pass no explicit
 * credentials so the SDK's default provider chain uses the role. Grant that
 * role DynamoDB + S3 access rather than storing static keys.
 */
export function getDynamoDoc(): DynamoDBDocumentClient {
  if (_doc) return _doc;
  // DYNAMO_REGION lets the tables live in a different region than the app —
  // e.g. an Amplify app not hosted in eu-north-1 still reaches the tables there.
  const region = process.env.DYNAMO_REGION || process.env.AWS_REGION;
  if (!region) throw new Error("DYNAMO_REGION / AWS_REGION is not set");

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const useStaticKeys =
    !!accessKeyId && !!secretAccessKey && !process.env.AWS_SESSION_TOKEN;

  const client = new DynamoDBClient(
    useStaticKeys
      ? { region, credentials: { accessKeyId, secretAccessKey } }
      : { region },
  );
  _doc = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return _doc;
}

export const TABLES = {
  deals: () => requireTableName("DYNAMODB_TABLE_DEALS"),
  billing: () => requireTableName("DYNAMODB_TABLE_BILLING"),
  income: () => requireTableName("DYNAMODB_TABLE_INCOME"),
  /** The agent's running account with the office — commission, expenses,
   *  payments to/from them. Physical table: agent-ledger-agent-account. */
  agentAccount: () => requireTableName("DYNAMODB_TABLE_AGENT_ACCOUNT"),
};

function requireTableName(envVar: string): string {
  const name = process.env[envVar];
  if (!name) throw new Error(`${envVar} is not set`);
  return name;
}
