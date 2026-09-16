/**
 * Column ID map for the Monday boards we touch.
 *
 * Treat this as the single source of truth — never inline a `text_mkqq…` literal
 * anywhere else. If Monday renames or replaces a column, the change happens here.
 *
 * Source: `monday.txt` at the repo root (column dump from a board introspection
 * query) + the Make.com scenario blueprint analysis.
 */

/**
 * Columns on the "Properties Raw Data" board (id from MONDAY_PROPERTIES_BOARD_ID).
 *
 * This board is the LISTINGS board — it is read to populate the property picker.
 * The agent link is a board_relation (connect_boards__1) to the agents board.
 * Ownership filtering is done client-side by checking the linkedPulseIds value.
 *
 * Deal-submission columns (pdfStatus, buyer side, lawyers, etc.) live on a
 * separate deals board and are kept in DEALS_BOARD below.
 */
export const PROPERTIES_BOARD = {
  meta: {
    /** status: "מכירה" / "השכרה" */
    dealType: "color__1",
    /** status: "Active" / "In Negotiation" / "Signed" / etc. */
    listingStatus: "status_1_mkn4k7fk",
    /** board_relation to agents board — used to verify ownership */
    agentRelation: "connect_boards__1",
  },
  property: {
    neighbourhood: "text57__1",
    street: "text37__1",
    buildingNumber: "numeric__1",
    apartmentNumber: "numeric2__1",
    rooms: "numeric6__1",
    sizeSqm: "numeric14__1",
    price: "numeric7__1",
  },
  ownerSide: {
    name: "text615__1",
    /** text type on this board (not a Monday phone column) */
    phone: "text09__1",
    /** text type on this board (not a Monday email column) */
    email: "text08__1",
  },
  /**
   * Commission/referral prefill source for the owner-commission step, sale
   * deals only — confirmed via live board introspection, not columns.ts's
   * own (sometimes stale) history. Deliberately NOT included here:
   * numbers_mkms1wx1 ("Potential Com.") — excluded per explicit product
   * decision, don't "fix" this omission; numeric_mkn7xws9 — a dead duplicate
   * of referralPercent sharing the identical Hebrew title, confirmed empty
   * on every sampled real listing, never read it.
   */
  commission: {
    /** "דמי תיווך מוסכמים באחוזים" — numbers. SALE LISTINGS ONLY: rental
     *  listings sometimes stuff an unrelated "100" placeholder here — never
     *  read this column when the deal is a rental. */
    saleCommissionPercent: "numeric3__1",
    /** "מע"מ" dropdown — live values "פלוס מעמ" / "כולל מעמ", see
     *  STATUS_LABELS.vatMode. */
    vatMode: "dropdown09__1",
    /** "שם סוכן" — board_relation to the Agents board. The linked item's own
     *  name IS the referring-agent name; fetch via linked_items { id name }. */
    referralAgentRelation: "connect_boards2__1",
    /** "שם משרד שלהם" */
    referralOfficeName: "text4__1",
    /** "טלפון של סוכן/משרד/זכיין" */
    referralPhone: "text39__1",
    /** "אחוז ההפניה מהעמלה" */
    referralPercent: "numeric1__1",
  },
} as const;

/**
 * Deal-submission column IDs.  These will live on a dedicated deals board
 * whose ID will be in MONDAY_DEALS_BOARD_ID (v1.5).  They are kept here so
 * createDealItem() can be wired up once that board exists.
 *
 * TODO(v1.5): create the deals board, set MONDAY_DEALS_BOARD_ID, and swap
 * createDealItem() to write there instead of the listings board.
 */
export const DEALS_BOARD = {
  meta: {
    /** status: "Sale" / "Rental" — English labels on the deals board */
    dealType: "color_mkqq4k9k",
    docProduction: "color_mkqqq9mh",
    pdfStatus: "color_mm2xqjmj",
    creationDate: "date_mks18jph",
    expectedSigningDate: "date4",
    weeksToSigning: "numeric_mkqq53kv",
    filledOutBy: "emailjdhsau3q",
    file: "file_mm01mgbq",
    additionalNotes: "long_text_mkqqf3xb",
    officeNotes: "long_text_mkqq88s",
  },
  property: {
    neighbourhood: "text_mkqqnyw4",
    street: "text_mkqqzh4g",
    buildingNumber: "numeric_mkqqagaj",
    apartmentNumber: "numeric_mkqqq98",
    gushChelka: "text_mkqqb594",
    price: "numeric_mkqqvzkn",
    currency: "text_mm3rgz6b",
    paymentTerms: "long_text_mkqq5m8c",
    rooms: "numbero3ds37vr",
    sizeSqm: "numberqt9sr349",
    vacatingDate: "date_mm01e2e8",
  },
  ownerSide: {
    name: "text_mkqqar0q",
    phone: "phone_mkqqvkax",
    email: "email_mkqqcrxf",
    teudatZehut: "numeric_mkqq482m",
    lawyerName: "text_mkqqmze2",
    lawyerPhone: "phone_mkqq2b1q",
    lawyerEmail: "email_mkqqa9jr",
    agentName: "text_mkqqgk15",
    agentPhone: "phone_mkqqa7jc",
    agentEmail: "email_mkqqr78k",
    communicationLang: "color_mkqqxbp3",
    name2: "short_texthf357pq0",
    phone2: "phonet2ie6mga",
    email2: "emailnxmekd5u",
    teudatZehut2: "number02fror5m",
    /** "Just 1 - רק אחד" / "There are 2 - יש שני" / "3 plus - 3 פלוס" */
    ownerCount: "single_select8i73le0",
  },
  buyerSide: {
    name: "text_mkqqh0xz",
    phone: "phone_mkqq4gy2",
    email: "email_mkqqgvze",
    teudatZehut: "numeric_mkqqywqf",
    lawyerName: "text_mkqqxs07",
    lawyerPhone: "phone_mkqqzxc",
    lawyerEmail: "email_mkqq93tx",
    agentName: "text_mkqqscy1",
    agentPhone: "phone_mkqqaj3j",
    agentEmail: "email_mkqqs5vx",
    communicationLang: "color_mkqqrnb7",
    name2: "short_text7w9ytcmj",
    phone2: "phonec4zuvyon",
    email2: "email0c4myqa2",
    teudatZehut2: "numberoodu8igp",
    /** "Just 1 - רק אחד" / "There are 2 - יש שני" / "3 plus - 3 פלוס" */
    buyerCount: "single_selectdfr00td",
  },
  representation: {
    representsOwner: "single_selectce822ol",
    representsBuyer: "single_selectufh65vq",
  },
  /**
   * Commission — internal only, NEVER referenced by the PDF template. Only
   * normalized percentages + referral contact info are columns; the raw
   * entered figures (unit/amount/VAT choice) go into a Monday update
   * instead, not a column — see src/lib/monday/deals.ts.
   *
   * Real IDs, confirmed live on board 1946512255 (Deals_Raw_Data).
   */
  ownerCommission: {
    /** "Owners Comission Percentage" (Numbers) — computeNormalizedCommissionPercent() output. */
    percent: "com_own",
    /** "Referral Details (Owner)" (Text) — formatReferralContact() output. */
    referralName: "text_mm6djmnt",
    /** "Contact of Referral (Owner)" (Phone). */
    referralPhone: "phone_mm6dx5hk",
    /** "Referalls Com" (Numbers) — computeReferralNormalizedPercent() output. */
    referralPercent: "numeric_mm6d8kn6",
  },
  buyerCommission: {
    /** "com 2nd Side" (Numbers). */
    percent: "numeric_mm6dqp9r",
    /** "Referral Details (Buyer)" (Text). */
    referralName: "text_mm6d61gq",
    /** "Referres Phone (Buyer)" (Phone). */
    referralPhone: "phone_mm6dnsq6",
    /** "Referres Com (Buyer)" (Numbers). */
    referralPercent: "numeric_mm6dy1p0",
  },
} as const;

/**
 * Clients / Signed Contracts board (id from MONDAY_CLIENTS_BOARD_ID env var,
 * hardcoded default 1623367406). Used to populate the buyer/renter picker on
 * the buyers wizard page.
 */
export const CLIENTS_BOARD = {
  meta: {
    contractType: "status",          // "haskama" / "biladiut"
    role: "dup__of_status__1",       // "Buyer" / "Seller" / "Renter" / "Landlord"
    agentRelation: "connect_boards__1",
  },
  client: {
    phone: "client_phone",
    email: "client_email",
    idNumber: "text_mkt2cars",
    address: "client_address",
    propertyAddress: "property_address",
    propertyCity: "property_city",
    /** Text, format "<number> אחוז" — populated on both Seller- and
     *  Buyer-role records (commission agreed with THIS client, either side). */
    commissionSale: "commission_sale",
    /** Text, format "<number> חודשי שכירות" — same dual-role behavior,
     *  Landlord/Renter roles instead. */
    commissionRental: "commission_rental",
    /** The signed contract PDF itself (one file per item, confirmed live)
     *  — covers exclusivity/consent-to-commission together, not separate
     *  documents. Used by the property wizard to auto-attach it as a
     *  "forms" upload instead of asking the agent to re-upload it. */
    file: "file_mkt2b0av",
  },
} as const;

export const CLIENTS_BOARD_ID = "1623367406";

export const CLIENT_ROLE_LABELS = {
  buyer: "Buyer",
  renter: "Renter",
  seller: "Seller",
  landlord: "Landlord",
} as const;

/**
 * Contacts board (id 1628089139) — distinct from Signed Contracts above.
 * Signed Contracts only holds people with an actually-signed contract; this
 * board is the general prospect/contact roster, and is what Batch D writes
 * deal parties back to on submit.
 *
 * "Agent" here (mirror_mkmsvjvq) is a MIRROR column, not directly writable —
 * it's computed from whichever Properties Raw Data item this contact is
 * linked to via `propertyRelation`. There is no direct agent link on this
 * board at all, so ownership can only be resolved by following that property
 * link and reading Properties Raw Data's own (directly-writable)
 * agentRelation column (PROPERTIES_BOARD.meta.agentRelation).
 */
export const CONTACTS_BOARD = {
  meta: {
    role: "status", // Hebrew labels — see CONTACT_ROLE_LABELS
    propertyRelation: "connect_boards_mkmesj37", // -> Properties Raw Data
  },
  contact: {
    firstName: "text__1",
    lastName: "text_mkspbqms",
    phone: "client_phone", // type: phone (real Monday phone column)
    email: "client_email", // type: email (real Monday email column)
    idNumber: "text_mkspc8k1",
    address: "text_mksx65k2",
  },
} as const;

export const CONTACTS_BOARD_ID = "1628089139";

export const CONTACT_ROLE_LABELS = {
  buyer: "קונה",
  renter: "שוכר",
  seller: "מוכר",
  landlord: "משכיר",
} as const;

/**
 * Offers board (הצעת מחיר, id 1975354909) — public-facing Monday form clients
 * fill in and sign to make an offer on a property. Property is free text (no
 * link to Properties Raw Data), so matching it against a deal's address has
 * to be fuzzy, same substring approach as the property "did you mean". No
 * phone/email columns exist for the buyer side at all — only name + ID.
 * Agent is a board_relation but is empty on plenty of items (raw incoming
 * form submissions never got linked) — only ever use it to FILTER to items
 * that belong to this agent, never assume it's populated.
 */
export const OFFERS_BOARD = {
  meta: {
    status: "color_mm0k6cfg",
    agentRelation: "board_relation_mm078zx1",
  },
  buyer1: {
    name: "text_mkrawt8y",
    idNumber: "text_mkrvvr1s",
  },
  buyer2: {
    name: "text_mkrvtmwa",
    idNumber: "text_mkrvvpjh",
  },
  property: {
    address: "text_mkrv1z03",
    ownedBy: "text_mkrv1xp2",
  },
  price: "numeric_mkrvv7yc",
} as const;

export const OFFERS_BOARD_ID = "1975354909";

/**
 * Agents board (id 1593085910). Pulse/item ID is the canonical agent identity
 * we carry through the session — it's what joins agents across all the other
 * boards (properties, prospects/signed-contracts). Email is the OTP lookup
 * key; phone is the OTP delivery target; names are for display.
 */
export const AGENTS_BOARD = {
  email: "email__1",
  phone: "phone__1",
  firstNameHebrew: "name__1",
  fullNameEnglish: "text_mm01ab4y",
} as const;

/**
 * Status label values that Monday expects in mutations. These must match the
 * board's existing labels exactly — case + Hebrew chars + spacing.
 */
export const STATUS_LABELS = {
  dealType: {
    /** Must match the exact label text on color__1 of the listings board. */
    sale: "מכירה",
    rental: "השכרה",
  },
  listingStatus: {
    active: "Active",
    inNegotiation: "In Negotiation",
  },
  docProduction: {
    hebrew: "Hebrew - עברית",
    english: "English - אנגלית",
  },
  pdfStatus: {
    buildingPdf: "building pdf",
    manualStepsNecessary: "Manual Steps Necessary",
  },
  communicationLang: {
    hebrew: "Hebrew - עברית",
    english: "English - אנגלית",
  },
  /** Shared by both ownerCount and buyerCount status columns */
  personCount: {
    one: "Just 1 - רק אחד",
    two: "There are 2 - יש שני",
    threeOrMore: "3 plus - 3 פלוס",
  },
  /** Deals board representation columns use bilingual labels */
  representation: {
    yes: "Yes - כן",
    no: "No - לא",
  },
  /** Deal type on the deals board uses English (listings board uses Hebrew) */
  dealTypeDeal: {
    sale: "Sale",
    rental: "Rental",
  },
  /** Offers board (הצעת מחיר) status column — confirmed via live column
   *  settings query, not guessed. Other labels exist ("Not Accepted -
   *  Follow Up", "Rejected - Not Relevant", "Rejected - Too Low") but this
   *  is the only one this app ever writes. */
  offerStatus: {
    accepted: "Accepted",
  },
  /** Properties board "מע"מ" dropdown (PROPERTIES_BOARD.commission.vatMode)
   *  — read-only use (prefill), nothing about VAT is ever written back. */
  vatMode: {
    plus: "פלוס מעמ",
    included: "כולל מעמ",
  },
} as const;

export type DealType = keyof typeof STATUS_LABELS.dealType;
export type DocLanguage = keyof typeof STATUS_LABELS.docProduction;
export type CommunicationLang = keyof typeof STATUS_LABELS.communicationLang;
