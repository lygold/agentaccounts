/**
 * Domain types returned by the Monday client. These are the clean shapes our
 * pages and validators consume — Monday's `columnValues` quirks stop at the
 * client boundary.
 */

export interface Agent {
  /** Monday pulse / item ID — the canonical identity joining agents across
   *  every board. Always carry this through the session, never just email. */
  id: string;
  /** Item name on the agents board — kept for backwards compatibility / display. */
  name: string;
  email: string;
  phone: string | null;
  firstNameHebrew: string | null;
  fullNameEnglish: string | null;
}

export interface PropertySummary {
  id: string;
  /** Display label for the picker dropdown — built from street + bldg + apt. */
  label: string;
  /** Owner name shown alongside address in the picker. */
  ownerName: string | null;
  street: string | null;
  buildingNumber: string | null;
  apartmentNumber: string | null;
  neighbourhood: string | null;
}

export interface PropertyDetails extends PropertySummary {
  gushChelka: string | null;
  rooms: number | null;
  sizeSqm: number | null;
  price: number | null;
  paymentTerms: string | null;
  dealType: "sale" | "rental" | null;
  /** Existing owner record on the property — used to prefill page 9. */
  owner: {
    name: string | null;
    teudatZehut: string | null;
    phone: string | null;
    email: string | null;
  };
  /** Lawyer for the listing — prefill page 10 if present. */
  ownerLawyer: {
    name: string | null;
    phone: string | null;
    email: string | null;
  };
  /** Agent of record for the listing — used to verify ownership. */
  ownerAgentEmail: string | null;
}

export interface OfferSummary {
  id: string;
  buyer1: { name: string; idNumber: string | null };
  /** Present only for joint offers — second signer on the same offer. */
  buyer2: { name: string; idNumber: string | null } | null;
  propertyAddressText: string | null;
  ownedByText: string | null;
  price: number | null;
}

/** Commission/referral prefill sourced from a picker-selected Properties
 *  listing — owner-commission step only, sale-listing-only for the
 *  commission percentage (see PROPERTIES_BOARD.commission doc comment). */
export interface PropertyCommissionPrefill {
  saleCommissionPercent: number | null;
  vatMode: "plus" | "included" | null;
  referral: {
    agentName: string | null;
    officeName: string | null;
    phone: string | null;
    percent: number | null;
  };
}

export interface ClientSummary {
  id: string;
  /** Monday item name — usually the client's full name. */
  name: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  propertyAddress: string | null;
  clientAddress: string | null;
}

/** ClientSummary plus the raw commission text columns, for the
 *  owner-commission/buyer-commission steps' prefill. Raw because the source
 *  columns are free text on Monday ("2 אחוז", "1 חודשי שכירות") — parsed via
 *  parsePercentText/parseMonthsText in src/lib/commission.ts. */
export interface ClientCommissionSummary extends ClientSummary {
  commissionSaleText: string | null;
  commissionRentalText: string | null;
}

export type ColumnValue = {
  id: string;
  type: string;
  value: string | null;
  text: string | null;
  /** Populated only for board_relation columns via the BoardRelationValue
   *  inline fragment — the standard `value` field is always null for relations.
   *  `name` is only present when the query explicitly requests it (needed for
   *  the referring-agent link, where the linked item's own name IS the
   *  payload — most other board_relation usages only need the id). */
  linked_items?: Array<{ id: string; name?: string }>;
  /** Same data as linked_items, flattened to bare IDs — also only available
   *  via the BoardRelationValue inline fragment. */
  linked_item_ids?: string[];
};

export type RawItem = {
  id: string;
  name: string;
  column_values: ColumnValue[];
};
