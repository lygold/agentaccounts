import "server-only";
import type { CommissionTierRule } from "./types";

/**
 * Per-agent commission tier tables, from the `חלוקת עמלות` sheet in
 * `חלוקת חדש 2026.xlsx`. Cumulative pre-VAT YTD deal-value thresholds:
 *   0 → 450k → 650k  (the "1000000" sheet column is the 650k+ rate; the
 *   literal 1M is not its own bracket for anyone in the current table).
 *
 * Everyone is [0.5, 0.55, 0.6] except a handful on a flat 0.6. Keyed by Daf
 * Kesher pulse id where known, with a name fallback. Edit here when the
 * sheet changes — small and yearly; a DynamoDB table can come later if
 * office managers need to edit it themselves.
 */

const STANDARD: CommissionTierRule[] = [
  { thresholdIls: 0, agentRate: 0.5 },
  { thresholdIls: 450_000, agentRate: 0.55 },
  { thresholdIls: 650_000, agentRate: 0.6 },
];

const FLAT_60: CommissionTierRule[] = [{ thresholdIls: 0, agentRate: 0.6 }];

/** Agents on the flat 0.6 table (אורנה אבן פרקר, עליזה פרידלנד, רחל גליק). */
const FLAT_60_NAMES = new Set(["אורנה אבן פרקר", "עליזה פרידלנד", "רחל גליק"]);

/** agentId (Daf Kesher pulse id) → tiers, for the ids we've resolved. */
const BY_ID: Record<string, CommissionTierRule[]> = {
  "1593093187": STANDARD, // דוד וייזר
};

export function tiersForAgent(agentId: string, agentName: string): CommissionTierRule[] {
  if (BY_ID[agentId]) return BY_ID[agentId];
  if (FLAT_60_NAMES.has(agentName.trim())) return FLAT_60;
  return STANDARD;
}
