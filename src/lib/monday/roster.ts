import "server-only";
import { getAgentsBoardId, mondayQuery } from "./client";
import { AGENTS_BOARD } from "./columns";
import { normalizePhone } from "../phone";

/** One agent as it stands on Daf Kesher — the roster facts the app mirrors. */
export interface DafKesherAgent {
  mondayItemId: string;
  name: string;
  email: string | null;
  phone: string | null;
  firstNameHebrew: string | null;
  fullNameEnglish: string | null;
  surname: string | null;
  team: number | null;
  isTeamLeader: boolean;
  /** Raw Status label: Active | Onboarding | Inactive | Offboarding. */
  mondayStatus: string | null;
}

const COL_IDS = [
  AGENTS_BOARD.phone,
  AGENTS_BOARD.email,
  AGENTS_BOARD.firstNameHebrew,
  AGENTS_BOARD.fullNameEnglish,
  AGENTS_BOARD.surname,
  AGENTS_BOARD.team,
  AGENTS_BOARD.status,
  AGENTS_BOARD.isTeamLeader,
]
  .map((c) => `"${c}"`)
  .join(",");

type RawItem = {
  id: string;
  name: string;
  column_values: Array<{ id: string; text: string | null }>;
};

function text(cols: RawItem["column_values"], id: string): string | null {
  return cols.find((c) => c.id === id)?.text?.trim() || null;
}

function toAgent(item: RawItem): DafKesherAgent {
  const c = item.column_values;
  const teamText = text(c, AGENTS_BOARD.team);
  const email = text(c, AGENTS_BOARD.email);
  const phone = text(c, AGENTS_BOARD.phone);
  return {
    mondayItemId: String(item.id),
    name: item.name,
    email: email ? email.toLowerCase() : null,
    phone: phone ? normalizePhone(phone) : null,
    firstNameHebrew: text(c, AGENTS_BOARD.firstNameHebrew),
    fullNameEnglish: text(c, AGENTS_BOARD.fullNameEnglish),
    surname: text(c, AGENTS_BOARD.surname),
    team: teamText ? Number(teamText) : null,
    isTeamLeader: text(c, AGENTS_BOARD.isTeamLeader) === "Yes",
    mondayStatus: text(c, AGENTS_BOARD.status),
  };
}

/** Every agent item on Daf Kesher, following the cursor past the 100-item page. */
export async function fetchDafKesherRoster(): Promise<DafKesherAgent[]> {
  const boardId = getAgentsBoardId();
  const first = await mondayQuery<{
    boards: Array<{ items_page: { cursor: string | null; items: RawItem[] } }>;
  }>(
    /* GraphQL */ `
      query ($boardId: ID!) {
        boards(ids: [$boardId]) {
          items_page(limit: 100) {
            cursor
            items { id name column_values(ids: [${COL_IDS}]) { id text } }
          }
        }
      }
    `,
    { boardId },
  );
  const page = first.boards?.[0]?.items_page;
  if (!page) throw new Error("Daf Kesher board returned no items_page");

  let items = page.items;
  let cursor = page.cursor;
  while (cursor) {
    const next = await mondayQuery<{
      next_items_page: { cursor: string | null; items: RawItem[] };
    }>(
      /* GraphQL */ `
        query ($cursor: String!) {
          next_items_page(cursor: $cursor, limit: 100) {
            cursor
            items { id name column_values(ids: [${COL_IDS}]) { id text } }
          }
        }
      `,
      { cursor },
    );
    items = items.concat(next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }
  return items.map(toAgent);
}
