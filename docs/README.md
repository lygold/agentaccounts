# docs/

> **The canonical plan is [`../ROADMAP.md`](../ROADMAP.md).** Start there.
> Where anything here disagrees with ROADMAP.md, ROADMAP.md wins.

## `reference/` — current, accurate notes

| File | What it is |
|---|---|
| [`running-locally.md`](reference/running-locally.md) | Dev setup, OTP bypass `565656`, tables, what must be reachable, the pending Node 20→22 upgrade |
| [`role-scoping.md`](reference/role-scoping.md) | How dashboard / deals / ledger are gated by role (agent / team_leader / manager / admin) |
| [`commission-auto.md`](reference/commission-auto.md) | Payment → auto-posted bracket-blended commission; the VAT dual-amount model; tier tables |
| [`weiser-import.md`](reference/weiser-import.md) | The David Weiser 2026 migration — sources, mapping, scripts, the `payment_by_agent` type it added |
| [`deals-identity-gap.md`](reference/deals-identity-gap.md) | Deals store a typed name, not an agent ID — the gap Phase 4 closes |
| [`daily-report-goal.md`](reference/daily-report-goal.md) | The daily PDF's 3 sections + the cash-flow Excel — what Phase 7 (the north star) has to reproduce |
| [`reference-paths.md`](reference/reference-paths.md) | External file / resource locations (daily reports, cash-flow Excel, Monday board IDs) |
| [`user-levi.md`](reference/user-levi.md) | Who Levi is, the brand entity, break-glass admin |

## `archive/` — superseded planning, kept for the detail

| File | What it was |
|---|---|
| `original-architecture-plan.md` | The first full architecture plan (Aug 2026) — the foundational "why". Confirms multi-tenancy + full Monday exit as goals from the start. |
| `agent-hub-plan.md` / `agent-hub-plan-full.md` / `.html` | The "Agent Hub" program plan — detailed phase steps + per-phase verification. Its framing (Daf Kesher stays, phase order) is superseded by ROADMAP.md; the *detail* is still useful. |
| `status-snapshot-2026-09-07.md` | Where the build stood mid-deploy on 2026-09-07. Phases 0–3.5 are done now (ROADMAP §3). |
| `open-page-early-plan.md` | Early greenfield plan for a public link-launcher page — now the "public open page" item in ROADMAP §6, deferred. |
| `spot-nik-property-app.md` | Plan for a *separate* Express app (property auto-fill from Monday). Relevant only to the ROADMAP Phase 10 note about re-pointing it at this app's `/api/properties`. |
| `session-2026-09-transcript.jsonl` | Raw transcript of the planning session that produced these docs. Gitignored (local only). |

## Outside the repo

`../../answers to questions.txt` — the raw planning Q&A. Its substance is folded
into ROADMAP.md (§5–§7); kept as history.
