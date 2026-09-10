/**
 * Daf Kesher (board 1593085910, "Daf Kesher") — the shared agent directory
 * the app imports from and mirrors back during the migration bridge. Column
 * ids confirmed live 2026-09-10.
 *
 * There is no "app role" column — role is app-owned (`AgentRecord.role`, set
 * in /admin/agents, `BOOTSTRAP_ADMIN_*` as break-glass). `comm` is the
 * commission *tier*, not the role.
 */
export const AGENTS_BOARD = {
  name: "name",
  phone: "phone__1",
  email: "email__1",
  firstNameHebrew: "name__1",
  fullNameEnglish: "text_mm01ab4y",
  surname: "surname__1",
  status: "status__1",
  /** רובע — the team-grouping key (surfaced app-wide as "team"). */
  team: "numeric_mm0dwhxf",
  /** "Is Team Leader" status column, labels Yes/No. */
  isTeamLeader: "color_mm1j9dvy",
  /** "Charge Date" — when the agent starts paying monthly expenses. Blank
   *  (most active agents) = already past due → charge from now. */
  chargeDate: "date_mkqxg29d",
  /** "Commission Tier" — a number, 50 or 60 (the agent's starting %). 50 =
   *  the standard 50/55/60 bracket table, 60 = flat 60. */
  commissionTier: "comm",
  /** "License Number" (מספר רישיון תיווך). */
  licenseNumber: "text_mkzy35r6",
  /** "Virtual Num Yad2" — the agent's Yad2 virtual phone; matches a Yad2
   *  ad-report row to the agent for the bulk expense import. */
  yad2Number: "yad2",
  /** "Virtual Num Madlan" — same, for Madlan. */
  madlanNumber: "madlan",
} as const;
