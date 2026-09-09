# docs/

> **The canonical plan is [`../ROADMAP.md`](../ROADMAP.md).** Everything in this
> folder is earlier planning work, kept for reference. Where a file here
> disagrees with ROADMAP.md, ROADMAP.md wins.

These were produced during the initial planning of the "Agent Hub" (Sept 2026),
before the project reframed toward a multi-tenant SaaS. They still hold useful
detail — the workflow discovery, the entity model, the phased reasoning, the
deployment gotchas — that hasn't all been folded into ROADMAP.md yet.

| File | What it is | Currency |
|---|---|---|
| `agent-hub-plan.md` | Short program summary — decisions, entities, phases, open questions | Superseded framing (sikkumPigisha-merge / Monday dual-write); phase list replaced by ROADMAP §3–4 |
| `agent-hub-plan-full.md` | The detailed plan — full phase steps, files to touch, verification per phase, the workflow Q&A | Same — reference for the *detail*, not the direction |
| `agent-hub-plan.html` | The same plan as a visual one-pager | Same |
| `status-snapshot-2026-09-07.md` | Where the build stood on 2026-09-07 (mid deploy) | **Stale** — Phases 0–3.5 are done now; see ROADMAP §3. Env-var fix described here (`amplify.yml` → `.env.production`) was later replaced by baking into `next.config.ts` |
| `planning-memory-index.md` | Index of the Claude memory notes from that period | Links point at `~/.claude` memory files, not repo files |

Related, outside the repo: `../answers to questions.txt` (parent folder) — the
raw planning Q&A with product detail not yet in ROADMAP.
