import "server-only";

const GRAPH_VERSION = "v25.0";

interface WabaConfig {
  phoneId: string;
  token: string;
  templateName: string;
  templateLang: string;
}

function getConfig(): WabaConfig {
  const phoneId = process.env.META_WABA_PHONE_ID;
  const token = process.env.META_WABA_TOKEN;
  const templateName = process.env.META_WABA_TEMPLATE_NAME;
  const templateLang = process.env.META_WABA_TEMPLATE_LANG ?? "he";
  if (!phoneId || !token || !templateName) {
    throw new Error(
      "WABA not configured: set META_WABA_PHONE_ID, META_WABA_TOKEN, META_WABA_TEMPLATE_NAME",
    );
  }
  return { phoneId, token, templateName, templateLang };
}

/** Same Meta WABA account/template as sikkumPigisha — see that repo's
 *  src/lib/waba/client.ts for the full rationale. */
export async function sendOtpTemplate(phoneE164: string, otp: string): Promise<void> {
  const cfg = getConfig();
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneE164,
    type: "template",
    template: {
      name: cfg.templateName,
      language: { code: cfg.templateLang },
      components: [
        { type: "body", parameters: [{ type: "text", text: otp }] },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otp }],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WABA send failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

/**
 * Property-edit notifications to the secretary — a SEPARATE template from
 * the OTP one (Meta's WhatsApp Business API only allows business-initiated
 * messages through pre-approved templates; you can't send free-text).
 * META_WABA_PROPERTY_UPDATE_TEMPLATE_NAME is unset until Levi gets that
 * template approved in Meta Business Manager — until then this throws a
 * clear "not configured" error rather than silently failing, and the
 * caller (property-notify.ts) treats that as "channel not sent", not a
 * hard failure. Once the template exists, its actual variable slots may
 * not match this one-text-param shape — revisit the `components` body
 * here against whatever the approved template actually expects.
 */
export async function sendPropertyUpdateTemplate(phoneE164: string, message: string): Promise<void> {
  const phoneId = process.env.META_WABA_PHONE_ID;
  const token = process.env.META_WABA_TOKEN;
  const templateName = process.env.META_WABA_PROPERTY_UPDATE_TEMPLATE_NAME;
  const templateLang = process.env.META_WABA_TEMPLATE_LANG ?? "he";
  if (!phoneId || !token || !templateName) {
    throw new Error(
      "Property-update WhatsApp template not configured: set META_WABA_PROPERTY_UPDATE_TEMPLATE_NAME " +
        "once a template is approved in Meta Business Manager (META_WABA_PHONE_ID/META_WABA_TOKEN already set for OTP)",
    );
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneE164,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [{ type: "body", parameters: [{ type: "text", text: message }] }],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WABA property-update send failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

interface TemplateComponent {
  type: "body" | "button";
  sub_type?: "url";
  index?: string;
  parameters: Array<{ type: "text"; text: string; parameter_name?: string }>;
}

/** All of the existing office WABA templates use NAMED variables
 *  (`{{recieving_agent_name}}`, not `{{1}}`) — confirmed from the original
 *  Make.com blueprints these replace. Meta's Cloud API requires each body
 *  parameter to carry `parameter_name` matching the template's own
 *  variable name for a named-variable template, or it rejects the whole
 *  call with "(#100) Invalid parameter — Parameter name is missing or
 *  empty". Typos in these names (recieving, cleint, clien) are copied
 *  verbatim from the live templates — Meta matches by exact string. */
function named(
  pairs: Array<[name: string, text: string]>,
): Array<{ type: "text"; text: string; parameter_name: string }> {
  return pairs.map(([parameter_name, text]) => ({ type: "text", text, parameter_name }));
}

/**
 * Shared send for every referral template below — same "not configured
 * throws, caller soft-fails" contract as sendPropertyUpdateTemplate.
 *
 * Takes the already-resolved `templateName` (not an env var NAME to look up
 * dynamically) because Amplify's SSR runtime only sees env vars that
 * next.config.ts baked in via a *static* `process.env.SOME_KEY` read at
 * build time — a dynamic `process.env[someVar]` lookup like this function
 * used to do is invisible to that inlining and reads an empty runtime
 * process.env on Amplify (see src/lib/store/dynamo-client.ts's own note on
 * this). Each exported function below does its own static read and passes
 * the value in; `configLabel` is just for the error message.
 */
async function sendReferralTemplate(
  templateName: string | undefined,
  configLabel: string,
  phoneE164: string,
  components: TemplateComponent[],
): Promise<void> {
  const phoneId = process.env.META_WABA_PHONE_ID;
  const token = process.env.META_WABA_TOKEN;
  const templateLang = process.env.META_WABA_TEMPLATE_LANG ?? "he";
  if (!phoneId || !token || !templateName) {
    throw new Error(
      `Referral WhatsApp template not configured: set ${configLabel} once a template ` +
        "is approved in Meta Business Manager (META_WABA_PHONE_ID/META_WABA_TOKEN already set for OTP)",
    );
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneE164,
    type: "template",
    template: { name: templateName, language: { code: templateLang }, components },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WABA referral send failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

/** The yes/no invite to the receiving agent — this is the EXISTING, already
 *  Meta-approved `outgoing_referrals_approval` template (same one the old
 *  Make scenario used), body params in template order:
 *  {{recieving_agent_name}} then {{agent_name}} ("שלום {{recieving_agent_name}},
 *  {{agent_name}} מרימקס... רוצה להעביר לך הפניה"). The button is a URL
 *  button whose fixed base is still pointed at the old Fillout form in
 *  Meta Business Manager — it needs to be edited there to point at this
 *  app's /r/ path before this can go live (a template content edit, not a
 *  brand-new template, so it shouldn't need a long re-review). Button
 *  param: the referral id, appended to that base — same shape as
 *  sendOtpTemplate's button. */
export async function sendReferralInviteTemplate(
  phoneE164: string,
  receivingAgentName: string,
  sendingAgentName: string,
  referralId: string,
): Promise<void> {
  await sendReferralTemplate(
    process.env.META_WABA_REFERRAL_INVITE_TEMPLATE_NAME,
    "META_WABA_REFERRAL_INVITE_TEMPLATE_NAME",
    phoneE164,
    [
      {
        type: "body",
        parameters: named([
          ["recieving_agent_name", receivingAgentName],
          ["agent_name", sendingAgentName],
        ]),
      },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: referralId }] },
    ],
  );
}

/** The client's actual contact details, sent to the receiving agent only
 *  after they accept via /r/[id]. */
export async function sendReferralDetailsTemplate(
  phoneE164: string,
  params: {
    receivingAgentName: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    clientType: string;
    notes: string;
    sendingAgentName: string;
  },
): Promise<void> {
  await sendReferralTemplate(
    process.env.META_WABA_REFERRAL_DETAILS_TEMPLATE_NAME,
    "META_WABA_REFERRAL_DETAILS_TEMPLATE_NAME",
    phoneE164,
    [
      {
        type: "body",
        parameters: named([
          ["agent", params.receivingAgentName],
          ["cleint_name", params.clientName],
          ["clien_phone", params.clientPhone],
          ["client_email", params.clientEmail],
          ["type", params.clientType],
          ["notes", params.notes],
          ["referrer", params.sendingAgentName],
        ]),
      },
    ],
  );
}

/** Told the sending agent what happened to their referral — accepted,
 *  declined, or never responded within the 48-hour window (Levi added a
 *  3rd {{status}} variable to outgoing_referral_update_agent_on_acceptance
 *  specifically so one template covers all three; there's no separate
 *  "declined" template). `status` is the Hebrew verb phrase slotted into
 *  "{{r_agent_name}} {{status}} את ההפניה" — see the three call sites
 *  (accept/decline/expiry) for the exact text each uses. */
export async function sendReferralStatusTemplate(
  phoneE164: string,
  sendingAgentName: string,
  receivingAgentName: string,
  status: string,
): Promise<void> {
  await sendReferralTemplate(
    process.env.META_WABA_REFERRAL_ACCEPTED_TEMPLATE_NAME,
    "META_WABA_REFERRAL_ACCEPTED_TEMPLATE_NAME",
    phoneE164,
    [
      {
        type: "body",
        parameters: named([
          ["s_agent_name", sendingAgentName],
          ["r_agent_name", receivingAgentName],
          ["status", status],
        ]),
      },
    ],
  );
}

/** Office-wide visibility ping to the broker on every new referral
 *  (creation only, for now — see src/lib/services/referral-notify.ts).
 *  Also still-to-be-created — name its body variables
 *  {{sending_agent_name}}, {{receiving_agent_name}}, {{client_name}}. */
export async function sendBrokerReferralTemplate(
  phoneE164: string,
  sendingAgentName: string,
  receivingAgentName: string,
  clientName: string,
): Promise<void> {
  await sendReferralTemplate(
    process.env.META_WABA_BROKER_REFERRAL_TEMPLATE_NAME,
    "META_WABA_BROKER_REFERRAL_TEMPLATE_NAME",
    phoneE164,
    [
      {
        type: "body",
        parameters: named([
          ["sending_agent_name", sendingAgentName],
          ["receiving_agent_name", receivingAgentName],
          ["client_name", clientName],
        ]),
      },
    ],
  );
}

export function toMetaPhone(israeliPhone: string): string {
  const cleaned = israeliPhone.replace(/[\s\-().+]/g, "");
  if (cleaned.startsWith("972")) return cleaned;
  if (cleaned.startsWith("0")) return "972" + cleaned.slice(1);
  return cleaned;
}
