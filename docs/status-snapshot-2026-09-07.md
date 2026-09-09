---
name: current-status
description: START HERE — where the Agent Hub build stands and the immediate next actions (as of 2026-09-07)
metadata: 
  node_type: memory
  type: project
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-09-07T10:24:21.051Z
---

Read [[agent-hub-plan]] for the full program. This file = current state + next steps.

## Where we are: Phase 0 (deploy), mid-flight

**Repo:** `github.com/lygold/agentaccounts` = contents of `D:\Dev\agentLedger\app`
(the `.git` is inside `app/`). Branch `main`. Latest: `39543e0`.
**Deploy target:** new AWS Amplify Hosting app "agentaccounts", Git-connected,
auto-builds on push. Domain `main.d2aqfzo6esnq4n.amplifyapp.com`. Raw URL for now.
**Local dev unchanged:** `npm run dev`, dev OTP bypass `565656` (see [[running-locally]]).

## Done this session (all pushed)

- `4537b23` — role-based access (managers write, agents/team-leaders read-only;
  see [[role-scoping]]); VAT dual amounts on every ledger entry (`amount` incl /
  `amountExVat`); `payment_by_agent` entry type; auto-commission on payment
  ([[commission-auto]]); **service layer** `src/lib/services/{deals,payments,ledger}.ts`
  (actions are thin callers — prep for WhatsApp control layer); `dynamo-client.ts`
  uses Amplify compute-role creds at runtime + static keys locally + `DYNAMO_REGION`
  fallback; renamed table `agent-ledger-ledger-entries` → `agent-ledger-agent-account`
  (env `DYNAMODB_TABLE_AGENT_ACCOUNT`); `scripts/create-tables.mjs`, `check-tables.mjs`;
  Node 22 pin.
- `39543e0` — **`amplify.yml`** (was missing; the Amplify SSR runtime doesn't get
  console env vars unless the build writes them to `.env.production` — the yml
  does `env | grep ... >> .env.production` before `npm run build`; also `nvm install 22`).

## IMMEDIATE NEXT — Phase 0 finish (Levi's actions, then verify)

1. **Amplify build from `39543e0`** — should auto-run on the push. Check the
   build log shows the `env | grep ... >> .env.production` line. If green, the
   Redis "not configured" error is gone.
2. **Create the DynamoDB tables** (Levi, with ADMIN aws creds — the scoped
   `agent-ledger-app` user can't CreateTable):
   ```
   cd D:\Dev\agentLedger\app
   node scripts/create-tables.mjs                                 # 6 new tables + agent-ledger-agent-account
   node --env-file=.env.local scripts/import-weiser.mjs --write   # repopulate David's 67 rows into agent-account
   node --env-file=.env.local scripts/check-tables.mjs            # verify
   ```
3. **IAM compute role** — confirm `agent-ledger-hub-compute` (policy
   `agent-ledger-hub-runtime`: DynamoDB `agent-ledger-*` + S3
   `agent-ledger-attachments`, acct 204529129418) is set as the app's
   **Compute role** (App settings → IAM roles) and that a deploy ran after.
4. **Env vars in Amplify** — set via console; the 6 secrets
   (SESSION_SECRET [use a FRESH one], UPSTASH_REDIS_REST_TOKEN, MONDAY_API_TOKEN,
   META_WABA_TOKEN, GREEN_INVOICE_CLIENT_ID/SECRET) had `REPLACE_IN_CONSOLE`
   placeholders — confirm they hold real values. Real values are in
   `app/.env.local`. Values live in Amplify config → baked into `.env.production`
   each build → read at runtime. Changing one requires a redeploy.
5. **Verify:** hit `/login` → **Email** option (WABA token may still be blank) →
   code → dashboard as admin (via `BOOTSTRAP_ADMIN_EMAIL=levi@remaxjerusalem.com`).
   Then open David Weiser's ledger — balance ₪23,286 incl / ₪19,734 excl.
6. Once verified: delete old table `agent-ledger-ledger-entries` in the console.

## Then: Phase 1 (next code work)

The Monday ⇄ DynamoDB dual-write bridge + 2026-forward backfill. See
[[agent-hub-plan]] Phase 1. New tables `signed-contracts`, `properties`, `offers`,
`referrals`, `deal-notes`, `gi-documents` (created by `create-tables.mjs` already).

## Still OPEN — need Levi / external (don't block Phase 0-1)

- RE/MAX Israel receipts money path · signed-form email parsing (which forms,
  addresses, structure; are the 3 signing programs' Make scenarios shareable) ·
  Offers Google Form (forms.gle/D1XK8vxst8R7dsN2A) + its Make scenarios ·
  per-deal payment lifecycle states · notification list + wording · GI webhook
  availability · mirrorIn transport (webhook vs poll). Full list in [[agent-hub-plan]].

## Gotchas learned

- Amplify Hosting: console env vars DON'T reach Next.js SSR runtime — must write
  to `.env.production` in the build (`amplify.yml`). sikkumPigisha's own
  `amplify.yml` is the reference.
- Amplify "Secrets" feature: doesn't reliably inject to SSR runtime either — use
  Environment variables.
- Don't set `AWS_*` env vars on Amplify — compute role provides them; app skips
  explicit creds when `AWS_SESSION_TOKEN` is present.
- `git push` is blocked by the session's permission classifier — Levi runs it.
- `weiser-import-data.json` / `build-weiser-data.py` / `import-weiser.mjs` are
  gitignored (`scripts/*weiser*`) — real client data, local only.
- Plan artifact: https://claude.ai/code/artifact/c9742cfc-4618-47f9-a991-1f0f26f4dd9e
  Plan file: `C:\Users\Levi\.claude\plans\pdf-fidelity-doesnt-flickering-hartmanis.md`
