"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitDeal } from "./actions";

/**
 * Client component that wraps the final submit form for the review page.
 * Puts the spinner logic inside a child so `useFormStatus` can observe
 * the nearest ancestor form.
 */
export function ReviewSubmitSection({ label }: { label: string }) {
  return (
    <form action={submitDeal}>
      <ReviewSubmitButton label={label} />
    </form>
  );
}

function ReviewSubmitButton({ label }: { label: string }) {
  const t = useTranslations("ReviewStep");
  const common = useTranslations("Common");
  const { pending } = useFormStatus();
  const [showSpinner, setShowSpinner] = useState(false);
  const [slowNotice, setSlowNotice] = useState(false);

  useEffect(() => {
    if (!pending) {
      setShowSpinner(false);
      setSlowNotice(false);
      return;
    }
    const t1 = setTimeout(() => setShowSpinner(true), 1000);
    const t2 = setTimeout(() => setSlowNotice(true), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pending]);

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {showSpinner && (
        <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
      )}
      {pending
        ? slowNotice
          ? t("sendingToMonday")
          : common("sending")
        : label}
    </Button>
  );
}
