import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/app/logout/actions";
import { getSession } from "@/lib/auth/session-cookie";

export async function Nav() {
  const [session, t, tRole] = await Promise.all([
    getSession(),
    getTranslations("Nav"),
    getTranslations("Enums.role"),
  ]);
  return (
    <nav className="flex items-center justify-between border-b p-4 text-sm">
      <div className="flex items-center gap-4 font-medium">
        <Link href="/">{t("dashboard")}</Link>
        <Link href="/deals">{t("deals")}</Link>
      </div>
      <div className="flex items-center gap-4">
        {session && (
          <span className="text-muted-foreground">
            {session.agentName} · {tRole(session.role)}
          </span>
        )}
        <form action={logout}>
          <button type="submit" className="text-muted-foreground hover:text-foreground">
            {t("signOut")}
          </button>
        </form>
      </div>
    </nav>
  );
}
