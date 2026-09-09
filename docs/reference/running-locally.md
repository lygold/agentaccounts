---
name: running-locally
description: How to run agentLedger locally and log in without WhatsApp
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-09-06T10:28:15.272Z
---

`cd D:\Dev\agentLedger\app && npm run dev` → http://localhost:3000
(Next 15, App Router, Turbopack). `.env.local` is complete except
`META_WABA_TOKEN` (blank, not needed in dev).

**Login in dev:** `DEV_OTP_BYPASS_CODE=565656` is set — in dev NODE_ENV no
WhatsApp/email is sent; the real code is printed to the dev-server terminal and
`565656` is also accepted. Enter a phone/email that exists on Daf Kesher; use
`0584602572` or `levi@remaxjerusalem.com` to land as `admin`.

**Must be reachable** (creds in `.env.local`, shared with sikkumPigisha):
Upstash Redis (OTP + rate limit), Monday API (agent lookup + district roster),
AWS DynamoDB eu-north-1 (4 tables + GSIs `byAgentId` / `byDealId`). If `/deals`
bounces to `?error=save`, check the terminal — usually a missing table/GSI or
AWS perms. No infra-as-code in the repo; tables were created manually.

**Tables:** `agent-ledger-deals`, `-billing`, `-income`, `-agent-account`
(renamed from `-ledger-entries` on 2026-09-06 — env var now
`DYNAMODB_TABLE_AGENT_ACCOUNT`; code key `TABLES.agentAccount()`; internal
type stays `AgentLedgerEntry`). billing = bill to client · income = client
payments received · agent-account = the agent's running account with the
office (commission/expenses/payments). The `agent-ledger-app` IAM user is
least-privilege: NO `dynamodb:DescribeTable` (only Get/Put/Query/Scan).
Re-check anytime: `node --env-file=.env.local scripts/check-tables.mjs`
(script runs the real Scan/Query ops, not DescribeTable). Empty "no entries /
no deals yet" screens = empty tables, not a config problem. S3 bucket
`agent-ledger-attachments` not checked / not used yet.

**Seed data to see something:** log in as admin → New deal (type your own
agent name) → open deal → Log payment received → Post commission to agent
ledger. That produces a ledger entry that the dashboard + agent page read.

`npx tsc --noEmit`, `npx next lint`, `npx next build` all pass as of 2026-08-31.

## PENDING: Node upgrade (deferred by Levi 2026-09-02)
Machine runs **Node 20.10.0 via Nodist** (Nodist 0.10.3, unmaintained). Node 20
is EOL (April 2026); AWS SDK v3 warns it needs Node >=22 for releases after
Jan 2027. Everything builds/runs fine on 20 today — this is not urgent and does
NOT block feature work.
Repo is already prepped: `app/package.json` has `engines: ">=22 <25"` (advisory
only — `npm install` prints one harmless EBADENGINE warning on Node 20), and
`app/.nvmrc` = `22` (inert until a version manager is used).
When ready: uninstall Nodist → clean env vars (NODIST_PREFIX, NODIST_X64,
NODE_PATH, PATH segment, in User+Machine scope) → reboot → `winget install
OpenJS.NodeJS.LTS` → verify `where.exe node` has no Nodist path → wipe
node_modules + `npm install`. Same for the sikkumPigisha repo. Amplify: add
`nvm install 22 && nvm use 22` to amplify.yml preBuild.
