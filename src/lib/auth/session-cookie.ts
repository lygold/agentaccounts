import "server-only";
import { cookies } from "next/headers";
import type { AppRole } from "../monday/types";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session";

/** Roles that may see office-wide views (every agent's balance, etc.).
 *  Team leaders are deliberately excluded until the dashboard is
 *  team-scoped — today `listAgentBalances()` returns the whole office. */
export const MANAGER_ROLES: readonly AppRole[] = ["manager", "admin"];

export function isManager(session: SessionPayload): boolean {
  return MANAGER_ROLES.includes(session.role);
}

export function isAdmin(session: SessionPayload): boolean {
  return session.role === "admin";
}

/** Guard for admin-only surfaces — user/role management, office settings. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!isAdmin(session)) throw new Error("FORBIDDEN");
  return session;
}

/** Guard for write actions that only Levi / office managers may perform —
 *  logging deal income, posting commissions, ledger adjustments, creating
 *  deals. Agents (incl. team leaders acting as agents) are read-only. */
export async function requireManager(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!isManager(session)) throw new Error("FORBIDDEN");
  return session;
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Use in server actions/RSCs that require auth. Throws if no session. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
