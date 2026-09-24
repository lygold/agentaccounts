import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { canSeeReferral } from "@/lib/auth/scope";
import { getReferral } from "@/lib/store/referrals";
import { getAgentById } from "@/lib/store/agents";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addReferralNote, updateReferralLeadStatus } from "./actions";

const QUICK_STATUSES = ["leadStatusQuickActive", "leadStatusQuickCold", "leadStatusQuickStopped"] as const;

/** Referral management (Levi: "leads need to be manageable") — read-only
 *  client info (what was handed off, never edited after the fact) plus two
 *  things that ARE editable post-handoff: an append-only check-in log and
 *  a free-text lead status ("cold", "client stopped looking" — examples,
 *  not a fixed list). */
export default async function ReferralDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const referral = await getReferral(id);
  if (!referral) notFound();
  if (!(await canSeeReferral(session, referral))) notFound();

  const [t, tDirection, tClientType, tStatus, tQuick] = await Promise.all([
    getTranslations("ReferralDetail"),
    getTranslations("ReferralNew.direction"),
    getTranslations("ReferralNew.clientType"),
    getTranslations("Enums.referralStatus"),
    getTranslations("ReferralDetail"),
  ]);

  const sendingAgent = await getAgentById(referral.sendingAgentId);
  const iAmSender = referral.sendingAgentId === session.agentId;
  const receivingAgent = referral.receivingAgentId ? await getAgentById(referral.receivingAgentId) : null;
  // The phone matters as much as the name here — for a plain "outgoing"
  // (external) referral it's the ONLY way to tell what number the invite
  // actually went to, since there's no AgentRecord to look it up
  // elsewhere. Per Levi: this was missing and needed fixing.
  const counterpartName = iAmSender
    ? (receivingAgent?.name ?? referral.receivingAgentName ?? "—")
    : (sendingAgent?.name ?? "—");
  const counterpartPhone = iAmSender
    ? (receivingAgent?.phone ?? referral.receivingAgentPhone)
    : (sendingAgent?.phone ?? null);

  return (
    <div>
      <Nav />
      <main className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
        <Link href="/referrals" className="text-sm text-muted-foreground underline">
          {t("backToList")}
        </Link>
        <h1 className="text-2xl font-bold">{referral.clientName}</h1>

        <Section title={t("clientTitle")}>
          <Row label={t("clientNameLabel")} value={referral.clientName} />
          <Row label={t("clientPhoneLabel")} value={referral.clientPhone} dir="ltr" />
          <Row label={t("clientEmailLabel")} value={referral.clientEmail} dir="ltr" />
          <Row label={t("clientTypeLabel")} value={tClientType(referral.clientType)} />
          <Row label={t("notesLabel")} value={referral.notes} />
        </Section>

        <Section title={t("handoffTitle")}>
          <Row label={t("directionLabel")} value={tDirection(referral.direction)} />
          <Row label={iAmSender ? t("toLabel") : t("fromLabel")} value={counterpartName} />
          <Row label={t("counterpartPhoneLabel")} value={counterpartPhone} dir="ltr" />
          {iAmSender && referral.receivingAgentOffice && (
            <Row label={t("counterpartOfficeLabel")} value={referral.receivingAgentOffice} />
          )}
          {iAmSender && referral.receivingAgentEmail && (
            <Row label={t("counterpartEmailLabel")} value={referral.receivingAgentEmail} dir="ltr" />
          )}
          <Row label={t("statusLabel")} value={tStatus(referral.status)} />
          <Row label={t("createdAtLabel")} value={new Date(referral.createdAt).toLocaleString()} dir="ltr" />
          {referral.respondedAt && (
            <Row
              label={t("respondedAtLabel")}
              value={new Date(referral.respondedAt).toLocaleString()}
              dir="ltr"
            />
          )}
        </Section>

        <Section title={t("leadStatusTitle")}>
          <p className="text-sm">{referral.leadStatus ?? t("leadStatusNone")}</p>
          <form action={updateReferralLeadStatus} className="flex flex-col gap-2">
            <input type="hidden" name="referralId" value={referral.id} />
            <div className="flex flex-wrap gap-2">
              {QUICK_STATUSES.map((key) => (
                <Button key={key} type="submit" name="leadStatus" value={tQuick(key)} size="sm" variant="secondary">
                  {tQuick(key)}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input name="leadStatus" placeholder={t("leadStatusPlaceholder")} className="flex-1" />
              <Button type="submit">{t("leadStatusSave")}</Button>
            </div>
          </form>
        </Section>

        <Section title={t("activityTitle")}>
          {referral.activityLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("activityEmpty")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {[...referral.activityLog].reverse().map((entry) => (
                <div key={entry.id} className="border-b pb-2 last:border-b-0 last:pb-0">
                  <p className="text-sm">{entry.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.authorName} · {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          <form action={addReferralNote} className="flex flex-col gap-2">
            <input type="hidden" name="referralId" value={referral.id} />
            <Label htmlFor="body" className="sr-only">
              {t("addNotePlaceholder")}
            </Label>
            <Textarea id="body" name="body" placeholder={t("addNotePlaceholder")} rows={2} required />
            <Button type="submit" size="sm" className="self-start">
              {t("addNoteSubmit")}
            </Button>
          </form>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, dir }: { label: string; value: string | null; dir?: "ltr" | "rtl" }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span dir={dir}>{value}</span>
    </div>
  );
}
