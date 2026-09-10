import "server-only";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDoc, TABLES } from "./dynamo-client";
import type { GiDocumentRecord } from "../types";

/**
 * The `gi-documents` table (Phase 6) — every Green Invoice document the app
 * knows about, keyed by the GI document id. The app writes the 300 (with its
 * `target`) from the "create חשבון עסקה" button; the webhook writes the
 * 305/320/400 rows as it processes them, walking `linkedGiId` up to the 300
 * and copying its target down. See docs/mem/gi-webhook.md.
 */

export async function getGiDocument(id: string): Promise<GiDocumentRecord | null> {
  const doc = getDynamoDoc();
  const res = await doc.send(
    new GetCommand({ TableName: TABLES.giDocuments(), Key: { id } }),
  );
  return (res.Item as GiDocumentRecord) ?? null;
}

/** Full put — idempotent by id. Used for both the app-created 300 and the
 *  webhook-created receipts. */
export async function putGiDocument(
  input: Omit<GiDocumentRecord, "createdAt" | "updatedAt"> &
    Partial<Pick<GiDocumentRecord, "createdAt">>,
): Promise<GiDocumentRecord> {
  const now = new Date().toISOString();
  const record: GiDocumentRecord = {
    ...input,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
  const doc = getDynamoDoc();
  await doc.send(new PutCommand({ TableName: TABLES.giDocuments(), Item: record }));
  return record;
}

/** Every GI document recorded against a deal, oldest first. */
export async function listGiDocumentsForDeal(
  dealId: string,
): Promise<GiDocumentRecord[]> {
  const doc = getDynamoDoc();
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLES.giDocuments(),
      IndexName: "byDealId",
      KeyConditionExpression: "dealId = :d",
      ExpressionAttributeValues: { ":d": dealId },
    }),
  );
  return ((res.Items as GiDocumentRecord[]) ?? []).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}
