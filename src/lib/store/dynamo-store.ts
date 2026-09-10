import "server-only";
import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDoc } from "./dynamo-client";

/**
 * Generic DynamoDB CRUD helpers — same shape as the Phase 1 file-store.ts
 * helpers they replace (listAll/getById/insert/update/newId), so the
 * per-entity store modules barely change other than the import and table
 * name. queryByIndex is new — backs the by-agent/by-deal GSI lookups that
 * file-store.ts used to do via client-side filtering.
 */

export function newId(): string {
  return randomUUID();
}

export async function listAll<T>(tableName: string): Promise<T[]> {
  const doc = getDynamoDoc();
  let items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new ScanCommand({ TableName: tableName, ExclusiveStartKey: lastKey }),
    );
    items = items.concat((res.Items ?? []) as T[]);
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

export async function getById<T>(tableName: string, id: string): Promise<T | null> {
  const doc = getDynamoDoc();
  const res = await doc.send(new GetCommand({ TableName: tableName, Key: { id } }));
  return (res.Item as T) ?? null;
}

export async function insert<T extends { id: string }>(
  tableName: string,
  item: T,
): Promise<T> {
  // Every row in this app is office-scoped. A create that forgot to stamp
  // `officeId` is a bug that would silently produce an unreachable row.
  if (
    "officeId" in item &&
    (typeof (item as { officeId?: unknown }).officeId !== "string" ||
      !(item as { officeId: string }).officeId)
  ) {
    throw new Error(`insert(${tableName}): row is missing officeId`);
  }
  const doc = getDynamoDoc();
  await doc.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

/** Merge-then-put rather than a native UpdateCommand — simpler than
 *  building dynamic UpdateExpressions, and fine for this app's usage
 *  pattern (single admin/small team, rare concurrent edits to the same
 *  item). */
export async function update<T extends { id: string }>(
  tableName: string,
  id: string,
  patch: Partial<T>,
  /** When given, the existing row must belong to this office or the write is
   *  refused (returns null, same as "not found"). Defense in depth on top of
   *  the caller's own scoping. */
  expectedOfficeId?: string,
): Promise<T | null> {
  const existing = await getById<T>(tableName, id);
  if (!existing) return null;
  if (
    expectedOfficeId !== undefined &&
    (existing as { officeId?: string }).officeId !== expectedOfficeId
  ) {
    return null;
  }
  const merged = { ...existing, ...patch } as T;
  await insert(tableName, merged);
  return merged;
}

export async function queryByIndex<T>(
  tableName: string,
  indexName: string,
  keyName: string,
  keyValue: string,
): Promise<T[]> {
  const doc = getDynamoDoc();
  let items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: "#k = :v",
        ExpressionAttributeNames: { "#k": keyName },
        ExpressionAttributeValues: { ":v": keyValue },
        ExclusiveStartKey: lastKey,
      }),
    );
    items = items.concat((res.Items ?? []) as T[]);
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}
