"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { uploadDocument } from "./actions";

type UploadResult = { ok: false; message: string } | undefined;

/** Ported from sikkumPigisha's form/upload/page.tsx, unchanged except the
 *  skip link's target (/deals/new/language, not /form/language). */
export default function UploadPage() {
  const t = useTranslations("UploadStep");
  const [state, formAction, pending] = useActionState<UploadResult, FormData>(
    uploadDocument,
    undefined,
  );
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <form action={formAction} className="flex flex-col gap-5">
        <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-input p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors has-[:focus]:ring-2">
          <FileUp className="h-8 w-8 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">
            {fileName ?? t("chooseFile")}
          </span>
          <span className="text-xs text-muted-foreground">{t("fileTypes")}</span>
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,image/*"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        {state?.ok === false && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="lg" disabled={pending || !fileName}>
          {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />}
          {pending ? t("processing") : t("submit")}
        </Button>
      </form>

      <Button variant="outline" size="lg" asChild>
        <Link href="/deals/new/language">{t("skip")}</Link>
      </Button>
    </main>
  );
}
