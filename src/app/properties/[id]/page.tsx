import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { allowedAgentIds, isIdAllowed } from "@/lib/auth/scope";
import { getProperty } from "@/lib/store/properties";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const property = await getProperty(id);
  if (!property || property.officeId !== session.officeId) notFound();

  const allowed = await allowedAgentIds(session);
  if (!isIdAllowed(allowed, property.agentId)) notFound();

  const t = await getTranslations("PropertyDetail");
  const tDealType = await getTranslations("Enums.dealType");
  const tStatus = await getTranslations("Enums.propertyStatus");
  const canSeeRatings = isManager(session);

  const address =
    [
      property.street,
      property.buildingNumber,
      property.apartmentNumber ? `דירה ${property.apartmentNumber}` : null,
    ]
      .filter(Boolean)
      .join(" ") || t("noAddress");

  return (
    <div>
      <Nav />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{address}</h1>
            <p className="text-sm text-muted-foreground">
              {tDealType(property.dealType)} · {tStatus(property.status)} · {property.agentName}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/properties/${property.id}/edit`}>{t("edit")}</Link>
          </Button>
        </div>

        <Section title={t("ownerTitle")}>
          <Field label={t("ownerNameLabel")} value={property.ownerName} />
          <Field label={t("ownerPhoneLabel")} value={property.ownerPhone} />
          <Field label={t("ownerEmailLabel")} value={property.ownerEmail} />
        </Section>

        <Section title={t("commissionTitle")}>
          <Field
            label={t("percentLabel")}
            value={property.commissionPercent != null ? `${property.commissionPercent}%` : undefined}
          />
          <Field
            label={t("vatModeLabel")}
            value={
              property.commissionVatMode
                ? property.commissionVatMode === "included"
                  ? t("vatIncluded")
                  : t("vatPlus")
                : undefined
            }
          />
          <Field label={t("exclusivityStartLabel")} value={property.exclusivityStartDate} />
          <Field label={t("exclusivityEndLabel")} value={property.exclusivityEndDate} />
        </Section>

        <Section title={t("mediaTitle")}>
          <Field
            label={t("mainPhotosLabel")}
            value={property.mainPhotos?.length ? String(property.mainPhotos.length) : undefined}
          />
          <Field
            label={t("additionalPhotosLabel")}
            value={property.additionalPhotos?.length ? String(property.additionalPhotos.length) : undefined}
          />
          {property.forms?.map((f) => (
            <a
              key={f.driveFileId}
              href={f.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-secondary underline-offset-4 hover:underline"
            >
              {f.name}
            </a>
          ))}
        </Section>

        <Section title={t("technicalTitle")}>
          <Field label={t("roomsLabel")} value={property.rooms} />
          <Field label={t("sizeSqmLabel")} value={property.sizeSqm} />
          <Field label={t("askingPriceLabel")} value={property.askingPrice} />
          <Field label={t("floorLabel")} value={property.floor} />
        </Section>

        {canSeeRatings && (
          <Section title={t("ratingsTitle")}>
            <Field label={t("sellabilityLabel")} value={property.sellabilityRating} />
            <Field label={t("sellerMotivationLabel")} value={property.sellerMotivation} />
            <Field label={t("letterGradeLabel")} value={property.letterGrade} />
          </Section>
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
