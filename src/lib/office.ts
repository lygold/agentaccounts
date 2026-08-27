import "server-only";

/**
 * Single hard-coded office until a second one actually exists. Every table
 * row and session carries `officeId` from day one specifically so that,
 * whenever office #2 (or a customer's office) shows up, it's a matter of
 * setting a different value here/env — not a data migration to backfill a
 * column that was never there. See the plan file's "Multi-tenancy" section.
 */
export const DEFAULT_OFFICE_ID = process.env.OFFICE_ID ?? "remax-jerusalem";
