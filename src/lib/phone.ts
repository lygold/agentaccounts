/**
 * Phone normalisation — accept "0547929532" or "+972547929532", store the
 * leading-0 form. Same convention Daf Kesher used, kept for continuity.
 *
 * Deliberately dependency-free (no "server-only") so it's usable anywhere.
 * `src/lib/monday/agents.ts` and `src/lib/auth/roles.ts` still carry their
 * own copies — Monday code is on its way out (ROADMAP Phase 10), not worth
 * churning; new code imports from here.
 */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+972")) return "0" + cleaned.slice(4);
  if (cleaned.startsWith("972")) return "0" + cleaned.slice(3);
  return cleaned;
}

/** Canonical form for a login contact — lowercased email, or normalised phone. */
export function canonicalizeContact(contact: string): string {
  const t = contact.trim();
  return t.includes("@") ? t.toLowerCase() : normalizePhone(t);
}
