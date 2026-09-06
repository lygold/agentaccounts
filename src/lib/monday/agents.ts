import "server-only";
import { AGENTS_BOARD, isPendingColumn } from "./columns";
import { getAgentsBoardId, mondayQuery } from "./client";
import { resolveRole } from "../auth/roles";
import type { Agent, ColumnValue, RawItem } from "./types";

const AGENT_COLUMN_IDS = [
  AGENTS_BOARD.email,
  AGENTS_BOARD.phone,
  AGENTS_BOARD.firstNameHebrew,
  AGENTS_BOARD.fullNameEnglish,
  AGENTS_BOARD.surname,
  AGENTS_BOARD.district,
  AGENTS_BOARD.isTeamLeader,
  ...(isPendingColumn(AGENTS_BOARD.appRole) ? [] : [AGENTS_BOARD.appRole]),
]
  .map((c) => `"${c}"`)
  .join(",");

/**
 * Look up a single agent on Daf Kesher by phone or email — same board and
 * matching convention as sikkumPigisha's own findAgentByContact. Returns
 * null on no-match or ambiguous multi-match (anti-enumeration).
 */
export async function findAgentByContact(contact: string): Promise<Agent | null> {
  const normalized = contact.trim();
  if (!normalized) return null;

  const isEmail = normalized.includes("@");
  const columnId = isEmail ? AGENTS_BOARD.email : AGENTS_BOARD.phone;
  const valueToMatch = isEmail ? normalized.toLowerCase() : normalizePhone(normalized);

  const query = /* GraphQL */ `
    query FindAgentByContact($boardId: ID!, $columnId: String!, $value: String!) {
      items_page_by_column_values(
        limit: 5
        board_id: $boardId
        columns: [{ column_id: $columnId, column_values: [$value] }]
      ) {
        items {
          id
          name
          column_values(ids: [${AGENT_COLUMN_IDS}]) {
            id
            type
            value
            text
          }
        }
      }
    }
  `;

  const data = await mondayQuery<{
    items_page_by_column_values: { items: RawItem[] };
  }>(query, { boardId: getAgentsBoardId(), columnId, value: valueToMatch });

  const items = data.items_page_by_column_values?.items ?? [];
  if (items.length !== 1) return null;
  return toAgent(items[0], normalized);
}

/**
 * Names of every agent in a given רובע (district) — the team roster a team
 * leader is scoped to. Read-only lookup against Daf Kesher; the district
 * column doubles as the team-grouping key (see monday/columns.ts).
 */
export async function listAgentNamesInDistrict(district: number): Promise<string[]> {
  const query = /* GraphQL */ `
    query AgentsInDistrict($boardId: ID!, $columnId: String!, $value: String!) {
      items_page_by_column_values(
        limit: 100
        board_id: $boardId
        columns: [{ column_id: $columnId, column_values: [$value] }]
      ) {
        items {
          id
          name
        }
      }
    }
  `;
  const data = await mondayQuery<{
    items_page_by_column_values: { items: Array<{ id: string; name: string }> };
  }>(query, {
    boardId: getAgentsBoardId(),
    columnId: AGENTS_BOARD.district,
    value: String(district),
  });
  return (data.items_page_by_column_values?.items ?? []).map((i) => i.name);
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const query = /* GraphQL */ `
    query GetAgent($ids: [ID!]) {
      items(ids: $ids) {
        id
        name
        column_values(ids: [${AGENT_COLUMN_IDS}]) {
          id
          type
          value
          text
        }
      }
    }
  `;
  const data = await mondayQuery<{ items: RawItem[] }>(query, { ids: [id] });
  const item = data.items?.[0];
  return item ? toAgent(item) : null;
}

function toAgent(item: RawItem, matchedContact?: string): Agent {
  const email = getColumnText(item.column_values, AGENTS_BOARD.email);
  const phone = getColumnText(item.column_values, AGENTS_BOARD.phone);
  const district = getColumnText(item.column_values, AGENTS_BOARD.district);
  const isTeamLeader = getColumnText(item.column_values, AGENTS_BOARD.isTeamLeader) === "Yes";
  const appRoleText = isPendingColumn(AGENTS_BOARD.appRole)
    ? null
    : getColumnText(item.column_values, AGENTS_BOARD.appRole);

  return {
    id: item.id,
    name: item.name,
    email: email?.toLowerCase() ?? null,
    phone: phone ? normalizePhone(phone) : null,
    firstNameHebrew: getColumnText(item.column_values, AGENTS_BOARD.firstNameHebrew),
    fullNameEnglish: getColumnText(item.column_values, AGENTS_BOARD.fullNameEnglish),
    surname: getColumnText(item.column_values, AGENTS_BOARD.surname),
    district: district ? Number(district) : null,
    isTeamLeader,
    role: resolveRole({
      appRoleText,
      isTeamLeader,
      contact: matchedContact ?? email ?? phone ?? undefined,
    }),
  };
}

function getColumnText(columns: ColumnValue[], id: string): string | null {
  const col = columns.find((c) => c.id === id);
  return col?.text?.trim() || null;
}

/** Same matching convention as sikkumPigisha: accept "0547929532" or
 *  "+972547929532", normalize to the leading-0 form Monday stores. */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+972")) return "0" + cleaned.slice(4);
  if (cleaned.startsWith("972")) return "0" + cleaned.slice(3);
  return cleaned;
}
