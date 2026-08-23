import type { DealSide } from "../types";

/**
 * TODO(green-invoice): Levi needs to supply the actual Hebrew wording for
 * each side before this ships — see the roadmap plan's "Open questions."
 * These are placeholders only, so the integration compiles and runs
 * end-to-end in sandbox; the real legal/business text has not been written.
 */
export const REMARKS_TEMPLATES: Record<DealSide, string> = {
  seller: "TODO: נוסח עבור מוכר — טרם סופק",
  buyer: "TODO: נוסח עבור קונה — טרם סופק",
  landlord: "TODO: נוסח עבור משכיר — טרם סופק",
  renter: "TODO: נוסח עבור שוכר — טרם סופק",
};
