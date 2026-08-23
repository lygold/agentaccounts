import Link from "next/link";
import { logout } from "@/app/logout/actions";
import { getSession } from "@/lib/auth/session-cookie";

export async function Nav() {
  const session = await getSession();
  return (
    <nav className="flex items-center justify-between border-b p-4 text-sm">
      <div className="flex items-center gap-4 font-medium">
        <Link href="/">Dashboard</Link>
        <Link href="/deals">Deals</Link>
      </div>
      <div className="flex items-center gap-4">
        {session && (
          <span className="text-muted-foreground">
            {session.agentName} · {session.role.replace("_", " ")}
          </span>
        )}
        <form action={logout}>
          <button type="submit" className="text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
