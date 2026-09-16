import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";

/**
 * Same pattern as deals/new/(wizard)/layout.tsx — session-gates every page
 * under this group by construction, belt-and-braces alongside middleware.ts.
 */
export default async function PropertyWizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSession();
  } catch {
    redirect("/login?next=/properties/new");
  }
  return children;
}
