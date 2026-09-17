/**
 * The exact referral-fee consent text shown on /r/[id] before a receiving
 * agent's details are released — deliberately NOT routed through next-intl
 * like the rest of that page's copy. This is the actual disclosure being
 * agreed to; a future UI wording tweak in messages/*.json shouldn't be able
 * to silently drift what gets stored as "what they agreed to" on
 * ReferralRecord.consentTextShown. One canonical string, used by both the
 * page (what's rendered) and the accept action (what's recorded) — if this
 * ever needs to change, bump CONSENT_VERSION alongside it so old accepted
 * referrals stay attributable to the version they actually saw.
 */
export const REFERRAL_CONSENT_VERSION = "2026-09-v1";

export const REFERRAL_CONSENT_TEXT_HE =
  "אני מאשר/ת בלחיצה על שלח: (1) את/ה מסכים/ה לטפל בהפניה זו באופן מקצועי ובתום לב; " +
  "(2) את/ה מסכים/ה לדמי הפניה בשיעור 25% מהעמלה";
