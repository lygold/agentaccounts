import type { PropertyRecord } from "../types";
import {
  CONTRACT_TYPE_LABEL,
  NO,
  RATING_LOW_CAPTION,
  YAD2_TRACK_LABEL,
  YES,
} from "../property-wizard/options";

/**
 * PropertyRecord -> Monday "Properties Raw Data" column values. Pure (no I/O).
 *
 * Column ids and types are the live board's (checked against the column dump
 * 2026-10-05), and each value is in the format its column TYPE needs - the
 * original bug was a dropdown column (מע"מ) being sent a status-style
 * `{label}` instead of `{labels: []}`, which made Monday reject the whole item:
 *
 *   text / numbers  -> plain string / number
 *   status          -> { label }
 *   dropdown        -> { labels: [label, ...] }
 *   long_text       -> { text }
 *   date            -> { date: "YYYY-MM-DD" }
 *   board_relation  -> { item_ids: [id] }
 *
 * Not written (deliberately): the file columns (photos/forms live in storage +
 * Drive), "Potential Com.", "End Date of Yad2", automation/status-pipeline
 * columns, and the second referral-percent / agent-relation columns.
 */

export const COL = {
  agentRelation: "connect_boards__1",
  agentName: "text_mkwrascb",
  date: "date_mkmsh2fs",
  dealType: "color__1",
  contractType: "color7__1",
  listingStatus: "status_1_mkn4k7fk",
  virtualTour: "text7__1",
  youtubeUrl: "text26__1",
  youtubeText: "text61__1",
  city: "text56__1",
  neighbourhood: "text57__1",
  street: "text37__1",
  buildingNumber: "numeric__1",
  entrance: "text91__1",
  apartmentNumber: "numeric2__1",
  publishNotes: "dropdown01__1",
  propertyType: "dropdown__1",
  twoDescriptions: "dropdown9__1",
  yad2Track: "color_mkt5rnyx",
  descriptionYad2: "long_text5__1",
  titleHe: "long_text7__1",
  descriptionHe: "long_text2__1",
  titleEn: "long_text1__1",
  descriptionEn: "long_text35__1",
  referralSource: "dropdown0__1",
  referralSourceOther: "dropdown596__1",
  externalAgentName: "text654__1",
  externalAgentOffice: "text4__1",
  referralPercent: "numeric1__1",
  externalAgentPhone: "text39__1",
  commissionPercent: "numeric3__1",
  vatMode: "dropdown09__1",
  ownerName: "text615__1",
  ownerPhone: "text09__1",
  ownerEmail: "text08__1",
  rooms: "numeric6__1",
  bedrooms: "numeric142__1",
  toilets: "numeric24__1",
  bathrooms: "numeric18__1",
  masterSuite: "dropdown29__1",
  floor: "numeric9__1",
  floorsTotal: "numeric4__1",
  levels: "text10__1",
  sizeSqm: "numeric14__1",
  plotSizeSqm: "numeric17__1",
  startingPrice: "numeric5__1",
  askingPrice: "numeric7__1",
  condition: "dropdown1__1",
  elevator: "dropdown8__1",
  balcony: "dropdown86__1",
  balconySize: "numeric96__1",
  garden: "dropdown6__1",
  gardenSize: "numeric8__1",
  ac: "dropdown11__1",
  parking: "dropdown861__1",
  parkingCount: "numbers__1",
  storage: "dropdown2__1",
  storageSize: "numbers9__1",
  safeRoom: "dropdown7__1",
  features: "dropdown4__1",
  sellability: "dropdown5__1",
  motivation: "dropdown54__1",
  priceToCma: "dropdown59__1",
  ownerPressure: "dropdown08__1",
  trueCmaValue: "numbers0__1",
  monthsToSell: "numbers03__1",
  letterGrade: "dropdown092__1",
  copyright: "dropdown_mm3e11vw",
  renderings: "dropdown_mm3edve6",
} as const;

const VAT_LABEL = { plus: "פלוס מעמ", included: "כולל מעמ" } as const;
const NUMERIC = /^\d+(\.\d+)?$/;

export interface ColumnBuild {
  values: Record<string, unknown>;
  /** Values we could not express in their column (e.g. a building number
   *  like "12א" for a numbers column) - reported, never silently dropped. */
  skipped: string[];
}

/** Item name: "street building דירה apt" (existing convention). */
export function propertyItemName(p: PropertyRecord): string {
  return (
    [p.street, p.buildingNumber, p.apartmentNumber ? `דירה ${p.apartmentNumber}` : undefined]
      .filter(Boolean)
      .join(" ")
      .trim() || p.id
  );
}

export function ratingLabel(
  key: keyof typeof RATING_LOW_CAPTION,
  n: number | undefined,
): string | undefined {
  if (n == null) return undefined;
  return n === 0 ? RATING_LOW_CAPTION[key] : String(n);
}

export function buildPropertyColumns(p: PropertyRecord, agentMondayItemId?: string): ColumnBuild {
  const values: Record<string, unknown> = {};
  const skipped: string[] = [];

  const text = (col: string, v: string | undefined) => {
    if (v != null && v.trim() !== "") values[col] = v;
  };
  const num = (col: string, v: number | undefined) => {
    if (v != null && Number.isFinite(v)) values[col] = v;
  };
  /** A numbers column fed from a free-text field (building / apartment). */
  const numFromText = (col: string, v: string | undefined, what: string) => {
    if (v == null || v.trim() === "") return;
    if (NUMERIC.test(v.trim())) values[col] = Number(v.trim());
    else skipped.push(`${what} "${v}" is not a plain number - left off its numbers column`);
  };
  const dropdown = (col: string, v: string | undefined) => {
    if (v != null && v !== "") values[col] = { labels: [v] };
  };
  const status = (col: string, v: string | undefined) => {
    if (v) values[col] = { label: v };
  };
  const longText = (col: string, v: string | undefined) => {
    if (v != null && v.trim() !== "") values[col] = { text: v };
  };
  const yesNo = (col: string, v: boolean | undefined) => {
    if (typeof v === "boolean") values[col] = { labels: [v ? YES : NO] };
  };

  // --- meta ---
  status(COL.dealType, p.dealType === "rental" ? "השכרה" : "מכירה");
  status(COL.listingStatus, "Active");
  status(COL.contractType, p.contractType ? CONTRACT_TYPE_LABEL[p.contractType as keyof typeof CONTRACT_TYPE_LABEL] : undefined);
  if (agentMondayItemId && Number.isFinite(Number(agentMondayItemId))) {
    values[COL.agentRelation] = { item_ids: [Number(agentMondayItemId)] };
  }
  text(COL.agentName, p.agentName);
  values[COL.date] = { date: p.createdAt.slice(0, 10) };

  // --- links ---
  text(COL.virtualTour, p.virtualTourUrl);
  text(COL.youtubeUrl, p.youtubeUrl);
  text(COL.youtubeText, p.youtubeDisplayText);

  // --- address ---
  text(COL.city, p.city);
  text(COL.neighbourhood, p.neighbourhood);
  text(COL.street, p.street);
  numFromText(COL.buildingNumber, p.buildingNumber, "Building number");
  text(COL.entrance, p.entrance);
  numFromText(COL.apartmentNumber, p.apartmentNumber, "Apartment number");
  dropdown(COL.publishNotes, p.publishNotes);
  dropdown(COL.propertyType, p.propertyType);

  // --- descriptions ---
  longText(COL.titleHe, p.titleHe);
  longText(COL.titleEn, p.titleEn);
  longText(COL.descriptionHe, p.descriptionHe);
  longText(COL.descriptionEn, p.descriptionEn);
  if (typeof p.useSeparateYad2Description === "boolean") {
    dropdown(COL.twoDescriptions, p.useSeparateYad2Description ? YES : NO);
  }
  if (p.useSeparateYad2Description) longText(COL.descriptionYad2, p.descriptionYad2);
  status(COL.yad2Track, p.yad2Package ? YAD2_TRACK_LABEL[p.yad2Package] : undefined);

  // --- where the client came from ---
  dropdown(COL.referralSource, p.referralSource);
  dropdown(COL.referralSourceOther, p.referralSourceOther);
  text(COL.externalAgentName, p.externalReferringAgentName);
  text(COL.externalAgentOffice, p.externalReferringAgentOffice);
  text(COL.externalAgentPhone, p.externalReferringAgentPhone);
  num(COL.referralPercent, p.referralPercentOfCommission);

  // --- commission & owner ---
  num(COL.commissionPercent, p.commissionPercent);
  dropdown(COL.vatMode, p.commissionVatMode ? VAT_LABEL[p.commissionVatMode] : undefined);
  text(COL.ownerName, p.ownerName);
  text(COL.ownerPhone, p.ownerPhone);
  text(COL.ownerEmail, p.ownerEmail);

  // --- technical ---
  num(COL.rooms, p.rooms);
  num(COL.bedrooms, p.bedrooms);
  num(COL.toilets, p.toilets);
  num(COL.bathrooms, p.bathrooms);
  dropdown(COL.masterSuite, p.masterSuite);
  num(COL.floor, p.floor);
  num(COL.floorsTotal, p.floorsTotal);
  text(COL.levels, p.levels);
  num(COL.sizeSqm, p.sizeSqm);
  num(COL.plotSizeSqm, p.plotSizeSqm);
  num(COL.startingPrice, p.startingPrice);
  num(COL.askingPrice, p.askingPrice);
  dropdown(COL.condition, p.condition);
  dropdown(COL.elevator, p.elevator);
  dropdown(COL.balcony, p.balcony);
  num(COL.balconySize, p.balconySizeSqm);
  dropdown(COL.garden, p.garden);
  num(COL.gardenSize, p.gardenSizeSqm);
  dropdown(COL.ac, p.ac);
  dropdown(COL.parking, p.parking);
  num(COL.parkingCount, p.parkingCount);
  dropdown(COL.storage, p.storage);
  num(COL.storageSize, p.storageSizeSqm);
  dropdown(COL.safeRoom, p.safeRoom);
  if (p.additionalFeatures?.length) values[COL.features] = { labels: p.additionalFeatures };

  // --- media answers ---
  yesNo(COL.copyright, p.copyrightConfirmed);
  yesNo(COL.renderings, p.renderingsConfirmed);

  // --- internal ratings ---
  dropdown(COL.sellability, ratingLabel("sellabilityRating", p.sellabilityRating));
  dropdown(COL.motivation, ratingLabel("sellerMotivation", p.sellerMotivation));
  dropdown(COL.priceToCma, ratingLabel("priceToCmaMatch", p.priceToCmaMatch));
  dropdown(COL.ownerPressure, ratingLabel("ownerPressureToSell", p.ownerPressureToSell));
  num(COL.trueCmaValue, p.trueCmaValue);
  num(COL.monthsToSell, p.estimatedMonthsToSell);
  dropdown(COL.letterGrade, p.letterGrade);

  return { values, skipped };
}

/** The minimum that still creates a usable item if the full set is rejected:
 *  the item (named by address), its agent, deal type and listing status. */
export function buildCoreColumns(p: PropertyRecord, agentMondayItemId?: string): Record<string, unknown> {
  const full = buildPropertyColumns(p, agentMondayItemId).values;
  const keep = [COL.dealType, COL.listingStatus, COL.agentRelation, COL.agentName, COL.date, COL.street, COL.city];
  return Object.fromEntries(Object.entries(full).filter(([k]) => keep.includes(k as never)));
}
