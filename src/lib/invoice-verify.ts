import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { extractText } from "./wizard/extract/text";
import type { DealSide, InvoiceVerification } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// InvoiceVerification itself lives in types.ts (like every other Deal field
// type) — advisory check only, never blocks an upload or a payment.
// OCR/extraction on a scanned or photographed invoice won't always be
// perfect; the point is catching honest mistakes (wrong deal attached,
// wrong amount) before money moves, not adding friction to a legitimate
// one. Ariyel always sees the actual file and can mark paid regardless.

/** The literal Hebrew term Claude should look for in the invoice's own
 *  text — not a UI-locale label (agentLedger's Enums.side translation is
 *  for the app's own UI and could be English), since the source document
 *  itself is always in Hebrew regardless of which locale the admin/agent
 *  is browsing in. */
const SIDE_LABELS_HE: Record<DealSide, string> = {
  seller: "מוכר",
  buyer: "קונה",
  landlord: "משכיר",
  renter: "שוכר",
};

const SYSTEM_PROMPT = `You are checking an Israeli tax invoice (חשבונית מס) issued by a real-estate agent to their brokerage office, verifying it corresponds to a specific commission payment.
Return ONLY valid JSON — no explanation, no markdown, just the JSON object.

Expected JSON structure:
{
  "amount": <number or null>,
  "mentionsPropertyAddress": <boolean>,
  "mentionsClientName": <boolean>,
  "mentionsSide": <boolean>,
  "note": "<short note in Hebrew, only if something looks off — omit otherwise>"
}

Rules:
- "amount" is the invoice's own final stated total (VAT-inclusive) — the
  amount the office should pay. Number only, no currency symbol or commas.
  null if you can't find a clear total.
- "mentionsPropertyAddress"/"mentionsClientName"/"mentionsSide": true only if
  the invoice's own text (description/line items) references the given
  value, even partially or abbreviated (e.g. just a street name, just a
  surname, or the bare word itself for the side). Don't guess when unsure —
  false rather than assume a match.`;

function buildUserPrompt(
  expectedAmount: number,
  propertyAddress: string | undefined,
  clientName: string,
  sideLabel: string,
): string {
  return [
    `Expected amount (₪, VAT-inclusive): ${expectedAmount}`,
    `Expected property address: ${propertyAddress ?? "(not provided)"}`,
    `Expected client name: ${clientName}`,
    `Expected side (Hebrew term the invoice should reference): ${sideLabel}`,
  ].join("\n");
}

function parseVerification(raw: string, expectedAmount: number): InvoiceVerification {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Claude response");
  const parsed = JSON.parse(jsonMatch[0]) as {
    amount: number | null;
    mentionsPropertyAddress: boolean;
    mentionsClientName: boolean;
    mentionsSide: boolean;
    note?: string;
  };
  const extractedAmount = typeof parsed.amount === "number" ? parsed.amount : null;
  return {
    extractedAmount,
    amountMatches: extractedAmount === null ? null : Math.abs(extractedAmount - expectedAmount) < 0.1,
    mentionsPropertyAddress: !!parsed.mentionsPropertyAddress,
    mentionsClientName: !!parsed.mentionsClientName,
    mentionsSide: !!parsed.mentionsSide,
    note: parsed.note || undefined,
  };
}

/**
 * Runs at invoice-upload time (see services/deals.ts uploadDealAgentInvoice).
 * Never throws — extraction failures come back as `extractionFailed: true`
 * so the upload itself always succeeds regardless.
 */
export async function verifyAgentInvoice(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  expectedAmount: number,
  propertyAddress: string | undefined,
  clientName: string,
  side: DealSide,
): Promise<InvoiceVerification> {
  try {
    const { text, isImage } = await extractText(buffer, mimeType, fileName);
    const userPrompt = buildUserPrompt(expectedAmount, propertyAddress, clientName, SIDE_LABELS_HE[side]);

    const response = isImage
      ? await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: (mimeType.startsWith("image/") ? mimeType : "image/jpeg") as
                      | "image/jpeg"
                      | "image/png"
                      | "image/webp"
                      | "image/gif",
                    data: buffer.toString("base64"),
                  },
                },
                { type: "text", text: userPrompt },
              ],
            },
          ],
        })
      : await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `${userPrompt}\n\nInvoice text:\n${text}` }],
        });

    const raw = response.content[0];
    if (raw.type !== "text") throw new Error("Unexpected Claude response type");
    return parseVerification(raw.text, expectedAmount);
  } catch (err) {
    console.error("verifyAgentInvoice failed (non-fatal, upload still proceeds):", err);
    return {
      extractedAmount: null,
      amountMatches: null,
      mentionsPropertyAddress: false,
      mentionsClientName: false,
      mentionsSide: false,
      extractionFailed: true,
    };
  }
}
