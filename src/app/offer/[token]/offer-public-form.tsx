"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/signature-pad";
import { submitOffer } from "./actions";

export function OfferPublicForm({
  token,
  propertyAddress,
  ownerName,
}: {
  token: string;
  propertyAddress: string;
  ownerName: string;
}) {
  const t = useTranslations("OfferPublic");
  const common = useTranslations("Common");
  const [hasSecondBuyer, setHasSecondBuyer] = useState(false);
  const [signature1, setSignature1] = useState<string | null>(null);
  const [signature2, setSignature2] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!signature1 && (!hasSecondBuyer || !!signature2);

  return (
    <form
      action={submitOffer.bind(null, token)}
      onSubmit={() => setSubmitting(true)}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="signature1" value={signature1 ?? ""} />
      {hasSecondBuyer && <input type="hidden" name="signature2" value={signature2 ?? ""} />}

      <ReadOnlyField label={t("addressLabel")} value={propertyAddress} />
      <ReadOnlyField label={t("ownerLabel")} value={ownerName} />

      <TextField id="buyerName" label={t("buyerNameLabel")} required />
      <TextField id="buyerIdNumber" label={t("buyerIdLabel")} required />

      {!hasSecondBuyer ? (
        <button
          type="button"
          onClick={() => setHasSecondBuyer(true)}
          className="self-start text-sm text-secondary underline-offset-4 hover:underline"
        >
          {t("addSecondBuyer")}
        </button>
      ) : (
        <>
          <TextField id="buyerName2" label={t("buyerName2Label")} />
          <TextField id="buyerIdNumber2" label={t("buyerId2Label")} />
        </>
      )}

      <TextField id="price" label={t("priceLabel")} type="number" required />
      <TextAreaField id="paymentTerms" label={t("paymentTermsLabel")} />
      <TextField id="requestedTransferDate" label={t("requestedTransferDateLabel")} type="date" />
      <TextField id="extendedTransferDate" label={t("extendedTransferDateLabel")} type="date" />
      <TextAreaField id="contentsToLeave" label={t("contentsToLeaveLabel")} />
      <TextAreaField id="notes" label={t("notesLabel")} />

      <SignaturePad label={t("signatureLabel")} onChange={setSignature1} required />
      {hasSecondBuyer && (
        <SignaturePad label={t("signature2Label")} onChange={setSignature2} required />
      )}

      <Button type="submit" size="lg" disabled={!canSubmit || submitting}>
        {submitting ? common("sending") : t("submit")}
      </Button>
    </form>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function TextField({
  id,
  label,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      <Input id={id} name={id} type={type} required={required} dir="rtl" />
    </div>
  );
}

function TextAreaField({ id, label }: { id: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={id} dir="rtl" />
    </div>
  );
}
