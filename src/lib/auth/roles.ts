import "server-only";
import { normalizePhone } from "../phone";

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

