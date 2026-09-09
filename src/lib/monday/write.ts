import "server-only";
import { getAgentsBoardId, mondayQuery } from "./client";
import { AGENTS_BOARD } from "./columns";
import type { AgentRecord } from "../types";

/**
 * Write an agent's roster facts back to Daf Kesher (Monday) — the mirror
 * half of the Phase 4d sync bridge. Column value formats verified against a
 * live board item (2026-09). We never write `role` (Daf Kesher has no such
 * column) — role stays app-owned.
 */

const STATUS_ACTIVE = "Active";
const STATUS_ARCHIVED = "Offboarding";

function columnValues(agent: AgentRecord): Record<string, unknown> {
  const cv: Record<string, unknown> = {
    name: agent.name,
    [AGENTS_BOARD.firstNameHebrew]: agent.firstNameHebrew ?? "",
    [AGENTS_BOARD.surname]: agent.surname ?? "",
    [AGENTS_BOARD.fullNameEnglish]: agent.fullNameEnglish ?? "",
    [AGENTS_BOARD.isTeamLeader]: { label: agent.isTeamLeader ? "Yes" : "No" },
    [AGENTS_BOARD.status]: {
      label: agent.status === "archived" ? STATUS_ARCHIVED : STATUS_ACTIVE,
    },
  };
  if (agent.phone) {
    cv[AGENTS_BOARD.phone] = { phone: agent.phone, countryShortName: "IL" };
  }
  if (agent.email) {
    cv[AGENTS_BOARD.email] = { email: agent.email, text: agent.email };
  }
  if (agent.team != null) {
    cv[AGENTS_BOARD.team] = String(agent.team);
  }
  return cv;
}

/** Create a Daf Kesher item for an app-created agent; returns its pulse id. */
export async function createDafKesherItem(agent: AgentRecord): Promise<string> {
  const data = await mondayQuery<{ create_item: { id: string } }>(
    /* GraphQL */ `
      mutation ($board: ID!, $name: String!, $cv: JSON!) {
        create_item(board_id: $board, item_name: $name, column_values: $cv) { id }
      }
    `,
    {
      board: getAgentsBoardId(),
      name: agent.name,
      cv: JSON.stringify(columnValues(agent)),
    },
  );
  return data.create_item.id;
}

/** Push an agent's current roster facts onto its existing Daf Kesher item. */
export async function updateDafKesherItem(agent: AgentRecord): Promise<void> {
  if (!agent.mondayItemId) throw new Error("updateDafKesherItem: agent has no mondayItemId");
  await mondayQuery(
    /* GraphQL */ `
      mutation ($board: ID!, $item: ID!, $cv: JSON!) {
        change_multiple_column_values(board_id: $board, item_id: $item, column_values: $cv) { id }
      }
    `,
    {
      board: getAgentsBoardId(),
      item: agent.mondayItemId,
      cv: JSON.stringify(columnValues(agent)),
    },
  );
}
