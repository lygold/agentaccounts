import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import type { DocLanguage } from "../../types";

// Resolved from process.cwd() rather than a "./public/..." relative string —
// this module runs server-side, and a path relative to the source file
// wouldn't survive Next.js's server bundling. process.cwd() is the app root
// on Amplify's Next.js compute, same assumption other server-side readers
// of public/ in this codebase would need to make.
const FONT_DIR = path.join(process.cwd(), "public", "fonts");

// @react-pdf/renderer's built-in Helvetica font has no Hebrew glyphs — a
// Hebrew-capable font is required for the Hebrew-language document or every
// Hebrew field just renders blank boxes. Noto Sans Hebrew is Google's
// standard for this; bundled as a static asset (public/fonts) rather than
// fetched at render time so this doesn't depend on an external host being
// reachable from wherever the PDF is rendered (Amplify's compute).
// Google ships this family only as a single [wdth,wght] variable font, not
// separate static weight files — @react-pdf/renderer's font engine renders a
// variable font at its default instance regardless of which registered
// entry resolves the lookup, so "Bold" is the same physical file/weight as
// "Regular" here. That's a real limitation (no visually-bold Hebrew text),
// not a bug; swap in real static Regular/Bold TTFs later if that matters.
Font.register({
  family: "NotoSansHebrew",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSansHebrew-Regular.ttf") },
    { src: path.join(FONT_DIR, "NotoSansHebrew-Bold.ttf"), fontWeight: "bold" },
  ],
});

// Single-column, centered layout — matches the wording and structure of
// the legacy Make.com/Fillout-generated "Written Offer" document agents and
// buyers already know (a real sample was used as the reference for this
// rewrite), not the two-column label/value grid this file used before.
const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, lineHeight: 1.6, fontFamily: "Helvetica", textAlign: "center" },
  pageHebrew: { fontFamily: "NotoSansHebrew", direction: "rtl" },
  logo: { width: 140, marginBottom: 16, alignSelf: "center" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
  subtitle: { fontSize: 11, color: "#555", marginBottom: 24 },
  block: { marginBottom: 16 },
  label: { color: "#555" },
  value: { marginTop: 2 },
  signatureBlock: { marginTop: 32, alignItems: "center" },
  signatureRow: { flexDirection: "row", justifyContent: "center", columnGap: 32, marginTop: 12 },
  signatureImage: { width: 160, height: 60, objectFit: "contain" },
});

const COPY = {
  hebrew: {
    title: 'הצעת מחיר\n(למטרת מו"מ – לא מחייב)',
    iAm: "אני,",
    andIAm: "ואני,",
    idLabel: "ת.ז./דרכון:",
    offersToPay: "מציע/ה לשלם עבור הנכס הנמצא ב",
    ownedBy: "אשר נמצא בבעלות",
    price: "מחיר הרכישה",
    paymentTerms: "תנאי תשלום",
    requestedTransferDate: "תאריך מסירה מבוקש",
    extendedTransferDate: "אפשרות להארכת מועד המסירה עד",
    contentsToLeave: "תכולה שתישאר בדירה",
    notes: "הערות נוספות",
    signature: "חתימת הקונה/ים",
  },
  english: {
    title: "Written Offer\n(For negotiation purposes – non binding)",
    iAm: "I,",
    andIAm: "and I,",
    idLabel: "ID/Passport No.:",
    offersToPay: "propose to pay for the property located at:",
    ownedBy: "which is owned by:",
    price: "Purchase price:",
    paymentTerms: "Payment terms:",
    requestedTransferDate: "Requested transfer date:",
    extendedTransferDate: "Possibility of extending the transfer of ownership date until:",
    contentsToLeave: "Contents that you wish to leave in the apartment:",
    notes: "Additional notes:",
    signature: "Buyer/s signature/s",
  },
} satisfies Record<DocLanguage, Record<string, string>>;

export interface OfferDocumentProps {
  language: DocLanguage;
  logoSrc?: string;
  buyerName: string;
  buyerIdNumber: string;
  buyerName2?: string;
  buyerIdNumber2?: string;
  propertyAddress: string;
  ownerName: string;
  price: number;
  paymentTerms?: string;
  requestedTransferDate?: string;
  extendedTransferDate?: string;
  contentsToLeave?: string;
  notes?: string;
  signature1: Buffer;
  signature2?: Buffer;
}

/** Label always shown (blank line if no value) — the negotiation-terms
 *  section of the reference document lists every customary term whether or
 *  not the buyer filled it in, not just the ones that have a value. */
function LabelValue({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      {value && <Text style={styles.value}>{value}</Text>}
    </View>
  );
}

export function OfferDocument(props: OfferDocumentProps) {
  const hebrew = props.language === "hebrew";
  const c = COPY[props.language];

  return (
    <Document>
      <Page size="A4" style={[styles.page, hebrew ? styles.pageHebrew : undefined]}>
        {props.logoSrc && <Image src={props.logoSrc} style={styles.logo} />}
        <Text style={styles.title}>{c.title}</Text>

        <View style={styles.block}>
          <Text>
            {c.iAm} {props.buyerName}, {c.idLabel} {props.buyerIdNumber},
          </Text>
          {props.buyerName2 && (
            <Text style={styles.value}>
              {c.andIAm} {props.buyerName2}, {c.idLabel} {props.buyerIdNumber2 ?? ""},
            </Text>
          )}
        </View>

        <LabelValue label={c.offersToPay} value={props.propertyAddress} />
        <LabelValue label={c.ownedBy} value={props.ownerName} />
        <LabelValue label={c.price} value={props.price.toLocaleString()} />
        <LabelValue label={c.paymentTerms} value={props.paymentTerms} />
        <LabelValue label={c.requestedTransferDate} value={props.requestedTransferDate} />
        <LabelValue label={c.extendedTransferDate} value={props.extendedTransferDate} />
        <LabelValue label={c.contentsToLeave} value={props.contentsToLeave} />
        <LabelValue label={c.notes} value={props.notes} />

        <View style={styles.signatureBlock}>
          <Text>{c.signature}</Text>
          <View style={styles.signatureRow}>
            <Image src={props.signature1} style={styles.signatureImage} />
            {props.signature2 && <Image src={props.signature2} style={styles.signatureImage} />}
          </View>
        </View>
      </Page>
    </Document>
  );
}
