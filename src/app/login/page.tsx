"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { requestOtp, type AuthActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<
    AuthActionResult | null,
    FormData
  >(requestOtp, null);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Agent Ledger</h1>
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact">Phone or email</Label>
          <Input
            id="contact"
            name="contact"
            type="text"
            autoComplete="username"
            dir="ltr"
            className="text-left"
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Send code via</Label>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: "whatsapp", label: "WhatsApp" },
                { value: "email", label: "Email" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className="relative flex cursor-pointer items-center justify-center rounded-lg border p-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="deliveryMethod"
                  value={opt.value}
                  defaultChecked={opt.value === "whatsapp"}
                  className="sr-only"
                />
                <span className="font-semibold">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {state && !state.ok && state.message && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Sending..." : "Send code"}
        </Button>
      </form>
    </div>
  );
}
