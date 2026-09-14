import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";

/**
 * Layout shared by every wizard page. Enforces session at the layout level so
 * any new page added under (wizard) is auth-gated by construction — belt and
 * braces alongside middleware.ts, which already gates every non-public path.
 *
 * Per-step access (can the user be on THIS step, or must they finish earlier
 * ones first?) is enforced by each page based on the loaded draft. Putting
 * that check in a layout would require the layout to know the requested
 * route, which Next does not expose to layouts directly.
 *
 * Ported from sikkumPigisha's (wizard)/layout.tsx — only the redirect target
 * changed, from its own /form/contact auth start page to agentLedger's real
 * login, via the same next= idiom /sikkum uses.
 */
export default async function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSession();
  } catch {
    redirect("/login?next=/deals/new");
  }
  return children;
}
