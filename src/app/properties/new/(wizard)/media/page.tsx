import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { loadPropertyDraft, patchPropertyDraft, type PropertyDraft } from "@/lib/property-wizard/draft";
import { randomUUID } from "node:crypto";
import { storeServerFile, getMediaUrl } from "@/lib/storage/media";
import { MediaUploader, type UploadedItem } from "@/components/media-uploader";
import { YesNoRadios } from "@/components/yes-no-radios";
import type { MediaFileRef, PropertyMedia, PropertyMediaCategory } from "@/lib/types";
import { getSignedContractFile } from "@/lib/wizard/monday";
import { PropertyWizardChrome } from "@/components/property-wizard-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PROPERTY_WIZARD_FORM_ID } from "@/lib/property-wizard/steps";
import { submitPropertyMedia } from "./actions";

/** Auto-attaches the selected signed contract's own PDF as a "forms"
 *  upload, the first time the agent reaches this step — so they don't
 *  have to re-upload the exclusivity/consent document that's already on
 *  file. Best-effort: any failure (no contract picked, no file on it,
 *  Drive/Monday hiccup) just leaves forms empty for manual upload,
 *  exactly like before this existed. Guarded so it only ever runs once
 *  per draft (skips once `forms` is non-empty or there's no linked
 *  contract), safe to call on every render. */
async function ensureContractFormAutoAttached(
  agentId: string,
  officeId: string,
  draft: PropertyDraft,
): Promise<PropertyDraft> {
  if (draft.media?.forms?.length || !draft.sourceContractMondayId || !draft.street || !draft.buildingNumber) {
    return draft;
  }
  try {
    const file = await getSignedContractFile(draft.sourceContractMondayId);
    if (!file) return draft;

    const folderId = draft.mediaFolderId ?? randomUUID();
    const ref = await storeServerFile(officeId, folderId, {
      name: file.name,
      type: file.mimeType,
      buffer: Buffer.from(file.buffer),
    });
    const media: PropertyMedia = { mainPhotos: [], additionalPhotos: [], forms: [], documents: [], ...draft.media };
    media.forms = [ref];
    return patchPropertyDraft(agentId, { mediaFolderId: folderId, media });
  } catch (e) {
    console.error("[property-wizard] auto-attach contract form failed:", e);
    return draft;
  }
}

async function toItems(refs: MediaFileRef[] | undefined): Promise<UploadedItem[]> {
  return Promise.all(
    (refs ?? []).map(async (r) => ({
      name: r.name,
      thumbUrl: r.thumbKey ? await getMediaUrl(r, "thumb") : null,
    })),
  );
}

export default async function PropertyMediaPage() {
  const session = await requireSession();
  let draft = await loadPropertyDraft(session.agentId);
  if (!draft.street) redirect("/properties/new/address");
  draft = await ensureContractFormAutoAttached(session.agentId, session.officeId, draft);
  const t = await getTranslations("PropertyMediaStep");
  const strings = {
    uploading: t.raw("uploadingProgress") as string,
    failed: t.raw("uploadFailed") as string,
    alreadyUploaded: t.raw("alreadyUploadedTemplate") as string,
    waitForUploads: t("waitForUploads"),
  };
  const [mainItems, additionalItems, formItems, documentItems] = await Promise.all(
    (["mainPhotos", "additionalPhotos", "forms", "documents"] as PropertyMediaCategory[]).map((c) =>
      toItems(draft.media?.[c]),
    ),
  );

  return (
    <PropertyWizardChrome step="media" furthestStep={draft.furthestStep} returnToSummaryBehavior="link">
      <form id={PROPERTY_WIZARD_FORM_ID} action={submitPropertyMedia} className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">{t("prompt")}</p>

        <MediaUploader
          category="mainPhotos"
          required
          id="mainPhotos"
          label={t("mainPhotosLabel")}
          accept="image/*"
          initial={mainItems}
          strings={strings}
        />
        <MediaUploader
          category="additionalPhotos"
          required
          id="additionalPhotos"
          label={t("additionalPhotosLabel")}
          accept="image/*"
          initial={additionalItems}
          strings={strings}
        />

        <YesNoRadios
          name="copyrightConfirmed"
          label={t("copyrightQuestion")}
          value={draft.copyrightConfirmed}
          yesLabel={t("yes")}
          noLabel={t("no")}
        />
        <YesNoRadios
          name="renderingsConfirmed"
          label={t("renderingsQuestion")}
          value={draft.renderingsConfirmed}
          yesLabel={t("yes")}
          noLabel={t("no")}
        />

        <MediaUploader
          category="forms"
          required
          id="forms"
          label={t("formsLabel")}
          accept="application/pdf,image/*"
          initial={formItems}
          strings={strings}
        />
        <MediaUploader
          category="documents"
          id="documents"
          label={t("documentsLabel")}
          accept="application/pdf,image/*"
          initial={documentItems}
          strings={strings}
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
          {t("continue")}
        </Button>
      </form>
    </PropertyWizardChrome>
  );
}
