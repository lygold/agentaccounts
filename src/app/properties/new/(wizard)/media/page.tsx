import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft } from "@/lib/property-wizard/draft";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyMedia } from "./actions";

export default async function PropertyMediaPage() {
  const session = await requireSession();
  const draft = await loadPropertyDraft(session.agentId);
  if (!draft.street) redirect("/properties/new/address");
  const t = await getTranslations("PropertyMediaStep");

  return (
    <PropertyWizardChrome step="media" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyMedia} className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>

        <FileField
          id="mainPhotos"
          label={t("mainPhotosLabel")}
          multiple
          accept="image/*"
          count={draft.mainPhotos?.length}
          countLabel={(n) => t("alreadyUploaded", { count: n })}
        />
        <FileField
          id="additionalPhotos"
          label={t("additionalPhotosLabel")}
          multiple
          accept="image/*"
          count={draft.additionalPhotos?.length}
          countLabel={(n) => t("alreadyUploaded", { count: n })}
        />

        <div className="flex flex-col gap-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="copyrightConfirmed" defaultChecked={draft.copyrightConfirmed} className="h-4 w-4" />
            {t("copyrightLabel")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="renderingsConfirmed" defaultChecked={draft.renderingsConfirmed} className="h-4 w-4" />
            {t("renderingsLabel")}
          </label>
        </div>

        <FileField
          id="forms"
          label={t("formsLabel")}
          multiple
          accept="application/pdf,image/*"
          count={draft.forms?.length}
          countLabel={(n) => t("alreadyUploaded", { count: n })}
        />
        <FileField
          id="documents"
          label={t("documentsLabel")}
          multiple
          accept="application/pdf,image/*"
          count={draft.documents?.length}
          countLabel={(n) => t("alreadyUploaded", { count: n })}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="virtualTourUrl">{t("virtualTourLabel")}</Label>
          <Input id="virtualTourUrl" name="virtualTourUrl" type="url" dir="ltr" defaultValue={draft.virtualTourUrl ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="youtubeUrl">{t("youtubeUrlLabel")}</Label>
            <Input id="youtubeUrl" name="youtubeUrl" type="url" dir="ltr" defaultValue={draft.youtubeUrl ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="youtubeDisplayText">{t("youtubeDisplayTextLabel")}</Label>
            <Input id="youtubeDisplayText" name="youtubeDisplayText" dir="rtl" defaultValue={draft.youtubeDisplayText ?? ""} />
          </div>
        </div>

        <Button type="submit" size="lg">
          {t("uploadAndContinue")}
        </Button>
      </form>
    </PropertyWizardChrome>
  );
}

function FileField({
  id,
  label,
  multiple,
  accept,
  count,
  countLabel,
}: {
  id: string;
  label: string;
  multiple?: boolean;
  accept?: string;
  count?: number;
  countLabel: (n: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        name={id}
        type="file"
        multiple={multiple}
        accept={accept}
        className="text-sm file:me-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
      />
      {!!count && <p className="text-xs text-muted-foreground">{countLabel(count)}</p>}
    </div>
  );
}
