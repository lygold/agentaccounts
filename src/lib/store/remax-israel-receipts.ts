import "server-only";
import { randomUUID } from "crypto";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDoc, TABLES } from "./dynamo-client";
import type { RemaxIsraelReceipt } from "../types";

/** Manual entries for deals where the client pays RE/MAX Israel directly
 *  (Phase 7 §3). Key `id`, GSI `byOfficeId` (HASH officeId, RANGE date). */

export async function listRemaxIsraelReceiptsForDate(
  officeId: string,
  date: string,
): Promise<RemaxIsraelReceipt[]> {
  const doc = getDynamoDoc();
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLES.remaxIsraelReceipts(),
      IndexName: "byOfficeId",
      KeyConditionExpression: "officeId = :o AND #d = :d",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: { ":o": officeId, ":d": date },
    }),
  );
  return (res.Items as RemaxIsraelReceipt[]) ?? [];
}

export async function createRemaxIsraelReceipt(
  input: Omit<RemaxIsraelReceipt, "id" | "createdAt">,
): Promise<RemaxIsraelReceipt> {
  const record: RemaxIsraelReceipt = {
    id: `rmi_${randomUUID()}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  await getDynamoDoc().send(
    new PutCommand({ TableName: TABLES.remaxIsraelReceipts(), Item: record }),
  );
  return record;
}
