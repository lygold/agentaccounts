import { requireSession } from "@/lib/auth/session-cookie";
import { Nav } from "@/components/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { submitNewDeal } from "../actions";

export default async function NewDealPage() {
  await requireSession();

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-lg p-6">
        <h1 className="mb-4 text-2xl font-bold">New deal</h1>
        <form action={submitNewDeal} className="flex flex-col gap-4">
          <Field label="Agent name" name="agentName" required />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dealType">Deal type</Label>
            <select
              id="dealType"
              name="dealType"
              defaultValue="sale"
              className="h-11 rounded-md border border-input bg-background px-3"
            >
              <option value="sale">Sale</option>
              <option value="rental">Rental</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="side">Side represented</Label>
            <select
              id="side"
              name="side"
              defaultValue="seller"
              className="h-11 rounded-md border border-input bg-background px-3"
            >
              <option value="seller">Seller</option>
              <option value="buyer">Buyer</option>
              <option value="landlord">Landlord</option>
              <option value="renter">Renter</option>
            </select>
          </div>
          <Field label="Client name" name="clientName" required />
          <Field label="Property address" name="propertyAddress" />
          <Field label="Sale price (₪)" name="salePrice" type="number" required />
          <Field label="Commission (%)" name="commissionPercent" type="number" step="0.01" required />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="hasReferral" name="hasReferral" className="h-4 w-4" />
            <Label htmlFor="hasReferral">There&apos;s a referral on this deal</Label>
          </div>
          <Field label="Referral % of commission" name="referralPercent" type="number" step="0.01" />
          <Field label="Sikkum date" name="sikkumDate" type="date" />
          <Field label="Signing date" name="signingDate" type="date" />
          <Button type="submit" size="lg">
            Create deal
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
