export type AppRole = "agent" | "team_leader" | "manager" | "admin";

export interface Agent {
  /** Daf Kesher pulse/item ID — canonical identity, same one sikkumPigisha
   *  carries through its own sessions. */
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  firstNameHebrew: string | null;
  fullNameEnglish: string | null;
  surname: string | null;
  /** Team number (Daf Kesher's רובע column) — the team-grouping key. */
  team: number | null;
  isTeamLeader: boolean;
  /** Resolved role — from the (currently pending) app-role Monday column,
   *  or "agent" as the safe default until that column exists. The
   *  BOOTSTRAP_ADMIN allowlist can still promote to "admin" regardless —
   *  see src/lib/auth/roles.ts. */
  role: AppRole;
}

export type ColumnValue = {
  id: string;
  type: string;
  value: string | null;
  text: string | null;
};

export type RawItem = {
  id: string;
  name: string;
  column_values: ColumnValue[];
};
