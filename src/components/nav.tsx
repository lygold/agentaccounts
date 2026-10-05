import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/app/logout/actions";
import { getSession, isManager, isAdmin } from "@/lib/auth/session-cookie";
import { mondaySyncAlertCount } from "@/lib/services/admin-alerts";

export async function Nav() {
  const [session, t, tRole] = await Promise.all([
    getSession(),
    getTranslations("Nav"),
    getTranslations("Enums.role"),
  ]);
  const showDashboard = session ? isManager(session) : false;
  const showAdmin = session ? isAdmin(session) : false;
  // Admin-only: how many properties failed to reach Monday (agents never see Monday).
  const mondayIssues = showAdmin ? await mondaySyncAlertCount() : 0;
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
        <Link href="/properties">{t("properties")}</Link>
        <Link href="/offers">{t("offers")}</Link>
        <Link href="/referrals">{t("referrals")}</Link>
        {showDashboard && <Link href="/admin/notifications">{t("notifications")}</Link>}
        {showAdmin && <Link href="/admin/agents">{t("agents")}</Link>}
        {showAdmin && (
          <Link href="/admin/monday-sync" className="flex items-center gap-1.5">
            {t("mondaySync")}
            {mondayIssues > 0 && (
              <span className="rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-5 text-destructive-foreground">
                {mondayIssues}
              </span>
            )}
          </Link>
        )}
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
