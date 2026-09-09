import "server-only";
import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDoc, TABLES } from "./dynamo-client";
import { canonicalizeContact } from "../phone";
import type { AgentRecord, AgentStatus } from "../types";
import type { AppRole } from "../monday/types";

/**
 * The `agents` table — this app's canonical agent directory (Phase 4),
 * replacing per-request reads of the Daf Kesher (Monday) board. During the
 * migration bridge rows carry `mondayItemId`; a sync job (Phase 4c) keeps
 * name/phone/email in step until Daf Kesher is retired (ROADMAP Phase 10).
 */

/** DynamoDB item shape — GSI key attributes (`email`/`phone`) are omitted
 *  entirely when null so the item simply isn't in that index. */
type AgentItem = Omit<AgentRecord, "email" | "phone"> & {
  email?: string;
  phone?: string;
};

function toItem(a: AgentRecord): AgentItem {
  const { email, phone, ...rest } = a;
  return {
    ...rest,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
}

function fromItem(item: Record<string, unknown>): AgentRecord {
  const i = item as Partial<AgentItem> & { district?: number | null };
  return {
    id: String(i.id),
    officeId: String(i.officeId),
    name: String(i.name ?? ""),
    email: i.email ?? null,
    phone: i.phone ?? null,
    firstNameHebrew: i.firstNameHebrew ?? null,
    fullNameEnglish: i.fullNameEnglish ?? null,
    surname: i.surname ?? null,
    // `?? district` tolerates rows written before the rename; the migration
    // (scripts/rename-district-to-team.mjs) clears the old attribute.
    team: i.team ?? i.district ?? null,
    isTeamLeader: Boolean(i.isTeamLeader),
    role: (i.role ?? "agent") as AppRole,
    status: (i.status ?? "active") as AgentStatus,
    mondayItemId: i.mondayItemId ?? null,
    createdAt: String(i.createdAt ?? ""),
    updatedAt: String(i.updatedAt ?? ""),
  };
}

export function newAgentId(): string {
  return `agt_${randomUUID()}`;
}

export async function getAgentById(id: string): Promise<AgentRecord | null> {
  const doc = getDynamoDoc();
  const res = await doc.send(new GetCommand({ TableName: TABLES.agents(), Key: { id } }));
  return res.Item ? fromItem(res.Item) : null;
}

/**
 * Look up an agent by phone or email for login. Returns null on no match or
 * an ambiguous multi-match (anti-enumeration — same convention the Daf
 * Kesher lookup used). Archived agents never match.
 */
export async function findAgentByContact(contact: string): Promise<AgentRecord | null> {
  const value = canonicalizeContact(contact);
  if (!value) return null;
  const isEmail = value.includes("@");

  const doc = getDynamoDoc();
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLES.agents(),
      IndexName: isEmail ? "byEmail" : "byPhone",
      KeyConditionExpression: "#k = :v",
      ExpressionAttributeNames: { "#k": isEmail ? "email" : "phone" },
      ExpressionAttributeValues: { ":v": value },
      Limit: 5,
    }),
  );
  const active = (res.Items ?? []).map(fromItem).filter((a) => a.status === "active");
  return active.length === 1 ? active[0] : null;
}

export async function listAgentsByOffice(
  officeId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<AgentRecord[]> {
  const doc = getDynamoDoc();
  const out: AgentRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: TABLES.agents(),
        IndexName: "byOfficeId",
        KeyConditionExpression: "officeId = :o",
        ExpressionAttributeValues: { ":o": officeId },
        ExclusiveStartKey: lastKey,
      }),
    );
    out.push(...(res.Items ?? []).map(fromItem));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  const agents = opts.includeArchived ? out : out.filter((a) => a.status === "active");
  return agents.sort(compareByTeamThenName);
}

/** Default order for the directory: team ascending (agents with no team last),
 *  then name. */
export function compareByTeamThenName(a: AgentRecord, b: AgentRecord): number {
  const ta = a.team ?? Infinity;
  const tb = b.team ?? Infinity;
  if (ta !== tb) return ta - tb;
  return a.name.localeCompare(b.name);
}

/** Ids of every agent on a team (any status) — the roster a team leader is
 *  scoped to. Replaces the Daf Kesher roster lookup (Phase 4c). */
export async function listAgentIdsInTeam(
  officeId: string,
  team: number,
): Promise<string[]> {
  const roster = await listAgentsByOffice(officeId, { includeArchived: true });
  return roster.filter((a) => a.team === team).map((a) => a.id);
}

export interface NewAgentInput {
  officeId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: AppRole;
  team: number | null;
  isTeamLeader?: boolean;
  firstNameHebrew?: string | null;
  fullNameEnglish?: string | null;
  surname?: string | null;
  mondayItemId?: string | null;
  /** For imports that need a deterministic id; defaults to a fresh `agt_…`. */
  id?: string;
}

export async function createAgent(input: NewAgentInput): Promise<AgentRecord> {
  const now = new Date().toISOString();
  const record: AgentRecord = {
    id: input.id ?? newAgentId(),
    officeId: input.officeId,
    name: input.name,
    email: input.email ? input.email.toLowerCase() : null,
    phone: input.phone,
    firstNameHebrew: input.firstNameHebrew ?? null,
    fullNameEnglish: input.fullNameEnglish ?? null,
    surname: input.surname ?? null,
    team: input.team,
    isTeamLeader: input.isTeamLeader ?? false,
    role: input.role,
    status: "active",
    mondayItemId: input.mondayItemId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const doc = getDynamoDoc();
  await doc.send(new PutCommand({ TableName: TABLES.agents(), Item: toItem(record) }));
  return record;
}

/** Merge-then-put (same pattern as dynamo-store.update). */
export async function updateAgent(
  id: string,
  patch: Partial<Omit<AgentRecord, "id" | "officeId" | "createdAt">>,
): Promise<AgentRecord | null> {
  const existing = await getAgentById(id);
  if (!existing) return null;
  const merged: AgentRecord = {
    ...existing,
    ...patch,
    email: patch.email !== undefined ? (patch.email?.toLowerCase() ?? null) : existing.email,
    updatedAt: new Date().toISOString(),
  };
  const doc = getDynamoDoc();
  await doc.send(new PutCommand({ TableName: TABLES.agents(), Item: toItem(merged) }));
  return merged;
}

export async function setAgentStatus(
  id: string,
  status: AgentStatus,
): Promise<AgentRecord | null> {
  return updateAgent(id, { status });
}
