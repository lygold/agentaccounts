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
 * Resolves an agent's role. `BOOTSTRAP_ADMIN_PHONE`/`BOOTSTRAP_ADMIN_EMAIL`
 * is a break-glass override so Levi always has admin access even before the
 * Daf Kesher "app role" column exists (or if it's ever misconfigured) — set
 * one or both in .env.local to your own phone/email.
 *
 * Falls back to "team_leader" from the existing "Is Team Leader" flag when
 * the app-role column isn't set for an agent yet, then "agent" as the safe
 * default — never silently grants admin/manager without an explicit source.
 */
export function resolveRole(opts: {
  appRoleText: string | null;
  isTeamLeader: boolean;
  contact?: string;
}): AppRole {
  const { appRoleText, isTeamLeader, contact } = opts;

  if (contact) {
    const normalized = normalizeContact(contact);
    const bootstrapPhone = process.env.BOOTSTRAP_ADMIN_PHONE
      ? normalizePhone(process.env.BOOTSTRAP_ADMIN_PHONE)
      : null;
    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase() ?? null;
    if (
      (bootstrapPhone && normalized === bootstrapPhone) ||
      (bootstrapEmail && normalized === bootstrapEmail)
    ) {
      return "admin";
    }
  }

  if (appRoleText && LABEL_TO_ROLE[appRoleText]) {
    return LABEL_TO_ROLE[appRoleText];
  }

  if (isTeamLeader) return "team_leader";

  return "agent";
}
