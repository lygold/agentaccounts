import "server-only";

/**
 * Green Invoice (rebranded "Morning") REST API — OAuth2 client-credentials.
 * Two full environments, each with its own client_id/secret: sandbox
 * (default, build/test here first per the roadmap plan) and production.
 *
 * Note: the token endpoint lives on a different domain (api.morning.co /
 * api.sandbox.morning.dev) than the resource API (api.greeninvoice.co.il) —
 * confirmed against the real docs, not a typo. Worth a quick live sanity
 * check once real sandbox credentials are in, before trusting this blindly.
 */

interface GreenInvoiceConfig {
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

function getConfig(): GreenInvoiceConfig {
  // The GI secret is full of shell/URL-hostile characters (% } : + * ") and
  // reliably picks up a stray leading space or loses a trailing brace when
  // pasted into the Amplify console — trim defensively.
  const isProduction = process.env.GREEN_INVOICE_ENV?.trim() === "production";
  const clientId = process.env.GREEN_INVOICE_CLIENT_ID?.trim();
  const clientSecret = process.env.GREEN_INVOICE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Green Invoice not configured: set GREEN_INVOICE_CLIENT_ID and GREEN_INVOICE_CLIENT_SECRET",
    );
  }
  return isProduction
    ? {
        baseUrl: "https://api.greeninvoice.co.il/api/v1",
        tokenUrl: "https://api.morning.co/idp/v1/oauth/token",
        clientId,
        clientSecret,
      }
    : {
        baseUrl: "https://sandbox.d.greeninvoice.co.il/api/v1",
        tokenUrl: "https://api.sandbox.morning.dev/idp/v1/oauth/token",
        clientId,
        clientSecret,
      };
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 30 > nowSeconds) {
    return cachedToken.accessToken;
  }

  const cfg = getConfig();
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green Invoice auth failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as { accessToken: string; tokenType: string; expiresAt: number };
  cachedToken = { accessToken: data.accessToken, expiresAt: data.expiresAt };
  return data.accessToken;
}

export async function greenInvoiceFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = getConfig();
  const token = await getAccessToken();
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green Invoice API error (${res.status}) on ${path}: ${text.slice(0, 500)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
