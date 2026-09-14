import "server-only";
import { randomUUID } from "crypto";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDoc, TABLES } from "./dynamo-client";
import type { OfficeExpense, OfficeExpenseCategory } from "../types";

/** Non-agent office costs (Phase 7). Key `id`, GSI `byOfficeId`
 *  (HASH officeId, RANGE date). */

export async function listOfficeExpensesForDate(
  officeId: string,
  date: string,
): Promise<OfficeExpense[]> {
  const doc = getDynamoDoc();
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLES.officeExpenses(),
      IndexName: "byOfficeId",
      KeyConditionExpression: "officeId = :o AND #d = :d",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: { ":o": officeId, ":d": date },
    }),
  );
  return (res.Items as OfficeExpense[]) ?? [];
}

export async function listOfficeExpensesInRange(
  officeId: string,
  fromDate: string,
  toDate: string,
): Promise<OfficeExpense[]> {
  const doc = getDynamoDoc();
  const out: OfficeExpense[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: TABLES.officeExpenses(),
        IndexName: "byOfficeId",
        KeyConditionExpression: "officeId = :o AND #d BETWEEN :f AND :t",
        ExpressionAttributeNames: { "#d": "date" },
        ExpressionAttributeValues: { ":o": officeId, ":f": fromDate, ":t": toDate },
        ExclusiveStartKey: lastKey,
      }),
    );
    out.push(...((res.Items as OfficeExpense[]) ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function createOfficeExpense(input: {
  officeId: string;
  category: OfficeExpenseCategory;
  description: string;
  amount: number;
  date: string;
}): Promise<OfficeExpense> {
  const record: OfficeExpense = {
    id: `oex_${randomUUID()}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  await getDynamoDoc().send(
    new PutCommand({ TableName: TABLES.officeExpenses(), Item: record }),
  );
  return record;
}
