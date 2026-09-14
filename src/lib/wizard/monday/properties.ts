import "server-only";
import { PROPERTIES_BOARD, STATUS_LABELS } from "./columns";
import { getPropertiesBoardId, mondayQuery } from "../../monday/client";
import { MondayOwnershipError } from "../../monday/errors";
import type {
  ColumnValue,
  PropertyCommissionPrefill,
  PropertyDetails,
  PropertySummary,
  RawItem,
} from "./types";

/**
 * Columns fetched for the list view (name + owner name is enough to display).
 * connect_boards__1 is included so we can verify agent ownership in code.
 */
const SUMMARY_COLUMNS = [
  PROPERTIES_BOARD.property.street,
  PROPERTIES_BOARD.property.buildingNumber,
  PROPERTIES_BOARD.property.apartmentNumber,
  PROPERTIES_BOARD.property.neighbourhood,
  PROPERTIES_BOARD.ownerSide.name,
  PROPERTIES_BOARD.meta.agentRelation,
];

/**
 * Extra columns fetched when the agent selects a property from the list.
 */
const DETAIL_COLUMNS = [
  ...SUMMARY_COLUMNS,
  PROPERTIES_BOARD.property.rooms,
  PROPERTIES_BOARD.property.sizeSqm,
  PROPERTIES_BOARD.property.price,
  PROPERTIES_BOARD.meta.dealType,
  PROPERTIES_BOARD.ownerSide.phone,
  PROPERTIES_BOARD.ownerSide.email,
];

/**
 * List property listings that belong to the authenticated agent.
 *
 * SECURITY: agentId MUST come from the server-side session (session.agentId),
 * never from a client-supplied value.
 *
 * Monday's board_relation column (connect_boards__1) cannot be used as a
 * server-side filter in items_page_by_column_values, so we:
 *   1. Filter by deal type server-side (status column — supported).
 *   2. Fetch the agentRelation column value for every item.
 *   3. Filter client-side by checking whether agentId is in linkedPulseIds.
 */
export async function listPropertiesForAgent(
  agentId: string,
  opts: { dealType?: "sale" | "rental" } = {},
): Promise<PropertySummary[]> {
  // Exclude agentRelation from the ids list — board_relation columns need an
  // inline fragment instead of the standard value field (value is always null).
  const regularColumnIds = SUMMARY_COLUMNS
    .filter((c) => c !== PROPERTIES_BOARD.meta.agentRelation)
    .map((c) => `"${c}"`)
    .join(",");

  // Build filters. Always restrict to active/in-negotiation listings.
  const filters: Array<{ column_id: string; column_values: string[] }> = [
    {
      column_id: PROPERTIES_BOARD.meta.listingStatus,
      column_values: [
        STATUS_LABELS.listingStatus.active,
        STATUS_LABELS.listingStatus.inNegotiation,
      ],
    },
  ];
  if (opts.dealType) {
    filters.push({
      column_id: PROPERTIES_BOARD.meta.dealType,
      column_values: [STATUS_LABELS.dealType[opts.dealType]],
    });
  }

  // Monday caps items_page(_by_column_values) at 200/request. The board has
  // ~300 items, so real listings can sort past the first page and silently
  // vanish from the picker unless we follow the cursor to the end — same bug
  // class confirmed live on the Clients board (see listClientsForAgent).
  const nextQuery = /* GraphQL */ `
    query NextProperties($cursor: String!) {
      next_items_page(limit: 200, cursor: $cursor) {
        cursor
        items {
          id
          name
          column_values(ids: [${regularColumnIds}]) {
            id
            type
            value
            text
          }
          agent_relation: column_values(ids: ["${PROPERTIES_BOARD.meta.agentRelation}"]) {
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

  type PropertyPage = {
    cursor: string | null;
    items: Array<RawItem & { agent_relation: ColumnValue[] }>;
  };

  async function collectAllPages(firstPage: PropertyPage): Promise<RawItem[]> {
    let rawItems = [...firstPage.items];
    let cursor = firstPage.cursor;
    while (cursor) {
      const next = await mondayQuery<{ next_items_page: PropertyPage }>(
        nextQuery,
        { cursor },
      );
      rawItems = rawItems.concat(next.next_items_page.items);
      cursor = next.next_items_page.cursor;
    }
    return rawItems.map((item) => ({
      ...item,
      column_values: [...item.column_values, ...(item.agent_relation ?? [])],
    }));
  }

  let items: RawItem[];

  if (filters.length > 0) {
    const query = /* GraphQL */ `
      query ListProperties(
        $boardId: ID!
        $filters: [ItemsPageByColumnValuesQuery!]!
      ) {
        items_page_by_column_values(
          limit: 200
          board_id: $boardId
          columns: $filters
        ) {
          cursor
          items {
            id
            name
            column_values(ids: [${regularColumnIds}]) {
              id
              type
              value
              text
            }
            agent_relation: column_values(ids: ["${PROPERTIES_BOARD.meta.agentRelation}"]) {
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
    const data = await mondayQuery<{
      items_page_by_column_values: PropertyPage;
    }>(query, { boardId: getPropertiesBoardId(), filters });
    items = await collectAllPages(
      data.items_page_by_column_values ?? { cursor: null, items: [] },
    );
  } else {
    // No server-side filter — fetch all and filter in code.
    const query = /* GraphQL */ `
      query ListAllProperties($boardId: ID!) {
        boards(ids: [$boardId]) {
          items_page(limit: 200) {
            cursor
            items {
              id
              name
              column_values(ids: [${regularColumnIds}]) {
                id
                type
                value
                text
              }
              agent_relation: column_values(ids: ["${PROPERTIES_BOARD.meta.agentRelation}"]) {
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
    const data = await mondayQuery<{
      boards: Array<{ items_page: PropertyPage }>;
    }>(query, { boardId: getPropertiesBoardId() });
    items = await collectAllPages(
      data.boards?.[0]?.items_page ?? { cursor: null, items: [] },
    );
  }

  return items
    .filter((item) => belongsToAgent(item, agentId))
    .map(toSummary);
}

/**
 * Fetch a single property by id and verify the authenticated agent owns it.
 * Throws MondayOwnershipError (treat as 403) if ownership check fails.
 *
 * SECURITY: agentId MUST come from session.agentId, never from client input.
 */
export async function getPropertyForAgent(
  itemId: string,
  agentId: string,
): Promise<PropertyDetails> {
  const regularDetailIds = DETAIL_COLUMNS
    .filter((c) => c !== PROPERTIES_BOARD.meta.agentRelation)
    .map((c) => `"${c}"`)
    .join(",");
  const query = /* GraphQL */ `
    query GetProperty($ids: [ID!]) {
      items(ids: $ids) {
        id
        name
        column_values(ids: [${regularDetailIds}]) {
          id
          type
          value
          text
        }
        agent_relation: column_values(ids: ["${PROPERTIES_BOARD.meta.agentRelation}"]) {
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
  `;
  const data = await mondayQuery<{
    items: Array<RawItem & { agent_relation: ColumnValue[] }>;
  }>(query, { ids: [itemId] });
  const raw = data.items?.[0];
  const item = raw
    ? {
        ...raw,
        column_values: [
          ...raw.column_values,
          ...(raw.agent_relation ?? []),
        ],
      }
    : undefined;
  if (!item) {
    throw new MondayOwnershipError(`Property ${itemId} not found`);
  }
  if (!belongsToAgent(item, agentId)) {
    throw new MondayOwnershipError(
      `Property ${itemId} does not belong to agent ${agentId}`,
    );
  }
  return toDetails(item);
}

/**
 * Check whether an item's agent board-relation includes the given agentId.
 * Uses linked_items (from the BoardRelationValue inline fragment) — the
 * standard `value` field is always null for board_relation columns.
 */
function belongsToAgent(item: RawItem, agentId: string): boolean {
  const col = item.column_values.find(
    (c) => c.id === PROPERTIES_BOARD.meta.agentRelation,
  );
  if (!col) return false;
  return (
    col.linked_items?.some((li) => String(li.id) === String(agentId)) ?? false
  );
}

function toSummary(item: RawItem): PropertySummary {
  const street = textOf(item.column_values, PROPERTIES_BOARD.property.street);
  const bldg = textOf(item.column_values, PROPERTIES_BOARD.property.buildingNumber);
  const apt = textOf(item.column_values, PROPERTIES_BOARD.property.apartmentNumber);
  const neigh = textOf(item.column_values, PROPERTIES_BOARD.property.neighbourhood);
  const ownerName = textOf(item.column_values, PROPERTIES_BOARD.ownerSide.name);
  const label =
    [street, bldg, apt && `דירה ${apt}`, neigh && `(${neigh})`]
      .filter(Boolean)
      .join(" ") || item.name;
  return {
    id: item.id,
    label,
    ownerName: ownerName ?? null,
    street: street ?? null,
    buildingNumber: bldg ?? null,
    apartmentNumber: apt ?? null,
    neighbourhood: neigh ?? null,
  };
}

function toDetails(item: RawItem): PropertyDetails {
  const summary = toSummary(item);
  const dealLabel = textOf(item.column_values, PROPERTIES_BOARD.meta.dealType);
  const dealType =
    dealLabel === STATUS_LABELS.dealType.sale
      ? "sale"
      : dealLabel === STATUS_LABELS.dealType.rental
        ? "rental"
        : null;

  return {
    ...summary,
    gushChelka: null, // not on this board
    rooms: numberOf(item.column_values, PROPERTIES_BOARD.property.rooms),
    sizeSqm: numberOf(item.column_values, PROPERTIES_BOARD.property.sizeSqm),
    price: numberOf(item.column_values, PROPERTIES_BOARD.property.price),
    paymentTerms: null, // not on this board
    dealType,
    owner: {
      name: textOf(item.column_values, PROPERTIES_BOARD.ownerSide.name),
      teudatZehut: null,
      phone: textOf(item.column_values, PROPERTIES_BOARD.ownerSide.phone),
      email: textOf(item.column_values, PROPERTIES_BOARD.ownerSide.email),
    },
    ownerLawyer: {
      name: null,
      phone: null,
      email: null,
    },
    ownerAgentEmail: null,
  };
}

const COMMISSION_COLUMNS = [
  PROPERTIES_BOARD.commission.saleCommissionPercent,
  PROPERTIES_BOARD.commission.vatMode,
  PROPERTIES_BOARD.commission.referralOfficeName,
  PROPERTIES_BOARD.commission.referralPhone,
  PROPERTIES_BOARD.commission.referralPercent,
];

/**
 * Fetch commission/referral prefill data off a picker-selected listing —
 * separate query from getPropertyForAgent since the property step itself
 * never needs this, only the owner-commission step does.
 *
 * SECURITY: agentId MUST come from session.agentId, never from client input.
 * Throws MondayOwnershipError, same as getPropertyForAgent, if the item
 * doesn't belong to this agent.
 */
export async function getPropertyCommissionPrefill(
  itemId: string,
  agentId: string,
): Promise<PropertyCommissionPrefill> {
  const regularIds = COMMISSION_COLUMNS.map((c) => `"${c}"`).join(",");
  const query = /* GraphQL */ `
    query GetPropertyCommission($ids: [ID!]) {
      items(ids: $ids) {
        id
        column_values(ids: [${regularIds}]) {
          id
          type
          value
          text
        }
        agent_relation: column_values(ids: ["${PROPERTIES_BOARD.meta.agentRelation}"]) {
          id
          type
          ... on BoardRelationValue {
            linked_items {
              id
            }
          }
        }
        referral_agent: column_values(ids: ["${PROPERTIES_BOARD.commission.referralAgentRelation}"]) {
          id
          type
          ... on BoardRelationValue {
            linked_items {
              id
              name
            }
          }
        }
      }
    }
  `;
  const data = await mondayQuery<{
    items: Array<
      RawItem & {
        agent_relation: ColumnValue[];
        referral_agent: ColumnValue[];
      }
    >;
  }>(query, { ids: [itemId] });
  const raw = data.items?.[0];
  if (!raw) {
    throw new MondayOwnershipError(`Property ${itemId} not found`);
  }
  const item = {
    ...raw,
    column_values: [...raw.column_values, ...(raw.agent_relation ?? [])],
  };
  if (!belongsToAgent(item, agentId)) {
    throw new MondayOwnershipError(
      `Property ${itemId} does not belong to agent ${agentId}`,
    );
  }

  const vatText = textOf(item.column_values, PROPERTIES_BOARD.commission.vatMode);
  const vatMode =
    vatText === STATUS_LABELS.vatMode.plus
      ? "plus"
      : vatText === STATUS_LABELS.vatMode.included
        ? "included"
        : null;

  const referralAgent = raw.referral_agent?.find(
    (c) => c.id === PROPERTIES_BOARD.commission.referralAgentRelation,
  );
  const referralAgentName = referralAgent?.linked_items?.[0]?.name ?? null;

  return {
    saleCommissionPercent: numberOf(
      item.column_values,
      PROPERTIES_BOARD.commission.saleCommissionPercent,
    ),
    vatMode,
    referral: {
      agentName: referralAgentName,
      officeName: textOf(item.column_values, PROPERTIES_BOARD.commission.referralOfficeName),
      phone: textOf(item.column_values, PROPERTIES_BOARD.commission.referralPhone),
      percent: numberOf(item.column_values, PROPERTIES_BOARD.commission.referralPercent),
    },
  };
}

/**
 * Change the listingStatus column on a property item.
 * Fire-and-forget from the action — non-fatal if it fails.
 *
 * Monday's change_simple_column_value mutation accepts the label text directly
 * for status columns, which avoids having to know the numeric index.
 */
export async function setPropertyListingStatus(
  itemId: string,
  status: keyof typeof STATUS_LABELS.listingStatus,
): Promise<void> {
  const boardId = getPropertiesBoardId();
  const label = STATUS_LABELS.listingStatus[status];
  const mutation = /* GraphQL */ `
    mutation SetListingStatus($boardId: ID!, $itemId: ID!, $value: String!) {
      change_simple_column_value(
        board_id: $boardId
        item_id: $itemId
        column_id: "${PROPERTIES_BOARD.meta.listingStatus}"
        value: $value
      ) {
        id
      }
    }
  `;
  await mondayQuery(mutation, { boardId, itemId, value: label });
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
