import "server-only";
import { OFFERS_BOARD, OFFERS_BOARD_ID, STATUS_LABELS } from "./columns";
import { mondayQuery } from "../../monday/client";
import type { ColumnValue, OfferSummary, RawItem } from "./types";

const OFFER_COLUMN_IDS = [
  OFFERS_BOARD.buyer1.name,
  OFFERS_BOARD.buyer1.idNumber,
  OFFERS_BOARD.buyer2.name,
  OFFERS_BOARD.buyer2.idNumber,
  OFFERS_BOARD.property.address,
  OFFERS_BOARD.property.ownedBy,
  OFFERS_BOARD.price,
]
  .map((c) => `"${c}"`)
  .join(",");

/**
 * List offers on the הצעת מחיר board that belong to the given agent —
 * filtered by the Agent board_relation, same ownership pattern as
 * listPropertiesForAgent/listClientsForAgent. Offers with no agent link at
 * all (raw incoming form submissions that were never linked) are excluded,
 * not defaulted to visible — an unlinked offer isn't provably this agent's.
 */
export async function listOffersForAgent(
  agentId: string,
): Promise<OfferSummary[]> {
  type OfferPage = {
    cursor: string | null;
    items: Array<RawItem & { agent_relation: ColumnValue[] }>;
  };

  const query = /* GraphQL */ `
    query ListOffers($boardId: ID!) {
      boards(ids: [$boardId]) {
        items_page(limit: 200) {
          cursor
          items {
            id
            name
            column_values(ids: [${OFFER_COLUMN_IDS}]) {
              id
              type
              value
              text
            }
            agent_relation: column_values(ids: ["${OFFERS_BOARD.meta.agentRelation}"]) {
              id
              type
              ... on BoardRelationValue {
                linked_items {
                  id
                }
              }
            }
          }
        }
      }
    }
  `;
  const nextQuery = /* GraphQL */ `
    query NextOffers($cursor: String!) {
      next_items_page(limit: 200, cursor: $cursor) {
        cursor
        items {
          id
          name
          column_values(ids: [${OFFER_COLUMN_IDS}]) {
            id
            type
            value
            text
          }
          agent_relation: column_values(ids: ["${OFFERS_BOARD.meta.agentRelation}"]) {
            id
            type
            ... on BoardRelationValue {
              linked_items {
                id
              }
            }
          }
        }
      }
    }
  `;

  const first = await mondayQuery<{
    boards: Array<{ items_page: OfferPage }>;
  }>(query, { boardId: OFFERS_BOARD_ID });

  let page = first.boards?.[0]?.items_page;
  let rawItems = [...(page?.items ?? [])];
  let cursor = page?.cursor ?? null;

  while (cursor) {
    const next = await mondayQuery<{ next_items_page: OfferPage }>(
      nextQuery,
      { cursor },
    );
    rawItems = rawItems.concat(next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }

  return rawItems.filter((item) => belongsToAgent(item, agentId)).map(toOfferSummary);
}

/** Same pattern as belongsToAgent in properties.ts — linked_items is only
 *  populated via the BoardRelationValue inline fragment, the plain `value`
 *  field is always null for board_relation columns. */
function belongsToAgent(
  item: RawItem & { agent_relation: ColumnValue[] },
  agentId: string,
): boolean {
  const col = item.agent_relation?.find(
    (c) => c.id === OFFERS_BOARD.meta.agentRelation,
  );
  if (!col) return false;
  return (
    col.linked_items?.some((li) => String(li.id) === String(agentId)) ?? false
  );
}

/**
 * Mark an offer as Accepted once the agent has submitted a deal built from
 * it. Fire-and-forget from the review submit, same pattern as
 * setPropertyListingStatus — non-fatal if it fails.
 */
export async function setOfferStatus(
  itemId: string,
  status: keyof typeof STATUS_LABELS.offerStatus,
): Promise<void> {
  const label = STATUS_LABELS.offerStatus[status];
  const mutation = /* GraphQL */ `
    mutation SetOfferStatus($boardId: ID!, $itemId: ID!, $value: String!) {
      change_simple_column_value(
        board_id: $boardId
        item_id: $itemId
        column_id: "${OFFERS_BOARD.meta.status}"
        value: $value
      ) {
        id
      }
    }
  `;
  await mondayQuery(mutation, { boardId: OFFERS_BOARD_ID, itemId, value: label });
}

function toOfferSummary(item: RawItem): OfferSummary {
  const buyer1Name = textOf(item.column_values, OFFERS_BOARD.buyer1.name);
  const buyer2Name = textOf(item.column_values, OFFERS_BOARD.buyer2.name);
  return {
    id: item.id,
    buyer1: {
      name: buyer1Name ?? "",
      idNumber: textOf(item.column_values, OFFERS_BOARD.buyer1.idNumber),
    },
    buyer2: buyer2Name
      ? {
          name: buyer2Name,
          idNumber: textOf(item.column_values, OFFERS_BOARD.buyer2.idNumber),
        }
      : null,
    propertyAddressText: textOf(item.column_values, OFFERS_BOARD.property.address),
    ownedByText: textOf(item.column_values, OFFERS_BOARD.property.ownedBy),
    price: numberOf(item.column_values, OFFERS_BOARD.price),
  };
}

function textOf(columns: ColumnValue[], id: string): string | null {
  const col = columns.find((c) => c.id === id);
  const t = col?.text?.trim();
  return t ? t : null;
}

function numberOf(columns: ColumnValue[], id: string): number | null {
  const t = textOf(columns, id);
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
