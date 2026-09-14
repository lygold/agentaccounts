"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WizardSubmitButtonProps {
  /** Defaults to the localized "Continue" — pass an override for steps that
   *  need custom button text. */
  children?: React.ReactNode;
  /** Text shown while the action is running (before the 1-second threshold).
   *  Defaults to the localized "Sending...". */
  pendingText?: string;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  /** Block submission until some other precondition is met (e.g. a picker
   *  selection) — separate from the built-in pending-state disable. */
  disabled?: boolean;
}

/**
 * Submit button that shows a spinner after 1 second of pending state, and a
 * "still sending…" notice after 5 seconds.
 *
 * Must be rendered INSIDE a <form> element so that `useFormStatus` can read
 * the form's pending state.
 */
export function WizardSubmitButton({
  children,
  pendingText,
  size = "lg",
  className,
  disabled = false,
}: WizardSubmitButtonProps) {
  const t = useTranslations("Common");
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
    <Button type="submit" size={size} disabled={pending || disabled} className={className}>
      {showSpinner && (
        <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
      )}
      {pending
        ? slowNotice
          ? t("stillSending")
          : (pendingText ?? t("sending"))
        : (children ?? t("continue"))}
    </Button>
  );
}
