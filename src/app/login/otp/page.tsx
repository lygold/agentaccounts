"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { verifyOtp, type AuthActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function OtpPage() {
  return (
    <Suspense>
      <OtpForm />
    </Suspense>
  );
}

function OtpForm() {
  const t = useTranslations("Otp");
  const params = useSearchParams();
  const contact = params.get("c") ?? "";

  const [state, formAction, pending] = useActionState<
    AuthActionResult | null,
    FormData
  >(verifyOtp, null);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="contact" value={contact} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">{t("codeLabel")}</Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="------"
            required
            autoFocus
            dir="ltr"
            className="text-center font-mono tracking-[0.5em] text-2xl"
          />
        </div>

        {state && !state.ok && state.message && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("verifying") : t("submit")}
        </Button>
      </form>

      <Link
        href="/login"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("resend")}
      </Link>
    </div>
  );
}
