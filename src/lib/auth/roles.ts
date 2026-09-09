import "server-only";
import { APP_ROLE_LABELS } from "../monday/columns";
import type { AppRole } from "../monday/types";

const LABEL_TO_ROLE: Record<string, AppRole> = Object.fromEntries(
  Object.entries(APP_ROLE_LABELS).map(([role, label]) => [label, role as AppRole]),
);

/** Deliberately duplicated (not imported) from monday/agents.ts to avoid a
 *  circular import — that module imports resolveRole from this one. */
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+972")) return "0" + cleaned.slice(4);
  if (cleaned.startsWith("972")) return "0" + cleaned.slice(3);
  return cleaned;
}

function normalizeContact(contact: string): string {
  const c = contact.trim();
  return c.includes("@") ? c.toLowerCase() : normalizePhone(c);
}

/**
 * Break-glass admin override. `BOOTSTRAP_ADMIN_PHONE` / `BOOTSTRAP_ADMIN_EMAIL`
 * (set one or both in the env) always resolve to `admin`, even if the agent
 * row / Daf Kesher says otherwise — so Levi can never lock himself out.
 * Applied at login (src/lib/auth/actions.ts) on top of the stored role.
 */
export function isBootstrapAdmin(contact: string | null | undefined): boolean {
  if (!contact) return false;
  const normalized = normalizeContact(contact);
  const bootstrapPhone = process.env.BOOTSTRAP_ADMIN_PHONE
    ? normalizePhone(process.env.BOOTSTRAP_ADMIN_PHONE)
    : null;
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase() ?? null;
  return (
    (!!bootstrapPhone && normalized === bootstrapPhone) ||
    (!!bootstrapEmail && normalized === bootstrapEmail)
  );
}

/**
 * Resolves an agent's role from Daf Kesher data — used only by the Monday
 * import path now (src/lib/monday/agents.ts + import-agents-from-monday.mjs).
 * Once an agent lives in the `agents` table the role is read straight off the
 * row; see [[isBootstrapAdmin]] for the login-time override.
 *
 * Falls back to "team_leader" from the "Is Team Leader" flag when the
 * (still nonexistent) app-role column isn't set, then "agent" — never
 * silently grants admin/manager without an explicit source.
 */
export function resolveRole(opts: {
  appRoleText: string | null;
  isTeamLeader: boolean;
  contact?: string;
}): AppRole {
  const { appRoleText, isTeamLeader, contact } = opts;

  if (isBootstrapAdmin(contact)) return "admin";

  if (appRoleText && LABEL_TO_ROLE[appRoleText]) {
    return LABEL_TO_ROLE[appRoleText];
  }

  if (isTeamLeader) return "team_leader";

  return "agent";
}
