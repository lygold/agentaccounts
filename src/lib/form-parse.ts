import "server-only";
import { z } from "zod";

export const DealSchema = z.object({
  agentName: z.string().trim().min(1),
  dealType: z.enum(["sale", "rental"]),
  side: z.enum(["seller", "buyer", "landlord", "renter"]),
  clientName: z.string().trim().min(1),
  propertyAddress: z.string().trim().optional(),
  salePrice: z.coerce.number().positive(),
  commissionPercent: z.coerce.number().positive(),
  hasReferral: z.boolean(),
  referralPercent: z.coerce.number().optional(),
  sikkumDate: z.string().trim().optional(),
  signingDate: z.string().trim().optional(),
});

export const IncomeEntrySchema = z.object({
  amount: z.coerce.number().positive(),
  receivedDate: z.string().trim().min(1),
});

export const LedgerEntrySchema = z.object({
  type: z.enum(["commission", "expense", "payment_to_agent", "payment_by_agent"]),
  amount: z.coerce.number(),
  description: z.string().trim().min(1),
  date: z.string().trim().min(1),
});
