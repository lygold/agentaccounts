import "server-only";
import { z } from "zod";

export const DealSchema = z.object({
  agentId: z.string().trim().min(1),
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

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

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
    phone: optionalText(30),
    role: AgentRoleEnum,
    team: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    isTeamLeader: z.boolean(),
    isOnboarding: z.boolean(),
    fullNameEnglish: optionalText(120),
    firstNameHebrew: optionalText(120),
    surname: optionalText(120),
    licenseNumber: optionalText(40),
    /** yyyy-mm-dd from an <input type="date">, or "". */
    expenseChargeDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    officeFeeExVat: z.coerce
      .number()
      .positive()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((d) => d.email || d.phone, {
    message: "Add a phone number or an email — it's how the agent signs in.",
    path: ["email"],
  });
