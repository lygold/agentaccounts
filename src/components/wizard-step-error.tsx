"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Reads `?error=` from the URL and displays a user-friendly banner.
 * Rendered inside a Suspense boundary in WizardChrome so it stays compatible
 * with server-component pages (useSearchParams requires Suspense in Next.js).
 */
export function WizardStepError() {
  const t = useTranslations("WizardStepError");
  const params = useSearchParams();
  const raw = params.get("error");
  if (!raw) return null;
  const kind = raw === "session" ? "session" : "save";
  return (
    <Alert variant="destructive" className="mb-2">
      <AlertDescription className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>{t("prefix")}</strong>
          {t(kind === "session" ? "sessionWhy" : "saveWhy")}{" "}
          {t(kind === "session" ? "sessionAction" : "saveAction")}
        </span>
      </AlertDescription>
    </Alert>
  );
}
