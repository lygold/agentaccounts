/**
 * Phase 6 discovery — one-off against the Green Invoice SANDBOX. Auths with
 * the .env.local sandbox creds, then does whatever the first CLI arg says:
 *
 *   node --env-file=.env.local scripts/gi-sandbox-poke.mjs create-300
 *   node --env-file=.env.local scripts/gi-sandbox-poke.mjs get <documentId>
 *   node --env-file=.env.local scripts/gi-sandbox-poke.mjs list
 *
 * create-300: makes a test client + a חשבון עסקה (type 300) so a human can
 * issue a חשבונית מס-קבלה (320) against it in the GI UI and we can watch the
 * "document created" webhook fire for both.
 *
 * Nothing here touches DynamoDB or the app. Sandbox only.
 */
const CMD = process.argv[2];
const ARG = process.argv[3];

const clientId = process.env.GREEN_INVOICE_CLIENT_ID;
const clientSecret = process.env.GREEN_INVOICE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set GREEN_INVOICE_CLIENT_ID / _SECRET (run with --env-file=.env.local)");
  process.exit(2);
}
if (process.env.GREEN_INVOICE_ENV === "production") {
  console.error("Refusing to run against production. Unset GREEN_INVOICE_ENV or set it to sandbox.");
  process.exit(2);
}

const TOKEN_URL = "https://api.sandbox.morning.dev/idp/v1/oauth/token";
const BASE = "https://sandbox.d.greeninvoice.co.il/api/v1";

async function token() {
  // Mirrors src/lib/green-invoice/client.ts exactly.
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).accessToken;
}

async function api(tok, path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}`, ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 800)}`);
  return body;
}

const tok = await token();
console.log("auth ok\n");

if (CMD === "create-300") {
  // ARG can be an existing client id to reuse.
  let clientRef = ARG;
  if (!clientRef) {
    try {
      const client = await api(tok, "/clients", {
        method: "POST",
        body: JSON.stringify({
          name: `Webhook Test ${Date.now()}`,
          emails: ["webhook-test@example.com"],
        }),
      });
      clientRef = client.id;
      console.log("client (new):", client.id, client.name);
    } catch (e) {
      // errorCode 1010 = client with that name exists; message carries its id.
      const m = String(e.message).match(/"errorMessage":"([0-9a-f-]{36})"/);
      if (!m) throw e;
      clientRef = m[1];
      console.log("client (existing):", clientRef);
    }
  } else {
    console.log("client (reused):", clientRef);
  }
  const client = { id: clientRef };

  const AMOUNT_INCL = 11700; // ₪10,000 + 18% VAT
  const doc = await api(tok, "/documents", {
    method: "POST",
    body: JSON.stringify({
      type: 300,
      lang: "he",
      currency: "ILS",
      client: { id: client.id },
      income: [
        {
          description: "Webhook discovery — test commission line",
          quantity: 1,
          price: AMOUNT_INCL / 1.18,
          currency: "ILS",
          vatType: 0,
        },
      ],
      remarks: "Test חשבון עסקה created via API for webhook discovery. Safe to delete.",
    }),
  });
  console.log("\n--- חשבון עסקה (300) created ---");
  console.log(JSON.stringify(doc, null, 2));
  console.log(`\nNext: in the GI sandbox UI, issue a חשבונית מס-קבלה (320) against document ${doc.id}`);
  console.log(`Then:  node --env-file=.env.local scripts/gi-sandbox-poke.mjs get ${doc.id}`);
} else if (CMD === "get") {
  if (!ARG) throw new Error("usage: get <documentId>");
  const doc = await api(tok, `/documents/${ARG}`, { method: "GET" });
  console.log(JSON.stringify(doc, null, 2));
} else if (CMD === "list") {
  const list = await api(tok, "/documents/search", {
    method: "POST",
    body: JSON.stringify({ pageSize: 15, sort: "creationDate", }),
  });
  for (const d of list.items ?? []) {
    console.log(`${d.id}  type ${d.type}  #${d.number ?? "-"}  ${d.amount ?? "?"} ${d.currency ?? ""}  ${d.description ?? ""}`);
  }
} else {
  console.log("commands: create-300 | get <id> | list");
}
