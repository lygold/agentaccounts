import "server-only";
import {
  CLIENTS_BOARD,
  CLIENTS_BOARD_ID,
  CLIENT_ROLE_LABELS,
  CONTACTS_BOARD,
  CONTACTS_BOARD_ID,
  CONTACT_ROLE_LABELS,
  PROPERTIES_BOARD,
} from "./columns";
import { mondayQuery } from "../../monday/client";
import { phoneValue, emailValue } from "./deals";
import type { ClientCommissionSummary, ClientSummary, ColumnValue, RawItem } from "./types";
import type { PersonInput } from "../draft";

const CLIENT_COLUMNS = [
  CLIENTS_BOARD.client.phone,
  CLIENTS_BOARD.client.email,
  CLIENTS_BOARD.client.idNumber,
  CLIENTS_BOARD.client.address,
  CLIENTS_BOARD.client.propertyAddress,
  CLIENTS_BOARD.client.propertyCity,
];

/**
 * List clients that belong to the authenticated agent, filtered to a single
 * role on the Signed Contracts board's role column ("Buyer" / "Renter" /
 * "Seller" / "Landlord").
 *
 * SECURITY: agentId MUST come from session.agentId — never from client input.
 *
 * Filters:
 *   - role: server-side, via the column filter below
 *   - agent: verified client-side via connect_boards__1 board_relation
 *
 * Returns ALL matching clients. Callers do further client-side filtering by
 * property address substring and/or free-text name search.
 */
type ClientPage = {
  cursor: string | null;
  items: Array<RawItem & { agent_relation: ColumnValue[] }>;
};

/**
 * Fetches every client matching a role, ownership-filtered and paginated —
 * the shared core `listClientsByRole`/`listClientsWithExtraColumnsByRole`
 * both build on. Returns raw items with agent_relation merged into
 * column_values, same as the rest of this file's helpers.
 */
async function fetchClientsByRole(
  agentId: string,
  role: string,
  extraColumnIds: string[] = [],
): Promise<RawItem[]> {
  const columnIds = [...CLIENT_COLUMNS, ...extraColumnIds]
    .map((c) => `"${c}"`)
    .join(",");

  const filters = [
    { column_id: CLIENTS_BOARD.meta.role, column_values: [role] },
  ];

  const query = /* GraphQL */ `
    query ListClients(
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
          column_values(ids: [${columnIds}]) {
            id
            type
            value
            text
          }
          agent_relation: column_values(ids: ["${CLIENTS_BOARD.meta.agentRelation}"]) {
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

  // Monday caps items_page_by_column_values at 200/request. The Clients board
  // has 200+ items matching "Buyer" alone, so a real agent's clients can sort
  // past the first page and silently vanish from the picker unless we follow
  // the cursor to the end — confirmed live, not theoretical.
  const nextQuery = /* GraphQL */ `
    query NextClients($cursor: String!) {
      next_items_page(limit: 200, cursor: $cursor) {
        cursor
        items {
          id
          name
          column_values(ids: [${columnIds}]) {
            id
            type
            value
            text
          }
          agent_relation: column_values(ids: ["${CLIENTS_BOARD.meta.agentRelation}"]) {
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

  const first = await mondayQuery<{ items_page_by_column_values: ClientPage }>(
    query,
    { boardId: CLIENTS_BOARD_ID, filters },
  );

  let page = first.items_page_by_column_values;
  let rawItems = [...(page?.items ?? [])];
  let cursor = page?.cursor ?? null;

  while (cursor) {
    const next = await mondayQuery<{ next_items_page: ClientPage }>(nextQuery, {
      cursor,
    });
    rawItems = rawItems.concat(next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }

  return rawItems
    .map((item) => ({
      ...item,
      column_values: [...item.column_values, ...(item.agent_relation ?? [])],
    }))
    .filter((item) => belongsToAgent(item, agentId));
}

async function listClientsByRole(
  agentId: string,
  role: string,
): Promise<ClientSummary[]> {
  const items = await fetchClientsByRole(agentId, role);
  return items.map(toClientSummary);
}

const COMMISSION_COLUMNS = [
  CLIENTS_BOARD.client.commissionSale,
  CLIENTS_BOARD.client.commissionRental,
];

async function listClientsWithCommissionByRole(
  agentId: string,
  role: string,
): Promise<ClientCommissionSummary[]> {
  const items = await fetchClientsByRole(agentId, role, COMMISSION_COLUMNS);
  return items.map(toClientCommissionSummary);
}

/** Buyers/renters — role: "Buyer" for sale deals, "Renter" for rental deals. */
export async function listClientsForAgent(
  agentId: string,
  opts: { dealType: "sale" | "rental" },
): Promise<ClientSummary[]> {
  const role =
    opts.dealType === "rental"
      ? CLIENT_ROLE_LABELS.renter
      : CLIENT_ROLE_LABELS.buyer;
  return listClientsByRole(agentId, role);
}

/** Sellers/landlords — role: "Seller" for sale deals, "Landlord" for rental deals. */
export async function listSellersForAgent(
  agentId: string,
  opts: { dealType: "sale" | "rental" },
): Promise<ClientSummary[]> {
  const role =
    opts.dealType === "rental"
      ? CLIENT_ROLE_LABELS.landlord
      : CLIENT_ROLE_LABELS.seller;
  return listClientsByRole(agentId, role);
}

/** Same role selection as listSellersForAgent, plus the raw commission text
 *  columns — for the owner-commission step's prefill. */
export async function listSellersWithCommissionForAgent(
  agentId: string,
  opts: { dealType: "sale" | "rental" },
): Promise<ClientCommissionSummary[]> {
  const role =
    opts.dealType === "rental"
      ? CLIENT_ROLE_LABELS.landlord
      : CLIENT_ROLE_LABELS.seller;
  return listClientsWithCommissionByRole(agentId, role);
}

/** Same role selection as listClientsForAgent, plus the raw commission text
 *  columns — for the buyer-commission step's prefill. */
export async function listBuyersWithCommissionForAgent(
  agentId: string,
  opts: { dealType: "sale" | "rental" },
): Promise<ClientCommissionSummary[]> {
  const role =
    opts.dealType === "rental"
      ? CLIENT_ROLE_LABELS.renter
      : CLIENT_ROLE_LABELS.buyer;
  return listClientsWithCommissionByRole(agentId, role);
}

/**
 * Placeholder: mark a client item as "selected / in use" when an agent picks
 * them from the buyer/renter picker.
 *
 * TODO(v1.5): add the target status column to board 1623367406, then replace
 * this with a real change_simple_column_value mutation (same pattern as
 * setPropertyListingStatus in properties.ts).
 */
export async function notifyClientSelected(itemId: string): Promise<void> {
  // No-op until the column is added to the board.
  console.log(`[Monday] client selected (placeholder): item ${itemId}`);
}

export interface ClientWriteBackPerson {
  input: PersonInput;
  role: keyof typeof CONTACT_ROLE_LABELS;
}

const CONTACT_COLUMNS = [
  CONTACTS_BOARD.contact.firstName,
  CONTACTS_BOARD.contact.lastName,
  CONTACTS_BOARD.contact.phone,
  CONTACTS_BOARD.contact.email,
  CONTACTS_BOARD.contact.idNumber,
  CONTACTS_BOARD.contact.address,
];

type RawContact = RawItem & { property_relation: ColumnValue[] };

/**
 * After a deal is submitted, create-or-update each party on the **contacts**
 * board (1628089139 — distinct from Signed Contracts, which only holds
 * closed deals) so it stays in sync with what was actually filled in on the
 * form. Best-effort per person — one failure doesn't block the others or the
 * caller (call this fire-and-forget, same as setPropertyListingStatus).
 *
 * Matching key: phone number first, name as a fallback — searched across the
 * WHOLE board, not just this agent's own contacts, so a contact who already
 * worked with a colleague gets recognised instead of duplicated.
 *
 * Ownership on this board is NOT a direct column — "Agent" is a read-only
 * mirror computed from whichever property the contact is linked to. So:
 * - Match found AND its linked property's own (real, writable) agent
 *   relation resolves to this agent → update it, but first post the
 *   previous values to the item's Updates feed so nothing is silently lost.
 * - Match found but resolves to a different agent, or no agent at all
 *   (unlinked, or linked property with nobody set) → never touch that
 *   record; create a fresh one instead.
 * - No match at all → create a new record.
 *
 * propertyItemId is only ever a real Properties-board id (the picker path) —
 * manually-entered properties have no board item to link to yet, so those
 * writes simply skip the property link (and therefore won't resolve to an
 * agent via the mirror). That gap is deferred, not silently worked around.
 *
 * Role is only ever SET on create, never overwritten on update — this board
 * tracks contact info across a person's whole history with the office, and a
 * past seller who's now buying shouldn't have that history relabelled.
 */
export async function writeBackClients(
  people: ClientWriteBackPerson[],
  agent: { id: string; name: string },
  propertyItemId: string | null,
): Promise<void> {
  const validPeople = people.filter((p) => p.input.name?.trim());
  if (validPeople.length === 0) return;

  const allContacts = await findAllContactsRaw();

  for (const person of validPeople) {
    try {
      await writeBackOneContact(person, agent, propertyItemId, allContacts);
    } catch (err) {
      console.error(
        `writeBackClients failed for "${person.input.name}":`,
        err,
      );
    }
  }
}

async function findAllContactsRaw(): Promise<RawContact[]> {
  const columnIds = CONTACT_COLUMNS.map((c) => `"${c}"`).join(",");

  // Deliberately unfiltered — a contact could already be on the board under
  // any role (or none) from a past deal with any agent.
  const query = /* GraphQL */ `
    query AllContacts($boardId: ID!) {
      boards(ids: [$boardId]) {
        items_page(limit: 200) {
          cursor
          items {
            id
            name
            column_values(ids: [${columnIds}]) {
              id
              type
              value
              text
            }
            property_relation: column_values(ids: ["${CONTACTS_BOARD.meta.propertyRelation}"]) {
              id
              type
              ... on BoardRelationValue {
                linked_item_ids
              }
            }
          }
        }
      }
    }
  `;
  const nextQuery = /* GraphQL */ `
    query NextAllContacts($cursor: String!) {
      next_items_page(limit: 200, cursor: $cursor) {
        cursor
        items {
          id
          name
          column_values(ids: [${columnIds}]) {
            id
            type
            value
            text
          }
          property_relation: column_values(ids: ["${CONTACTS_BOARD.meta.propertyRelation}"]) {
            id
            type
            ... on BoardRelationValue {
              linked_item_ids
            }
          }
        }
      }
    }
  `;

  type ContactPage = { cursor: string | null; items: RawContact[] };

  const first = await mondayQuery<{
    boards: Array<{ items_page: ContactPage }>;
  }>(query, { boardId: CONTACTS_BOARD_ID });

  let page = first.boards?.[0]?.items_page;
  let rawItems = [...(page?.items ?? [])];
  let cursor = page?.cursor ?? null;

  while (cursor) {
    const next = await mondayQuery<{ next_items_page: ContactPage }>(
      nextQuery,
      { cursor },
    );
    rawItems = rawItems.concat(next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }

  return rawItems;
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Loosely compares phones so "+972547929532" matches "0547929532" — the two
 *  formats this board's historical data and PhoneInput's E.164 output can
 *  disagree on. Requires at least a 9-digit suffix match to avoid false
 *  positives on short/garbage values. */
function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const SUFFIX_LEN = 9;
  if (da.length >= SUFFIX_LEN && db.length >= SUFFIX_LEN) {
    return da.slice(-SUFFIX_LEN) === db.slice(-SUFFIX_LEN);
  }
  return false;
}

function findContactMatch(
  input: PersonInput,
  allContacts: RawContact[],
): RawContact | null {
  if (input.phone) {
    const byPhone = allContacts.find((item) => {
      const existing = textOf(item.column_values, CONTACTS_BOARD.contact.phone);
      return existing && phonesMatch(existing, input.phone!);
    });
    if (byPhone) return byPhone;
  }
  const normName = input.name.trim().toLowerCase();
  if (!normName) return null;
  return (
    allContacts.find((item) => item.name.trim().toLowerCase() === normName) ??
    null
  );
}

const QUERY_PROPERTY_OWNER_AGENT = /* GraphQL */ `
  query PropertyOwnerAgent($ids: [ID!]) {
    items(ids: $ids) {
      column_values(ids: ["${PROPERTIES_BOARD.meta.agentRelation}"]) {
        id
        type
        ... on BoardRelationValue {
          linked_item_ids
        }
      }
    }
  }
`;

/** "Agent" on the contacts board is a read-only mirror of whichever property
 *  the contact is linked to — so ownership can only be resolved by following
 *  that link and reading the PROPERTY's own real agent relation. Returns []
 *  if the contact has no property link, or the linked property has none. */
async function resolveContactOwnerAgentIds(
  contact: RawContact,
): Promise<string[]> {
  const propCol = contact.property_relation?.find(
    (c) => c.id === CONTACTS_BOARD.meta.propertyRelation,
  );
  const propertyId = propCol?.linked_item_ids?.[0];
  if (!propertyId) return [];

  const data = await mondayQuery<{
    items: Array<{ column_values: ColumnValue[] }>;
  }>(QUERY_PROPERTY_OWNER_AGENT, { ids: [propertyId] });
  const agentCol = data.items?.[0]?.column_values?.find(
    (c) => c.id === PROPERTIES_BOARD.meta.agentRelation,
  );
  return (agentCol?.linked_item_ids ?? agentCol?.linked_items?.map((li) => li.id)) ?? [];
}

const FIELD_LABELS_HE: Record<string, string> = {
  phone: "טלפון",
  email: "אימייל",
  idNumber: "תעודת זהות",
};

/** Diffs old-vs-new values for the fields we're about to overwrite. Returns
 *  null if nothing is actually changing (no update posted, no noise). */
function buildChangeSummary(
  old: Record<string, string | null>,
  next: Record<string, string | undefined>,
  agentName: string,
): string | null {
  const lines: string[] = [];
  for (const key of Object.keys(FIELD_LABELS_HE)) {
    const newVal = next[key];
    const oldVal = old[key] ?? null;
    if (newVal !== undefined && newVal !== "" && newVal !== oldVal) {
      lines.push(`${FIELD_LABELS_HE[key]}: "${oldVal ?? "—"}" ← "${newVal}"`);
    }
  }
  if (lines.length === 0) return null;
  return `עודכן אוטומטית מטופס סיכום פגישה חדש (סוכן: ${agentName}). ערכים קודמים שנשמרו:\n${lines.join("\n")}`;
}

const CREATE_UPDATE_MUTATION = /* GraphQL */ `
  mutation CreateClientUpdate($itemId: ID!, $body: String!) {
    create_update(item_id: $itemId, body: $body) {
      id
    }
  }
`;

const UPDATE_COLUMNS_MUTATION = /* GraphQL */ `
  mutation UpdateClientColumns(
    $boardId: ID!
    $itemId: ID!
    $columnValues: JSON!
  ) {
    change_multiple_column_values(
      board_id: $boardId
      item_id: $itemId
      column_values: $columnValues
    ) {
      id
    }
  }
`;

const CREATE_ITEM_MUTATION = /* GraphQL */ `
  mutation CreateClientItem(
    $boardId: ID!
    $itemName: String!
    $columnValues: JSON!
  ) {
    create_item(
      board_id: $boardId
      item_name: $itemName
      column_values: $columnValues
      create_labels_if_missing: false
    ) {
      id
    }
  }
`;

async function writeBackOneContact(
  person: ClientWriteBackPerson,
  agent: { id: string; name: string },
  propertyItemId: string | null,
  allContacts: RawContact[],
): Promise<void> {
  const { input, role } = person;
  const match = findContactMatch(input, allContacts);

  const contactColumns: Record<string, unknown> = {};
  if (input.phone) contactColumns[CONTACTS_BOARD.contact.phone] = phoneValue(input.phone);
  if (input.email) contactColumns[CONTACTS_BOARD.contact.email] = emailValue(input.email);
  if (input.teudatZehut)
    contactColumns[CONTACTS_BOARD.contact.idNumber] = input.teudatZehut;

  const ownerAgentIds = match ? await resolveContactOwnerAgentIds(match) : [];
  const belongsToCurrentAgent = ownerAgentIds.includes(String(agent.id));

  if (match && belongsToCurrentAgent) {
    const oldValues = {
      phone: textOf(match.column_values, CONTACTS_BOARD.contact.phone),
      email: textOf(match.column_values, CONTACTS_BOARD.contact.email),
      idNumber: textOf(match.column_values, CONTACTS_BOARD.contact.idNumber),
    };
    const summary = buildChangeSummary(
      oldValues,
      {
        phone: input.phone,
        email: input.email,
        idNumber: input.teudatZehut,
      },
      agent.name,
    );
    if (summary) {
      await mondayQuery(CREATE_UPDATE_MUTATION, {
        itemId: match.id,
        body: summary,
      });
    }
    if (Object.keys(contactColumns).length > 0) {
      await mondayQuery(UPDATE_COLUMNS_MUTATION, {
        boardId: CONTACTS_BOARD_ID,
        itemId: match.id,
        columnValues: JSON.stringify(contactColumns),
      });
    }
    return;
  }

  // No match, or the match's linked property doesn't resolve to this agent
  // (different agent, or unresolvable) — never write to a record we can't
  // confirm we own; create a fresh one instead.
  const [firstName, ...restName] = input.name.trim().split(/\s+/);
  const lastName = restName.join(" ");

  const createColumns: Record<string, unknown> = {
    ...contactColumns,
    [CONTACTS_BOARD.contact.firstName]: firstName ?? "",
    [CONTACTS_BOARD.meta.role]: { label: CONTACT_ROLE_LABELS[role] },
  };
  if (lastName) createColumns[CONTACTS_BOARD.contact.lastName] = lastName;
  if (propertyItemId) {
    createColumns[CONTACTS_BOARD.meta.propertyRelation] = {
      item_ids: [Number(propertyItemId)],
    };
  }

  await mondayQuery(CREATE_ITEM_MUTATION, {
    boardId: CONTACTS_BOARD_ID,
    itemName: input.name,
    columnValues: JSON.stringify(createColumns),
  });
}

function belongsToAgent(
  item: RawItem & { agent_relation: ColumnValue[] },
  agentId: string,
): boolean {
  const col = item.column_values.find(
    (c) => c.id === CLIENTS_BOARD.meta.agentRelation,
  );
  if (!col) return false;
  return (
    col.linked_items?.some((li) => String(li.id) === String(agentId)) ?? false
  );
}

function toClientSummary(item: RawItem): ClientSummary {
  return {
    id: item.id,
    name: item.name,
    phone: textOf(item.column_values, CLIENTS_BOARD.client.phone),
    email: textOf(item.column_values, CLIENTS_BOARD.client.email),
    idNumber: textOf(item.column_values, CLIENTS_BOARD.client.idNumber),
    propertyAddress: textOf(
      item.column_values,
      CLIENTS_BOARD.client.propertyAddress,
    ),
    clientAddress: textOf(item.column_values, CLIENTS_BOARD.client.address),
  };
}

function toClientCommissionSummary(item: RawItem): ClientCommissionSummary {
  return {
    ...toClientSummary(item),
    commissionSaleText: textOf(item.column_values, CLIENTS_BOARD.client.commissionSale),
    commissionRentalText: textOf(item.column_values, CLIENTS_BOARD.client.commissionRental),
  };
}

function textOf(columns: ColumnValue[], id: string): string | null {
  const col = columns.find((c) => c.id === id);
  const t = col?.text?.trim();
  return t ? t : null;
}
