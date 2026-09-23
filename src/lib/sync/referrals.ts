import "server-only";
import { mondayQuery, getReferralsBoardId } from "../monday/client";
import { REFERRALS_BOARD, STATUS_LABELS } from "../wizard/monday/columns";
import { updateReferral } from "../store/referrals";
import { getRedis, RedisKeys } from "../redis";
import type { ReferralRecord, AgentRecord } from "../types";

/**
 * Phase 9 — Monday.com outbound mirror for referrals, replacing the board's
 * own Make.com scenarios (blueprints/*.blueprint.json). OUTBOUND ONLY,
 * unlike the properties bridge (src/lib/sync/properties.ts): the app is the
 * sole place referrals get created now, so there's nothing to pull back in
 * from Monday — this exists purely so staff still looking at the board see
 * referrals during the transition.
 *
 * Same "never block the app-side save" convention as
 * mirrorPropertyToMonday: fire-and-forget, dead-lettered to Redis on
 * failure, gated by MONDAY_SYNC_ENABLED.
 *
 * REQUIRED before this runs against the live board: the two native Monday
 * automations that trigger the old Make flow ("when item created → send a
 * webhook") must be turned off first. Monday's own automations fire on
 * API-created items exactly like UI-created ones — leaving them on means
 * every mirrored referral re-triggers the legacy WhatsApp/Fillout flow too,
 * double-messaging the receiving agent.
 */

function mirrorEnabled(): boolean {
  return process.env.MONDAY_SYNC_ENABLED !== "false";
}

const DIRECTION_LABEL: Record<ReferralRecord["direction"], string> = {
  outgoing: STATUS_LABELS.referralDirection.outgoing,
  outgoing_internal: STATUS_LABELS.referralDirection.outgoingInternal,
  incoming: STATUS_LABELS.referralDirection.incoming,
  incoming_internal: STATUS_LABELS.referralDirection.incomingInternal,
};

const CLIENT_TYPE_LABEL: Record<ReferralRecord["clientType"], string> = {
  seller: STATUS_LABELS.referralClientType.seller,
  buyer: STATUS_LABELS.referralClientType.buyer,
  landlord: STATUS_LABELS.referralClientType.landlord,
  renter: STATUS_LABELS.referralClientType.renter,
};

/** The receiving side, for the Monday mirror — either a real AgentRecord's
 *  name/phone (outgoing_internal) or the hand-typed external fields
 *  (plain outgoing). Deliberately smaller than AgentRecord: nothing here
 *  needs the rest of that shape. */
export interface ReceivingParty {
  name: string;
  phone: string | null;
}

/** `sendingAgentMondayItemId` sets the board_relation column directly in the
 *  same create/update call, same {item_ids:[...]} shape confirmed live for
 *  the properties bridge. Omitted when the sending agent has no Monday item
 *  of their own (agent created entirely in-app, never imported from Daf
 *  Kesher). */
function outboundColumnValues(
  referral: ReferralRecord,
  receivingParty: ReceivingParty,
  sendingAgentMondayItemId?: string,
): Record<string, unknown> {
  const cv: Record<string, unknown> = {
    [REFERRALS_BOARD.direction]: { label: DIRECTION_LABEL[referral.direction] },
    [REFERRALS_BOARD.receivingAgentName]: receivingParty.name,
  };
  cv[REFERRALS_BOARD.clientType] = { label: CLIENT_TYPE_LABEL[referral.clientType] };
  if (referral.clientPhone) cv[REFERRALS_BOARD.clientPhone] = referral.clientPhone;
  if (referral.clientEmail) cv[REFERRALS_BOARD.clientEmail] = referral.clientEmail;
  if (referral.notes) cv[REFERRALS_BOARD.notes] = referral.notes;
  if (receivingParty.phone) cv[REFERRALS_BOARD.receivingAgentPhone] = receivingParty.phone;
  if (referral.receivingAgentOffice) {
    cv[REFERRALS_BOARD.receivingAgentOffice] = referral.receivingAgentOffice;
  }
  if (sendingAgentMondayItemId) {
    cv[REFERRALS_BOARD.sendingAgentRelation] = { item_ids: [Number(sendingAgentMondayItemId)] };
  }
  return cv;
}

async function createReferralItem(
  referral: ReferralRecord,
  receivingParty: ReceivingParty,
  sendingAgentMondayItemId?: string,
): Promise<string> {
  const data = await mondayQuery<{ create_item: { id: string } }>(
    /* GraphQL */ `
      mutation ($board: ID!, $name: String!, $cv: JSON!) {
        create_item(board_id: $board, item_name: $name, column_values: $cv) {
          id
        }
      }
    `,
    {
      board: getReferralsBoardId(),
      name: referral.clientName || "הפניה חדשה",
      cv: JSON.stringify(outboundColumnValues(referral, receivingParty, sendingAgentMondayItemId)),
    },
  );
  return data.create_item.id;
}

async function updateReferralItem(
  referral: ReferralRecord,
  receivingParty: ReceivingParty,
  sendingAgentMondayItemId?: string,
): Promise<void> {
  if (!referral.mondayItemId) throw new Error("updateReferralItem: referral has no mondayItemId");
  await mondayQuery(
    /* GraphQL */ `
      mutation ($board: ID!, $item: ID!, $cv: JSON!) {
        change_multiple_column_values(board_id: $board, item_id: $item, column_values: $cv) {
          id
        }
      }
    `,
    {
      board: getReferralsBoardId(),
      item: referral.mondayItemId,
      cv: JSON.stringify(outboundColumnValues(referral, receivingParty, sendingAgentMondayItemId)),
    },
  );
}

/** Push a referral (creation or status change) to the Monday board. Never
 *  throws — a failure is dead-lettered to Redis and logged, same pattern as
 *  mirrorPropertyToMonday. Call fire-and-forget
 *  (`void mirrorReferralToMonday(referral, sendingAgent, receivingParty)`). */
export async function mirrorReferralToMonday(
  referral: ReferralRecord,
  sendingAgent: AgentRecord,
  receivingParty: ReceivingParty,
): Promise<void> {
  if (!mirrorEnabled()) {
    console.info(`[sync] referral mirror disabled — skipped ${referral.id}`);
    return;
  }
  try {
    const sendingAgentMondayItemId = sendingAgent.mondayItemId ?? undefined;

    if (referral.mondayItemId) {
      await updateReferralItem(referral, receivingParty, sendingAgentMondayItemId);
    } else {
      const mondayItemId = await createReferralItem(referral, receivingParty, sendingAgentMondayItemId);
      await updateReferral(referral.id, { mondayItemId }, referral.officeId);
    }
  } catch (e) {
    const entry = JSON.stringify({
      referralId: referral.id,
      clientName: referral.clientName,
      error: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    });
    console.error("[sync] mirror referral to Monday failed:", entry);
    try {
      const redis = getRedis();
      await redis.lpush(RedisKeys.referralMirrorDeadletter, entry);
      await redis.ltrim(RedisKeys.referralMirrorDeadletter, 0, 199);
    } catch (redisErr) {
      console.error("[sync] could not dead-letter the failure:", redisErr);
    }
  }
}

export async function referralMirrorFailureCount(): Promise<number> {
  try {
    return await getRedis().llen(RedisKeys.referralMirrorDeadletter);
  } catch {
    return 0;
  }
}
