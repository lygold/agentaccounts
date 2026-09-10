import "server-only";
import { randomUUID } from "crypto";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDoc, TABLES } from "./dynamo-client";
import type { RecurringExpense } from "../types";

/** Per-agent standing monthly charges (Phase 6). Key `id`, GSIs
 *  `byAgentId` / `byOfficeId`. */

export async function listRecurringExpensesForAgent(
  agentId: string,
): Promise<RecurringExpense[]> {
  const doc = getDynamoDoc();
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLES.recurringExpenses(),
      IndexName: "byAgentId",
      KeyConditionExpression: "agentId = :a",
      ExpressionAttributeValues: { ":a": agentId },
    }),
  );
  return ((res.Items as RecurringExpense[]) ?? []).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

export async function listRecurringExpensesForOffice(
  officeId: string,
): Promise<RecurringExpense[]> {
  const doc = getDynamoDoc();
  const out: RecurringExpense[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: TABLES.recurringExpenses(),
        IndexName: "byOfficeId",
        KeyConditionExpression: "officeId = :o",
        ExpressionAttributeValues: { ":o": officeId },
        ExclusiveStartKey: lastKey,
      }),
    );
    out.push(...((res.Items as RecurringExpense[]) ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

export interface NewRecurringExpense {
  officeId: string;
  agentId: string;
  label: string;
  amountExVat: number;
  catalogNum?: string | null;
  startMonth?: string | null;
  active?: boolean;
  /** For seeding with a deterministic id (`rex-<agentId>-<slug>`). */
  id?: string;
}

export async function createRecurringExpense(
  input: NewRecurringExpense,
): Promise<RecurringExpense> {
  const now = new Date().toISOString();
  const record: RecurringExpense = {
    id: input.id ?? `rex_${randomUUID()}`,
    officeId: input.officeId,
    agentId: input.agentId,
    label: input.label,
    catalogNum: input.catalogNum ?? null,
    amountExVat: input.amountExVat,
    active: input.active ?? true,
    startMonth: input.startMonth ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const doc = getDynamoDoc();
  await doc.send(
    new PutCommand({ TableName: TABLES.recurringExpenses(), Item: record }),
  );
  return record;
}

export async function updateRecurringExpense(
  existing: RecurringExpense,
  patch: Partial<Pick<RecurringExpense, "label" | "amountExVat" | "active" | "startMonth" | "catalogNum">>,
): Promise<RecurringExpense> {
  const merged: RecurringExpense = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const doc = getDynamoDoc();
  await doc.send(
    new PutCommand({ TableName: TABLES.recurringExpenses(), Item: merged }),
  );
  return merged;
}
