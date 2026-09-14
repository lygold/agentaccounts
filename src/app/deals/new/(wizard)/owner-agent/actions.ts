"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { PartySchema } from "@/lib/wizard/form-parse";
import { destinationStep, stepHref, WIZARD_DESTINATION_FIELD } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

export async function submitOwnerAgent(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = PartySchema.safeParse({
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
    });
    if (!parsed.success) return;

    await advanceDraft(session.agentId, "owner-agent", {
      ownerAgent: {
        name: parsed.data.name ?? "",
        phone: parsed.data.phone || undefined,
        email: parsed.data.email || undefined,
      },
    });

    const destination = formData.get(WIZARD_DESTINATION_FIELD);
    redirect(
      stepHref(
        destinationStep(
          "owner-agent",
          typeof destination === "string" ? destination : null,
        ),
      ),
    );
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitOwnerAgent failed:", e);
    redirect(stepHref("owner-agent") + "?error=save");
  }
}
