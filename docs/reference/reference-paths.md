---
name: reference-paths
description: "External file/resource locations for agentLedger (daily reports, cash-flow Excel, Monday board)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6609ff1d-e85f-4c01-9fbc-2bcbb4bf3dee
  modified: 2026-08-31T12:12:20.981Z
---

- **Daily report PDFs** (one per day, filename DD-MM-YYYY.pdf):
  `G:\.shortcut-targets-by-id\1AFbNJfewqv0gYxWkScVKCT3jrkpyjdB0\Remax Vision\accounting\2026\Daily Report\`
- **Cash-flow Excel** (manual, monthly column blocks):
  `D:\Users\Levi\copy תזרים מוזמנים 2026.xlsx` — single sheet `תזרים מוזמנים`
- **Daf Kesher** Monday board (shared agent identity, read-only): id `1593085910`
  (`MONDAY_AGENTS_BOARD_ID`). District column `numeric_mm0dwhxf` (= team key);
  "Is Team Leader" `color_mm1j9dvy`; app-role column does not exist yet
  (`__PENDING_appRole__` in `src/lib/monday/columns.ts`).
- **AWS**: eu-north-1, DynamoDB tables `agent-ledger-{deals,billing,income,ledger-entries}`
  (PAY_PER_REQUEST), S3 `agent-ledger-attachments`. GSIs: `byAgentId`, `byDealId`.
- **Green Invoice** (Morning): sandbox env configured.

See [[daily-report-goal]] for how these feed the roadmap.
