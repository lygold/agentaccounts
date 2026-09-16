import "server-only";
import { mondayQuery, getPropertiesBoardId } from "../monday/client";
import { PROPERTIES_BOARD, STATUS_LABELS } from "../wizard/monday/columns";
import { listAgentsByOffice } from "../store/agents";
import { createProperty, listPropertiesByOffice, updateProperty } from "../store/properties";
import { DEFAULT_OFFICE_ID } from "../office";
import { getRedis, RedisKeys } from "../redis";
import type { PropertyRecord } from "../types";

/**
 * Phase 9 — Monday.com sync bridge for properties, same shape as
 * src/lib/sync/agents.ts's Daf Kesher bridge (Phase 4d):
 *
 * INBOUND (`syncPropertiesFromMonday`): pulls every item on the Properties
 * Raw Data board into the `properties` table, so listings that exist the
 * old way (entered directly on Monday, or via the Superform this wizard
 * replaces) show up here too — not just wizard-created ones. Matched by
 * `mondayItemId`; an item whose agentRelation doesn't resolve to a known
 * agent, or whose dealType column isn't a recognized label, is skipped
 * (counted, never guessed at).
 *
 * OUTBOUND (`mirrorPropertyToMonday`): pushes a wizard-created property to
 * the same board, fire-and-forget with a Redis dead-letter on failure —
 * call it right after createProperty() in the wizard's review/actions.ts.
 * Disable with MONDAY_SYNC_ENABLED=false (same flag agents' mirror uses).
 *
 * SCOPE LIMIT: only the fields already reconciled in PROPERTIES_BOARD
 * (src/lib/wizard/monday/columns.ts) round-trip — address, owner contact,
 * commission %/VAT, dealType, rooms/size/price. The wizard's full ~90-field
 * inventory (media, descriptions, technical details, internal ratings) has
 * no reconciled Monday column mapping yet and does NOT sync either
 * direction. Extending this to full fidelity means walking the real board
 * columns and confirming each one live, same as PROPERTIES_BOARD's existing
 * entries were — a separate, larger effort, not attempted here.
 */

interface RawColumn {
  id: string;
  text: string | null;
}
interface RawPropertyItem {
  id: string;
  name: string;
  column_values: RawColumn[];
  agent_relation: Array<{ id: string; linked_items?: Array<{ id: string }> }>;
}

const READ_COLUMN_IDS = [
  PROPERTIES_BOARD.meta.dealType,
  PROPERTIES_BOARD.property.neighbourhood,
  PROPERTIES_BOARD.property.street,
  PROPERTIES_BOARD.property.buildingNumber,
  PROPERTIES_BOARD.property.apartmentNumber,
  PROPERTIES_BOARD.property.rooms,
  PROPERTIES_BOARD.property.sizeSqm,
  PROPERTIES_BOARD.property.price,
  PROPERTIES_BOARD.ownerSide.name,
  PROPERTIES_BOARD.ownerSide.phone,
  PROPERTIES_BOARD.ownerSide.email,
  PROPERTIES_BOARD.commission.saleCommissionPercent,
  PROPERTIES_BOARD.commission.vatMode,
]
  .map((c) => `"${c}"`)
  .join(",");

function text(cols: RawColumn[], id: string): string | null {
  return cols.find((c) => c.id === id)?.text?.trim() || null;
}
function num(cols: RawColumn[], id: string): number | undefined {
  const t = text(cols, id);
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Every item on the Properties Raw Data board, following the cursor past
 *  the page limit — same pagination shape as fetchDafKesherRoster
 *  (src/lib/monday/roster.ts). */
async function fetchAllPropertyItems(): Promise<RawPropertyItem[]> {
  const boardId = getPropertiesBoardId();
  const agentRelationFragment = `agent_relation: column_values(ids: ["${PROPERTIES_BOARD.meta.agentRelation}"]) {
        id
        ... on BoardRelationValue { linked_items { id } }
      }`;

  const first = await mondayQuery<{
    boards: Array<{ items_page: { cursor: string | null; items: RawPropertyItem[] } }>;
  }>(
    /* GraphQL */ `
      query ($boardId: ID!) {
        boards(ids: [$boardId]) {
          items_page(limit: 100) {
            cursor
            items {
              id
              name
              column_values(ids: [${READ_COLUMN_IDS}]) { id text }
              ${agentRelationFragment}
            }
          }
        }
      }
    `,
    { boardId },
  );
  const page = first.boards?.[0]?.items_page;
  if (!page) throw new Error("Properties Raw Data board returned no items_page");

  let items = page.items;
  let cursor = page.cursor;
  while (cursor) {
    const next = await mondayQuery<{
      next_items_page: { cursor: string | null; items: RawPropertyItem[] };
    }>(
      /* GraphQL */ `
        query ($cursor: String!) {
          next_items_page(cursor: $cursor, limit: 100) {
            cursor
            items {
              id
              name
              column_values(ids: [${READ_COLUMN_IDS}]) { id text }
              ${agentRelationFragment}
            }
          }
        }
      `,
      { cursor },
    );
    items = items.concat(next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }
  return items;
}

function dealTypeOf(cols: RawColumn[]): "sale" | "rental" | null {
  const label = text(cols, PROPERTIES_BOARD.meta.dealType);
  if (label === STATUS_LABELS.dealType.sale) return "sale";
  if (label === STATUS_LABELS.dealType.rental) return "rental";
  return null;
}

function vatModeOf(cols: RawColumn[]): "plus" | "included" | undefined {
  const label = text(cols, PROPERTIES_BOARD.commission.vatMode);
  if (label === STATUS_LABELS.vatMode.plus) return "plus";
  if (label === STATUS_LABELS.vatMode.included) return "included";
  return undefined;
}

/** Fields this bridge owns inbound — see the file doc comment's scope limit. */
function mondayOwnedInput(
  item: RawPropertyItem,
  dealType: "sale" | "rental",
): Partial<PropertyRecord> {
  const c = item.column_values;
  return {
    dealType,
    neighbourhood: text(c, PROPERTIES_BOARD.property.neighbourhood) ?? undefined,
    street: text(c, PROPERTIES_BOARD.property.street) ?? undefined,
    buildingNumber: text(c, PROPERTIES_BOARD.property.buildingNumber) ?? undefined,
    apartmentNumber: text(c, PROPERTIES_BOARD.property.apartmentNumber) ?? undefined,
    rooms: num(c, PROPERTIES_BOARD.property.rooms),
    sizeSqm: num(c, PROPERTIES_BOARD.property.sizeSqm),
    askingPrice: num(c, PROPERTIES_BOARD.property.price),
    ownerName: text(c, PROPERTIES_BOARD.ownerSide.name) ?? undefined,
    ownerPhone: text(c, PROPERTIES_BOARD.ownerSide.phone) ?? undefined,
    ownerEmail: text(c, PROPERTIES_BOARD.ownerSide.email) ?? undefined,
    // Sale-only column — see PROPERTIES_BOARD.commission's own doc comment
    // on why this is never read for rentals.
    commissionPercent:
      dealType === "sale" ? num(c, PROPERTIES_BOARD.commission.saleCommissionPercent) : undefined,
    commissionVatMode: vatModeOf(c),
  };
}

function diffMondayOwned(
  cur: PropertyRecord,
  want: Partial<PropertyRecord>,
): Partial<PropertyRecord> {
  const patch: Partial<PropertyRecord> = {};
  for (const key of Object.keys(want) as Array<keyof PropertyRecord>) {
    const v = want[key];
    if (v !== undefined && cur[key] !== v) {
      (patch as Record<string, unknown>)[key] = v;
    }
  }
  return patch;
}

export interface PropertySyncResult {
  created: number;
  updated: number;
  skippedNoAgent: number;
  skippedNoDealType: number;
  unchanged: number;
  errors: string[];
}

/** Pulls every Properties Raw Data item into the `properties` table. */
export async function syncPropertiesFromMonday(
  officeId: string = DEFAULT_OFFICE_ID,
): Promise<PropertySyncResult> {
  const [items, agents, existing] = await Promise.all([
    fetchAllPropertyItems(),
    listAgentsByOffice(officeId, { includeArchived: true }),
    listPropertiesByOffice(officeId),
  ]);

  const agentByMondayId = new Map(
    agents.filter((a) => a.mondayItemId).map((a) => [a.mondayItemId!, a]),
  );
  const propertyByMondayId = new Map(
    existing.filter((p) => p.mondayItemId).map((p) => [p.mondayItemId!, p]),
  );

  const res: PropertySyncResult = {
    created: 0,
    updated: 0,
    skippedNoAgent: 0,
    skippedNoDealType: 0,
    unchanged: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      const dealType = dealTypeOf(item.column_values);
      if (!dealType) {
        res.skippedNoDealType++;
        continue;
      }

      const agentMondayId = item.agent_relation?.[0]?.linked_items?.[0]?.id;
      const agent = agentMondayId ? agentByMondayId.get(String(agentMondayId)) : undefined;
      if (!agent) {
        res.skippedNoAgent++;
        continue;
      }

      const want = mondayOwnedInput(item, dealType);
      const cur = propertyByMondayId.get(String(item.id));

      if (cur) {
        const patch = diffMondayOwned(cur, want);
        if (Object.keys(patch).length === 0) {
          res.unchanged++;
        } else {
          await updateProperty(cur.id, patch, officeId);
          res.updated++;
        }
        continue;
      }

      await createProperty({
        officeId,
        agentId: agent.id,
        agentName: agent.name,
        mondayItemId: String(item.id),
        status: "active",
        ...want,
        dealType,
      });
      res.created++;
    } catch (e) {
      res.errors.push(
        `${item.name} (${item.id}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return res;
}

// --- outbound ----------------------------------------------------------------

function mirrorEnabled(): boolean {
  return process.env.MONDAY_SYNC_ENABLED !== "false";
}

function itemName(property: PropertyRecord): string {
  return (
    [
      property.street,
      property.buildingNumber,
      property.apartmentNumber ? `דירה ${property.apartmentNumber}` : null,
    ]
      .filter(Boolean)
      .join(" ") || "נכס חדש"
  );
}

/** `agentMondayItemId` sets the board_relation column directly in the same
 *  create/update call — {item_ids:[...]} is the confirmed live write shape
 *  for connect_boards columns (see src/lib/wizard/monday/clients.ts's own
 *  contact-creation write for the same pattern). Omitted (not written)
 *  when the agent has no Monday item of their own yet. */
function outboundColumnValues(
  property: PropertyRecord,
  agentMondayItemId?: string,
): Record<string, unknown> {
  const cv: Record<string, unknown> = {
    [PROPERTIES_BOARD.meta.dealType]: {
      label:
        property.dealType === "rental" ? STATUS_LABELS.dealType.rental : STATUS_LABELS.dealType.sale,
    },
    [PROPERTIES_BOARD.meta.listingStatus]: { label: STATUS_LABELS.listingStatus.active },
  };
  if (agentMondayItemId) {
    cv[PROPERTIES_BOARD.meta.agentRelation] = { item_ids: [Number(agentMondayItemId)] };
  }
  if (property.neighbourhood) cv[PROPERTIES_BOARD.property.neighbourhood] = property.neighbourhood;
  if (property.street) cv[PROPERTIES_BOARD.property.street] = property.street;
  if (property.buildingNumber) cv[PROPERTIES_BOARD.property.buildingNumber] = property.buildingNumber;
  if (property.apartmentNumber) cv[PROPERTIES_BOARD.property.apartmentNumber] = property.apartmentNumber;
  if (property.rooms != null) cv[PROPERTIES_BOARD.property.rooms] = property.rooms;
  if (property.sizeSqm != null) cv[PROPERTIES_BOARD.property.sizeSqm] = property.sizeSqm;
  if (property.askingPrice != null) cv[PROPERTIES_BOARD.property.price] = property.askingPrice;
  if (property.ownerName) cv[PROPERTIES_BOARD.ownerSide.name] = property.ownerName;
  if (property.ownerPhone) cv[PROPERTIES_BOARD.ownerSide.phone] = property.ownerPhone;
  if (property.ownerEmail) cv[PROPERTIES_BOARD.ownerSide.email] = property.ownerEmail;
  if (property.dealType === "sale" && property.commissionPercent != null) {
    cv[PROPERTIES_BOARD.commission.saleCommissionPercent] = property.commissionPercent;
  }
  if (property.commissionVatMode) {
    cv[PROPERTIES_BOARD.commission.vatMode] = {
      label:
        property.commissionVatMode === "included"
          ? STATUS_LABELS.vatMode.included
          : STATUS_LABELS.vatMode.plus,
    };
  }
  return cv;
}

async function createPropertyItem(
  property: PropertyRecord,
  agentMondayItemId?: string,
): Promise<string> {
  const data = await mondayQuery<{ create_item: { id: string } }>(
    /* GraphQL */ `
      mutation ($board: ID!, $name: String!, $cv: JSON!) {
        create_item(board_id: $board, item_name: $name, column_values: $cv) {
          id
        }
      }
    `,
    {
      board: getPropertiesBoardId(),
      name: itemName(property),
      cv: JSON.stringify(outboundColumnValues(property, agentMondayItemId)),
    },
  );
  return data.create_item.id;
}

async function updatePropertyItem(property: PropertyRecord, agentMondayItemId?: string): Promise<void> {
  if (!property.mondayItemId) throw new Error("updatePropertyItem: property has no mondayItemId");
  await mondayQuery(
    /* GraphQL */ `
      mutation ($board: ID!, $item: ID!, $cv: JSON!) {
        change_multiple_column_values(board_id: $board, item_id: $item, column_values: $cv) {
          id
        }
      }
    `,
    {
      board: getPropertiesBoardId(),
      item: property.mondayItemId,
      cv: JSON.stringify(outboundColumnValues(property, agentMondayItemId)),
    },
  );
}

/** Push a wizard-created property to the Properties Raw Data board. Never
 *  throws — a failure is dead-lettered to Redis and logged, same pattern
 *  as mirrorAgentToMonday. Call fire-and-forget right after createProperty()
 *  (`void mirrorPropertyToMonday(property)`). */
export async function mirrorPropertyToMonday(property: PropertyRecord): Promise<void> {
  if (!mirrorEnabled()) {
    console.info(`[sync] property mirror disabled — skipped ${property.id}`);
    return;
  }
  try {
    const agents = await listAgentsByOffice(property.officeId, { includeArchived: true });
    const agentMondayItemId =
      agents.find((a) => a.id === property.agentId)?.mondayItemId ?? undefined;

    if (property.mondayItemId) {
      await updatePropertyItem(property, agentMondayItemId);
    } else {
      const mondayItemId = await createPropertyItem(property, agentMondayItemId);
      await updateProperty(property.id, { mondayItemId }, property.officeId);
    }
  } catch (e) {
    const entry = JSON.stringify({
      propertyId: property.id,
      address: itemName(property),
      error: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    });
    console.error("[sync] mirror property to Monday failed:", entry);
    try {
      const redis = getRedis();
      await redis.lpush(RedisKeys.propertyMirrorDeadletter, entry);
      await redis.ltrim(RedisKeys.propertyMirrorDeadletter, 0, 199);
    } catch (redisErr) {
      console.error("[sync] could not dead-letter the failure:", redisErr);
    }
  }
}

export async function propertyMirrorFailureCount(): Promise<number> {
  try {
    return await getRedis().llen(RedisKeys.propertyMirrorDeadletter);
  } catch {
    return 0;
  }
}
