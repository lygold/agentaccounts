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

const AgentRoleEnum = z.enum(["agent", "team_leader", "manager", "admin"]);

/** Admin add/edit agent form. Email/phone are optional individually but at
 *  least one must be present — it's the login identifier. */
export const AgentFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    email: z
      .string()
      .trim()
      .email("Enter a valid email.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    phone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    role: AgentRoleEnum,
    district: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    isTeamLeader: z.boolean(),
  })
  .refine((d) => d.email || d.phone, {
    message: "Add a phone number or an email — it's how the agent signs in.",
    path: ["email"],
  });
