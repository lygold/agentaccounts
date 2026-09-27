import "server-only";

/**
 * Short.io link-shortening — infrastructure only, NOT wired into any live
 * code path yet. Per Levi (2026-09-27): the raw /offer/[token] and
 * /offers/[id] buyer links "look wild" (a long localhost/Amplify URL with a
 * UUID token) and he wants this ready to flip on once he's decided exactly
 * where/how to use it — which domain, which links get shortened, whether
 * the short link should mask the token or just the host. Nothing currently
 * calls `shortenUrl` — see e.g. the buyer-link construction in
 * src/app/offers/[id]/page.tsx for where it would plug in, commented out
 * when that decision is made.
 *
 * API: POST https://api.short.io/links, Authorization header = the raw API
 * key (not "Bearer "-prefixed), body {domain, originalURL} -> {shortURL}.
 * SHORT_IO_DOMAIN is the specific short domain configured in the Short.io
 * dashboard (e.g. "al.short.gg"), not short.io itself.
 */
export async function shortenUrl(originalUrl: string): Promise<string> {
  const apiKey = process.env.SHORT_IO_API_KEY;
  const domain = process.env.SHORT_IO_DOMAIN;
  if (!apiKey || !domain) {
    throw new Error("Short.io not configured: set SHORT_IO_API_KEY and SHORT_IO_DOMAIN");
  }

  const res = await fetch("https://api.short.io/links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ domain, originalURL: originalUrl }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Short.io request failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { shortURL?: string };
  if (!data.shortURL) {
    throw new Error("Short.io response had no shortURL");
  }
  return data.shortURL;
}
