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
