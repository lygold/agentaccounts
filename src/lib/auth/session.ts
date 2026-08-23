/**
 * Edge-safe session primitives — importable from middleware and from server
 * actions/RSCs. MUST NOT import `server-only` or `next/headers` (breaks the
 * Edge bundle middleware compiles into). Cookie-jar helpers live in
 * ./session-cookie.ts (Node-only).
 */
import { SignJWT, jwtVerify } from "jose";
import type { AppRole } from "../monday/types";

export const SESSION_COOKIE = "agent_ledger_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface SessionPayload {
  /** Daf Kesher pulse/item ID — canonical identity. */
  agentId: string;
  agentName: string;
  agentEmail: string | null;
  agentPhone: string | null;
  role: AppRole;
  /** רובע — null is valid (some agents/managers aren't tied to one). */
  district: number | null;
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 chars (use `openssl rand -hex 32`)",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(getSecret());
}

const VALID_ROLES: AppRole[] = ["agent", "team_leader", "manager", "admin"];

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    const role = payload.role as AppRole;
    if (!VALID_ROLES.includes(role)) return null;
    return {
      agentId: String(payload.agentId),
      agentName: String(payload.agentName),
      agentEmail: payload.agentEmail == null ? null : String(payload.agentEmail),
      agentPhone: payload.agentPhone == null ? null : String(payload.agentPhone),
      role,
      district:
        payload.district === null || payload.district === undefined
          ? null
          : Number(payload.district),
    };
  } catch {
    return null;
  }
}
