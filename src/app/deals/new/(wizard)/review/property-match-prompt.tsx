"use client";

import { useState } from "react";
import { DidYouMeanPrompt } from "@/components/did-you-mean";
import type { PropertySummary } from "@/lib/wizard/monday";
import { linkMatchedProperty } from "./actions";

/**
 * Review-page equivalent of the property step's "did you mean" prompt, for
 * deals that never visited /form/property at all (the AI upload path jumps
 * straight to review) or where the agent typed manually without confirming.
 * Confirming only links the match for the "In Negotiation" status update —
 * see linkMatchedProperty for why it doesn't overwrite any draft fields.
 */
export function PropertyMatchPrompt({ match }: { match: PropertySummary }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <DidYouMeanPrompt
      label={match.label + (match.ownerName ? ` — ${match.ownerName}` : "")}
      onConfirm={() => linkMatchedProperty(match.id)}
      onDismiss={() => setDismissed(true)}
    />
  );
}
