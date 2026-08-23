"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth/session-cookie";

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
