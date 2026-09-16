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

export function toMetaPhone(israeliPhone: string): string {
  const cleaned = israeliPhone.replace(/[\s\-().+]/g, "");
  if (cleaned.startsWith("972")) return cleaned;
  if (cleaned.startsWith("0")) return "972" + cleaned.slice(1);
  return cleaned;
}
