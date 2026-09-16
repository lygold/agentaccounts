"use server";

import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { requireSession, isManager } from "@/lib/auth/session-cookie";
import { getProperty, updateProperty } from "@/lib/store/properties";
import { summarizeChanges, notifyPropertyUpdated } from "@/lib/services/property-notify";
import { isNextJsRedirect } from "@/lib/wizard/action-utils";
import type { PropertyRecord } from "@/lib/types";

const Schema = z.object({
  propertyId: z.string().min(1),
  status: z.enum(["active", "sold", "rented", "off_market", "withdrawn"]),
  city: z.string().trim().optional(),
  street: z.string().trim().optional(),
  buildingNumber: z.string().trim().optional(),
  entrance: z.string().trim().optional(),
  apartmentNumber: z.string().trim().optional(),
  ownerName: z.string().trim().optional(),
  ownerPhone: z.string().trim().optional(),
  ownerEmail: z.string().trim().optional(),
  commissionPercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  commissionVatMode: z.enum(["plus", "included"]),
  exclusivityStartDate: z.string().trim().optional(),
  exclusivityEndDate: z.string().trim().optional(),
  propertyType: z.string().trim().optional(),
  referralSource: z.string().trim().optional(),
  titleHe: z.string().trim().optional(),
  titleEn: z.string().trim().optional(),
  descriptionHe: z.string().trim().optional(),
  descriptionEn: z.string().trim().optional(),
  rooms: z.coerce.number().optional().or(z.literal("")),
  sizeSqm: z.coerce.number().optional().or(z.literal("")),
  floor: z.coerce.number().optional().or(z.literal("")),
  askingPrice: z.coerce.number().optional().or(z.literal("")),
  startingPrice: z.coerce.number().optional().or(z.literal("")),
  condition: z.string().trim().optional(),
});

function orUndef<T>(v: T | "" | undefined): T | undefined {
  return v === "" || v === undefined ? undefined : v;
}

export async function submitPropertyEdit(formData: FormData) {
  let propertyId: string | undefined;
  try {
    const session = await requireSession();
    const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return;
    const d = parsed.data;
    propertyId = d.propertyId;

    const property = await getProperty(d.propertyId);
    if (!property || property.officeId !== session.officeId) notFound();
    if (property.agentId !== session.agentId && !isManager(session)) {
      redirect(`/properties/${d.propertyId}`);
    }

    const patch: Partial<PropertyRecord> = {
      status: d.status,
      city: orUndef(d.city),
      street: orUndef(d.street),
      buildingNumber: orUndef(d.buildingNumber),
      entrance: orUndef(d.entrance),
      apartmentNumber: orUndef(d.apartmentNumber),
      ownerName: orUndef(d.ownerName),
      ownerPhone: orUndef(d.ownerPhone),
      ownerEmail: orUndef(d.ownerEmail),
      commissionPercent: orUndef(d.commissionPercent),
      commissionVatMode: d.commissionVatMode,
      exclusivityStartDate: orUndef(d.exclusivityStartDate),
      exclusivityEndDate: orUndef(d.exclusivityEndDate),
      propertyType: orUndef(d.propertyType),
      referralSource: orUndef(d.referralSource),
      titleHe: orUndef(d.titleHe),
      titleEn: orUndef(d.titleEn),
      descriptionHe: orUndef(d.descriptionHe),
      descriptionEn: orUndef(d.descriptionEn),
      rooms: orUndef(d.rooms),
      sizeSqm: orUndef(d.sizeSqm),
      floor: orUndef(d.floor),
      askingPrice: orUndef(d.askingPrice),
      startingPrice: orUndef(d.startingPrice),
      condition: orUndef(d.condition),
    };

    const changes = summarizeChanges(property, patch);
    const updated = await updateProperty(d.propertyId, patch, session.officeId);
    if (updated && changes.length > 0) {
      await notifyPropertyUpdated(updated, changes, {
        id: session.agentId,
        name: session.agentName,
      });
    }

    redirect(`/properties/${d.propertyId}`);
  } catch (e) {
    if (isNextJsRedirect(e)) throw e;
    console.error("submitPropertyEdit failed:", e);
    redirect(`/properties/${propertyId}/edit?error=save`);
  }
}
