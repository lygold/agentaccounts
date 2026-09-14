import "server-only";
import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDoc, TABLES } from "./dynamo-client";
import type { BankBalance, BankTransaction } from "../types";

/** Imported bank statement lines + the settled daily balance (Phase 7). See
 *  docs/mem/bank-export-format.md for the source shape. */

export async function listBankTransactionsForDate(
  officeId: string,
  date: string,
): Promise<BankTransaction[]> {
  const doc = getDynamoDoc();
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLES.bankTransactions(),
      IndexName: "byOfficeId",
      KeyConditionExpression: "officeId = :o AND #d = :d",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: { ":o": officeId, ":d": date },
    }),
  );
  return (res.Items as BankTransaction[]) ?? [];
}

/** Every transaction reference already imported for an office, for
 *  import-dedup — a line is identified by (date, reference, credit, debit). */
export async function listBankTransactionsInRange(
  officeId: string,
  fromDate: string,
  toDate: string,
): Promise<BankTransaction[]> {
  const doc = getDynamoDoc();
  const out: BankTransaction[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: TABLES.bankTransactions(),
        IndexName: "byOfficeId",
        KeyConditionExpression: "officeId = :o AND #d BETWEEN :f AND :t",
        ExpressionAttributeNames: { "#d": "date" },
        ExpressionAttributeValues: { ":o": officeId, ":f": fromDate, ":t": toDate },
        ExclusiveStartKey: lastKey,
      }),
    );
    out.push(...((res.Items as BankTransaction[]) ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

export async function insertBankTransaction(
  input: Omit<BankTransaction, "id" | "createdAt">,
): Promise<BankTransaction> {
  const record: BankTransaction = {
    id: `bnk_${randomUUID()}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  await getDynamoDoc().send(
    new PutCommand({ TableName: TABLES.bankTransactions(), Item: record }),
  );
  return record;
}

/** Set/overwrite the day's settled balance — id is deterministic so a
 *  re-import of the same day never duplicates. */
export async function setBankBalance(
  officeId: string,
  date: string,
  balance: number,
): Promise<BankBalance> {
  const record: BankBalance = {
    id: `${officeId}:${date}`,
    officeId,
    date,
    balance,
    createdAt: new Date().toISOString(),
  };
  await getDynamoDoc().send(
    new PutCommand({ TableName: TABLES.bankBalances(), Item: record }),
  );
  return record;
}

export async function getBankBalance(
  officeId: string,
  date: string,
): Promise<BankBalance | null> {
  const res = await getDynamoDoc().send(
    new GetCommand({ TableName: TABLES.bankBalances(), Key: { id: `${officeId}:${date}` } }),
  );
  return (res.Item as BankBalance) ?? null;
}

/** The most recent balance strictly before `date`, scanning back up to
 *  `maxLookbackDays` (weekends/holidays have no bank rows). */
export async function getPriorBankBalance(
  officeId: string,
  date: string,
  maxLookbackDays = 10,
): Promise<BankBalance | null> {
  const d = new Date(`${date}T00:00:00Z`);
  for (let i = 1; i <= maxLookbackDays; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const iso = d.toISOString().slice(0, 10);
    const bal = await getBankBalance(officeId, iso);
    if (bal) return bal;
  }
  return null;
}
