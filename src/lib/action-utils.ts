/**
 * Validate a post-login redirect target (the `next` param threaded through
 * /login → /login/otp → verifyOtp, e.g. for the /sikkum deep link into the
 * deal wizard). Must be an internal, single-segment-rooted path — rejects
 * `//evil.com`, `https://evil.com`, and anything not starting with exactly
 * one leading slash, so it can never become an open redirect.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (next.includes("\\") || next.trim() !== next) return null;
  return next;
}

export function isNextJsRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest: string }).digest === "string" &&
    ((e as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (e as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
  );
}
