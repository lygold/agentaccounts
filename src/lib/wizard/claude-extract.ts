import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { WizardDraft } from "./draft";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Ported verbatim from sikkumPigisha's claude-extract.ts, prompt included —
// this is the wizard's own AI-extraction logic, not agentLedger plumbing.
//
// TODO: this prompt has no notion of representation (owner/buyer/both) at
// extraction time, so it doesn't know phone/teudatZehut are only actually
// required for the side the agent represents (validateDraft in
// src/lib/wizard/validation.ts already gates on that correctly downstream) —
// worth revisiting so extraction doesn't over-emphasize/flag missing contact
// info for a side that was never going to need it. Reported by Levi
// 2026-08-16 (against sikkumPigisha; carried over unfixed on purpose).
//
// TODO: also reported as always inferring "both" in practice, per the
// "infer from which agent sections are filled" rule below — likely because
// these meeting-summary documents list full owner+buyer details regardless
// of which side the agent actually represents, so "which sections are
// filled" isn't a reliable signal for this document type. Needs a better
// heuristic (or asking explicitly post-extraction). Reported by Levi
// 2026-08-16 (same — carried over unfixed on purpose).
const SYSTEM_PROMPT = `You are extracting real estate deal information from Israeli meeting summary documents (השיגפ םוכיס).
Return ONLY valid JSON — no explanation, no markdown, just the JSON object.
Include only fields that have actual values in the document. Do not invent data.

Important rules:
- Text in parentheses next to a person's name (e.g. "referral from...", "daughter of...", "son handles...") is a note — put it in officeNotes, not as part of the name
- "/" in a buyer or owner name means two people — split into two separate entries
- A relative vacating date (e.g. "10 months from signing") — put in paymentTerms as text, leave vacatingDate empty
- vacatingDate is the date the property will be vacated/handed over, as agreed in the deal terms — NOT the date the document itself was written/produced. If the only date-like value near "פינוי" is the document's own creation/print date, leave vacatingDate empty
- Referral notes ("מ הינפה" ,"...לש הינפה...") → officeNotes
- Empty template fields with no value — ignore completely
- price — number only, no commas or currency symbol
- currency — "ILS" for shekel (₪), "USD" for dollar ($)
- If representation is not stated explicitly, infer from which agent sections are filled
- Default language to "hebrew" unless the document is clearly in English

Expected JSON structure (include only relevant fields):
{
  "dealType": "sale" | "rental",
  "representation": "owner" | "buyer" | "both",
  "language": "hebrew" | "english",
  "signingDate": "YYYY-MM-DD",
  "property": {
    "neighbourhood": "",
    "street": "",
    "buildingNumber": "",
    "apartmentNumber": "",
    "gushChelka": "",
    "rooms": 0,
    "sizeSqm": 0
  },
  "priceTerms": {
    "price": 0,
    "currency": "ILS" | "USD",
    "paymentTerms": "",
    "vacatingDate": "YYYY-MM-DD"
  },
  "owners": [{ "name": "", "teudatZehut": "", "phone": "", "email": "" }],
  "ownerLawyer": { "name": "", "phone": "", "email": "" },
  "ownerAgent": { "name": "", "phone": "", "email": "" },
  "buyers": [{ "name": "", "teudatZehut": "", "phone": "", "email": "" }],
  "buyerLawyer": { "name": "", "phone": "", "email": "" },
  "buyerAgent": { "name": "", "phone": "", "email": "" },
  "notes": "",
  "officeNotes": ""
}`;

export async function extractDraftFromText(
  text: string,
): Promise<Partial<WizardDraft>> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `ךמסמ:\n${text}` }],
  });

  const raw = response.content[0];
  if (raw.type !== "text") throw new Error("Unexpected Claude response type");

  const jsonMatch = raw.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Claude response");
  return JSON.parse(jsonMatch[0]) as Partial<WizardDraft>;
}

export async function extractDraftFromImage(
  buffer: Buffer,
  mimeType: string,
): Promise<Partial<WizardDraft>> {
  const base64 = buffer.toString("base64");
  const mediaType = (
    mimeType.startsWith("image/") ? mimeType : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          { type: "text", text: "ךמסמ:" },
        ],
      },
    ],
  });

  const raw = response.content[0];
  if (raw.type !== "text") throw new Error("Unexpected Claude response type");
  const jsonMatch = raw.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Claude response");
  return JSON.parse(jsonMatch[0]) as Partial<WizardDraft>;
}
