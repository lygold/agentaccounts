import "server-only";
import { MondayApiError, MondayConfigError } from "./errors";

const ENDPOINT = "https://api.monday.com/v2";
const API_VERSION = "2024-10";

function getToken(): string {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    throw new MondayConfigError("MONDAY_API_TOKEN is not set");
  }
  return token;
}

type MondayResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
  error_message?: string;
  error_code?: string;
};

export async function mondayQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
        "API-Version": API_VERSION,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
  } catch (err) {
    throw new MondayApiError("Network error calling Monday API", err);
  }

  let body: MondayResponse<T>;
  try {
    body = (await res.json()) as MondayResponse<T>;
  } catch (err) {
    throw new MondayApiError(
      `Monday API returned non-JSON (status ${res.status})`,
      err,
      res.status,
    );
  }

  if (body.errors?.length) {
    throw new MondayApiError(
      `Monday GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`,
      body.errors,
      res.status,
    );
  }
  if (body.error_message) {
    throw new MondayApiError(
      `Monday API error: ${body.error_message} (${body.error_code ?? "no code"})`,
      body,
      res.status,
    );
  }
  if (!body.data) {
    throw new MondayApiError(
      `Monday API returned no data (status ${res.status})`,
      body,
      res.status,
    );
  }
  return body.data;
}

/** Daf Kesher — the shared agent-identity board, same one sikkumPigisha's
 *  MONDAY_AGENTS_BOARD_ID points to. Read-only from this app. */
export function getAgentsBoardId(): string {
  const id = process.env.MONDAY_AGENTS_BOARD_ID;
  if (!id) throw new MondayConfigError("MONDAY_AGENTS_BOARD_ID is not set");
  return id;
}

/** Properties Raw Data (listings) — used by the /sikkum wizard's property
 *  picker/prefill (Phase 8). Same board sikkumPigisha reads. */
export function getPropertiesBoardId(): string {
  const id = process.env.MONDAY_PROPERTIES_BOARD_ID;
  if (!id) throw new MondayConfigError("MONDAY_PROPERTIES_BOARD_ID is not set");
  return id;
}

/** Deals_Raw_Data — the wizard's submit target during the Monday mirror
 *  bridge (Phase 8d), watched by the existing Make.com PDF scenario. */
export function getDealsBoardId(): string {
  const id = process.env.MONDAY_DEALS_BOARD_ID;
  if (!id) throw new MondayConfigError("MONDAY_DEALS_BOARD_ID is not set");
  return id;
}

/** Referrals — outbound mirror only (Phase 9), replacing the board's own
 *  Make.com scenarios. Write-only from this app; no picker reads it. */
export function getReferralsBoardId(): string {
  const id = process.env.MONDAY_REFERRALS_BOARD_ID;
  if (!id) throw new MondayConfigError("MONDAY_REFERRALS_BOARD_ID is not set");
  return id;
}
