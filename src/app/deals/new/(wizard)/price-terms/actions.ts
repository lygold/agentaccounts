"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session-cookie";
import { advanceDraft } from "@/lib/wizard/draft";
import { destinationStep, stepHref, WIZARD_DESTINATION_FIELD } from "@/lib/wizard/steps";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";

const Schema = z.object({
  price: z.coerce.number().positive().optional().or(z.literal("")),
  currency: z.enum(["ILS", "USD"]).default("ILS"),
  paymentTerms: z.string().trim().optional(),
  vacatingDate: z.string().trim().optional(),
});

export async function submitPriceTerms(formData: FormData) {
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return;

    await advanceDraft(session.agentId, "price-terms", {
      priceTerms: {
        price:
          typeof parsed.data.price === "number" ? parsed.data.price : undefined,
        currency: parsed.data.currency,
        paymentTerms: parsed.data.paymentTerms || undefined,
        vacatingDate: parsed.data.vacatingDate || undefined,
      },
    });

    const destination = formData.get(WIZARD_DESTINATION_FIELD);
    redirect(
      stepHref(
        destinationStep(
          "price-terms",
          typeof destination === "string" ? destination : null,
        ),
      ),
    );
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPriceTerms failed:", e);
    redirect(stepHref("price-terms") + "?error=save");
  }
}
