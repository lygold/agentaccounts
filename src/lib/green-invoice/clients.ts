import "server-only";
import { greenInvoiceFetch } from "./client";

export interface GreenInvoiceClient {
  id: string;
  name: string;
  emails?: string[];
}

interface SearchResponse {
  total: number;
  page: number;
  pageSize: number;
  items: GreenInvoiceClient[];
}

export async function searchGreenInvoiceClients(name: string): Promise<GreenInvoiceClient[]> {
  const data = await greenInvoiceFetch<SearchResponse>("/clients/search", {
    method: "POST",
    body: JSON.stringify({ name, pageSize: 10 }),
  });
  return data.items ?? [];
}

export async function createGreenInvoiceClient(input: {
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
}): Promise<GreenInvoiceClient> {
  return greenInvoiceFetch<GreenInvoiceClient>("/clients", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      emails: input.email ? [input.email] : undefined,
      phone: input.phone,
      taxId: input.taxId,
    }),
  });
}

export type ClientResolution =
  | { status: "resolved"; clientId: string }
  | { status: "ambiguous"; candidates: GreenInvoiceClient[] };

/**
 * Search-then-resolve, per the roadmap plan: 0 matches → create a new
 * client; exactly 1 → use it; 2+ → ambiguous, the caller must surface the
 * candidates for a human to pick or explicitly create new. Green Invoice's
 * search only matches name/email/contactPerson — no phone or tax-id filter
 * — so ambiguity is a real, expected case for common Hebrew names, not an
 * edge case to shrug off.
 */
export async function resolveGreenInvoiceClient(name: string): Promise<ClientResolution> {
  const matches = await searchGreenInvoiceClients(name);
  if (matches.length === 0) {
    const created = await createGreenInvoiceClient({ name });
    return { status: "resolved", clientId: created.id };
  }
  if (matches.length === 1) {
    return { status: "resolved", clientId: matches[0].id };
  }
  return { status: "ambiguous", candidates: matches };
}
