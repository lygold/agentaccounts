import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed, sameOffice } from "@/lib/auth/scope";
import { getOffer } from "@/lib/store/offers";
import { getAttachmentUrl } from "@/lib/s3-attachments";
import { APP_BASE_URL } from "@/lib/office";
import { Nav } from "@/components/nav";
import { CopyLinkButton } from "@/components/copy-link-button";
import { updateOfferStatusAction } from "../actions";
import type { OfferStatus } from "@/lib/types";

const STATUS_OPTIONS: OfferStatus[] = [
  "new",
  "follow_up",
  "accepted",
  "rejected_too_low",
  "rejected_not_relevant",
  "duplicate",
];

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const offer = await getOffer(id);
  if (!offer || !sameOffice(offer, session)) notFound();
  if (!isIdAllowed(await allowedAgentIds(session), offer.agentId)) notFound();

  const [t, tStatus, pdfUrl] = await Promise.all([
    getTranslations("OfferDetail"),
    getTranslations("Enums.offerStatus"),
    offer.pdfS3Key ? getAttachmentUrl(offer.pdfS3Key) : Promise.resolve(null),
  ]);

  const buyerLink = `${APP_BASE_URL}/offer/${offer.token}`;

  return (
    <div>
      <Nav />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <div>
          <h1 className="text-2xl font-bold">{offer.propertyAddress}</h1>
          <p className="text-sm text-muted-foreground">
            {offer.ownerName} · {offer.agentName}
          </p>
        </div>

        {!offer.submittedAt ? (
          <Section title={t("shareTitle")}>
            <p className="text-sm text-muted-foreground">{t("shareHint")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-xs">
                {buyerLink}
              </code>
              <CopyLinkButton link={buyerLink} />
            </div>
          </Section>
        ) : (
          <>
            <Section title={t("statusTitle")}>
              <form action={updateOfferStatusAction.bind(null, offer.id)} className="flex items-center gap-2">
                <select
                  name="status"
                  defaultValue={offer.status}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {tStatus(s)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="h-11 rounded-md border border-input px-4 text-sm hover:bg-muted/40"
                >
                  {t("saveStatus")}
                </button>
              </form>
            </Section>

            <Section title={t("buyerTitle")}>
              <Field label={t("buyerNameLabel")} value={offer.buyerName} />
              <Field label={t("buyerIdLabel")} value={offer.buyerIdNumber} />
              {offer.buyerName2 && <Field label={t("buyerName2Label")} value={offer.buyerName2} />}
              {offer.buyerIdNumber2 && <Field label={t("buyerId2Label")} value={offer.buyerIdNumber2} />}
            </Section>

            <Section title={t("termsTitle")}>
              <Field label={t("priceLabel")} value={offer.price?.toLocaleString()} />
              <Field label={t("paymentTermsLabel")} value={offer.paymentTerms} />
              <Field label={t("requestedTransferDateLabel")} value={offer.requestedTransferDate} />
              <Field label={t("extendedTransferDateLabel")} value={offer.extendedTransferDate} />
              <Field label={t("contentsToLeaveLabel")} value={offer.contentsToLeave} />
              <Field label={t("notesLabel")} value={offer.notes} />
            </Section>

            {pdfUrl && (
              <Section title={t("pdfTitle")}>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-secondary underline-offset-4 hover:underline"
                >
                  {t("viewPdf")}
                </a>
              </Section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </>
  );
}
