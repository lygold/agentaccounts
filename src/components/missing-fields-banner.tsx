"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Reads `?missing=a,b` (set by a wizard step that refused to continue) and
 *  lists, by name, the mandatory questions still unanswered on this step. */
export function MissingFieldsBanner() {
  const t = useTranslations("PropertyMissing");
  const params = useSearchParams();
  const raw = params.get("missing");
  if (!raw) return null;
  const keys = raw.split(",").filter(Boolean);
  if (keys.length === 0) return null;
  return (
    <Alert variant="destructive" className="mb-2">
      <AlertDescription className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>{t("prefix")}</strong>
          {keys.map((k) => (t.has(k) ? t(k) : k)).join(" · ")}
        </span>
      </AlertDescription>
    </Alert>
  );
}
