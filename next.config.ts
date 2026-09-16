import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Amplify Hosting's Next.js SSR runtime does not load the Amplify console
 * environment variables into `process.env` at request time — only at build
 * time. Writing them to `.env.production` during the build (see amplify.yml)
 * doesn't help either: that file isn't shipped into the compute bundle.
 *
 * So we bake the values the server code reads into the compiled bundle here.
 * `next build` sees the real values (from `.env.local` locally, from the
 * Amplify build environment on CI) and inlines them wherever
 * `process.env.<KEY>` appears. Every consumer of these is a `server-only`
 * module, so nothing is exposed to the browser.
 *
 * NOTE: any *dynamic* `process.env[expr]` lookup is NOT inlined by this —
 * keep server env reads as static `process.env.SOME_KEY` property access
 * (see src/lib/store/dynamo-client.ts).
 */
const SERVER_ENV_KEYS = [
  "SESSION_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "MONDAY_API_TOKEN",
  "MONDAY_AGENTS_BOARD_ID",
  "MONDAY_PROPERTIES_BOARD_ID",
  "MONDAY_DEALS_BOARD_ID",
  "SYNC_SECRET",
  "MONDAY_SYNC_ENABLED",
  "META_WABA_PHONE_ID",
  "META_WABA_TOKEN",
  "META_WABA_TEMPLATE_NAME",
  "META_WABA_TEMPLATE_LANG",
  "MAKE_OTP_WEBHOOK_URL",
  "GREEN_INVOICE_ENV",
  "GREEN_INVOICE_CLIENT_ID",
  "GREEN_INVOICE_CLIENT_SECRET",
  "GREEN_INVOICE_WEBHOOK_SECRET",
  "DYNAMO_REGION",
  "DYNAMODB_TABLE_DEALS",
  "DYNAMODB_TABLE_BILLING",
  "DYNAMODB_TABLE_INCOME",
  "DYNAMODB_TABLE_AGENT_ACCOUNT",
  "DYNAMODB_TABLE_GI_DOCUMENTS",
  "DYNAMODB_TABLE_RECURRING_EXPENSES",
  "DYNAMODB_TABLE_OFFICE_EXPENSES",
  "DYNAMODB_TABLE_BANK_TRANSACTIONS",
  "DYNAMODB_TABLE_BANK_BALANCES",
  "DYNAMODB_TABLE_REMAX_ISRAEL_RECEIPTS",
  "DYNAMODB_TABLE_PROPERTIES",
  "DYNAMODB_TABLE_AGENTS",
  "S3_ATTACHMENTS_BUCKET",
  "BOOTSTRAP_ADMIN_PHONE",
  "BOOTSTRAP_ADMIN_EMAIL",
  "OFFICE_ID",
  "ANTHROPIC_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_DRIVE_PROPERTIES_ROOT_FOLDER_ID",
  "GOOGLE_DRIVE_IMPERSONATE_EMAIL",
  "GOOGLE_MAPS_API_KEY",
  "SECRETARY_PHONE",
  "SECRETARY_EMAIL",
  "MAKE_NOTIFICATION_WEBHOOK_URL",
  "META_WABA_PROPERTY_UPDATE_TEMPLATE_NAME",
  "PROPERTY_NOTIFY_EMAIL_ENABLED",
  "PROPERTY_NOTIFY_WHATSAPP_ENABLED",
] as const;

const bakedServerEnv: Record<string, string> = {};
for (const key of SERVER_ENV_KEYS) {
  const value = process.env[key];
  if (value !== undefined && value !== "") bakedServerEnv[key] = value;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: bakedServerEnv,
  // Next's default server-action body limit is 1MB — the property
  // wizard's media step submits multiple photos/documents in one request
  // (server actions accept File objects in FormData directly), and phone
  // photos alone routinely run 3-5MB each, so the default limit made every
  // submit with any file attached fail. Raised to cover a realistic batch
  // (several photos + forms/documents in one go); if agents hit this in
  // practice, either raise it further or split the media step's request
  // into one submit per file instead of one big multi-file submit.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default withNextIntl(nextConfig);
