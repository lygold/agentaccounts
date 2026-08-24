import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { submitNewDeal } from "../actions";

export default async function NewDealPage() {
  await requireSession();
  const [t, tDealType, tSide] = await Promise.all([
    getTranslations("NewDeal"),
    getTranslations("Enums.dealType"),
    getTranslations("Enums.side"),
  ]);

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-lg p-6">
        <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
        <form action={submitNewDeal} className="flex flex-col gap-4">
          <Field label={t("agentName")} name="agentName" required />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dealType">{t("dealType")}</Label>
            <select
              id="dealType"
              name="dealType"
              defaultValue="sale"
              className="h-11 rounded-md border border-input bg-background px-3"
            >
              <option value="sale">{tDealType("sale")}</option>
              <option value="rental">{tDealType("rental")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="side">{t("side")}</Label>
            <select
              id="side"
              name="side"
              defaultValue="seller"
              className="h-11 rounded-md border border-input bg-background px-3"
            >
              <option value="seller">{tSide("seller")}</option>
              <option value="buyer">{tSide("buyer")}</option>
              <option value="landlord">{tSide("landlord")}</option>
              <option value="renter">{tSide("renter")}</option>
            </select>
          </div>
          <Field label={t("clientName")} name="clientName" required />
          <Field label={t("propertyAddress")} name="propertyAddress" />
          <Field label={t("salePrice")} name="salePrice" type="number" required />
          <Field
            label={t("commissionPercent")}
            name="commissionPercent"
            type="number"
            step="0.01"
            required
          />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="hasReferral" name="hasReferral" className="h-4 w-4" />
            <Label htmlFor="hasReferral">{t("hasReferral")}</Label>
          </div>
          <Field
            label={t("referralPercent")}
            name="referralPercent"
            type="number"
            step="0.01"
          />
          <Field label={t("sikkumDate")} name="sikkumDate" type="date" />
          <Field label={t("signingDate")} name="signingDate" type="date" />
          <Button type="submit" size="lg">
            {t("submit")}
          </Button>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} required={required} />
    </div>
  );
}
