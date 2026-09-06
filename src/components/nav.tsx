import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/app/logout/actions";
import { getSession, isManager } from "@/lib/auth/session-cookie";

export async function Nav() {
  const [session, t, tRole] = await Promise.all([
    getSession(),
    getTranslations("Nav"),
    getTranslations("Enums.role"),
  ]);
  const showDashboard = session ? isManager(session) : false;
  // pr-24: keep the trailing item (sign out in LTR, the links in RTL) clear of
  // the language switcher that's fixed to the top-right corner (LocaleToggle).
  return (
    <nav className="flex items-center justify-between border-b p-4 pr-24 text-sm">
      <div className="flex items-center gap-4 font-medium">
        {showDashboard ? (
          <Link href="/">{t("dashboard")}</Link>
        ) : (
          session && (
            <Link href={`/agents/${encodeURIComponent(session.agentId)}`}>
              {t("myLedger")}
            </Link>
          )
        )}
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
