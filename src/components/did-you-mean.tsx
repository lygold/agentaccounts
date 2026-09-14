"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface DidYouMeanPromptProps {
  label: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * Shared "did you mean X?" confirm prompt used when a manually-typed value
 * closely matches something already on the agent's own board (property
 * address or client name) that they skipped the picker for. Confirming
 * hands off to the same prefill path the picker itself uses — this is just
 * a shortcut into it, not a separate data source.
 */
export function DidYouMeanPrompt({
  label,
  onConfirm,
  onDismiss,
}: DidYouMeanPromptProps) {
  const t = useTranslations("DidYouMean");
  return (
    <Alert className="border-primary/40 bg-primary/5">
      <AlertDescription className="flex flex-col gap-2">
        <span>
          {t.rich("confirmPrompt", {
            label,
            b: (chunks) => <strong>{chunks}</strong>,
          })}
        </span>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={onConfirm}>
            {t("yes")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
            {t("no")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
