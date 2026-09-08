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
  "META_WABA_PHONE_ID",
  "META_WABA_TOKEN",
  "META_WABA_TEMPLATE_NAME",
  "META_WABA_TEMPLATE_LANG",
  "MAKE_OTP_WEBHOOK_URL",
  "GREEN_INVOICE_ENV",
  "GREEN_INVOICE_CLIENT_ID",
  "GREEN_INVOICE_CLIENT_SECRET",
  "DYNAMO_REGION",
  "DYNAMODB_TABLE_DEALS",
  "DYNAMODB_TABLE_BILLING",
  "DYNAMODB_TABLE_INCOME",
  "DYNAMODB_TABLE_AGENT_ACCOUNT",
  "S3_ATTACHMENTS_BUCKET",
  "BOOTSTRAP_ADMIN_PHONE",
  "BOOTSTRAP_ADMIN_EMAIL",
  "OFFICE_ID",
] as const;

const bakedServerEnv: Record<string, string> = {};
for (const key of SERVER_ENV_KEYS) {
  const value = process.env[key];
  if (value !== undefined && value !== "") bakedServerEnv[key] = value;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: bakedServerEnv,
};

export default withNextIntl(nextConfig);
