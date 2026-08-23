/**
 * Daf Kesher (board 1593085910) — the shared agent-identity board. Same
 * board sikkumPigisha's own MONDAY_AGENTS_BOARD_ID points to; read-only
 * from this app. IDs confirmed live 2026-08-22.
 */
export const AGENTS_BOARD = {
  name: "name",
  phone: "phone__1",
  email: "email__1",
  firstNameHebrew: "name__1",
  fullNameEnglish: "text_mm01ab4y",
  surname: "surname__1",
  status: "status__1",
  /** רובע — district number, doubles as the team-grouping key. */
  district: "numeric_mm0dwhxf",
  /** "Is Team Leader" status column, labels Yes/No. */
  isTeamLeader: "color_mm1j9dvy",
  /**
   * TODO(agent-ledger-roles): does not exist yet. Levi needs to add a
   * status/dropdown column to Daf Kesher with labels Agent / Team Leader /
   * Manager / Admin, then swap this placeholder for the real column id —
   * same pattern sikkumPigisha's commission columns went through. Until
   * then, isPendingColumn() guards this read and every agent resolves to
   * the "agent" role unless BOOTSTRAP_ADMIN_PHONE/EMAIL matches (see
   * src/lib/auth/roles.ts).
   */
  appRole: "__PENDING_appRole__",
} as const;

export const APP_ROLE_LABELS = {
  agent: "Agent",
  team_leader: "Team Leader",
  manager: "Manager",
  admin: "Admin",
} as const;

export function isPendingColumn(id: string): boolean {
  return id.startsWith("__PENDING_");
}
