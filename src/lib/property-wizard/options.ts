/**
 * Option lists for the property wizard, taken VERBATIM from the Monday
 * "Properties Raw Data" board's dropdown/status columns (which are also the
 * original Superform questionnaire's options). The stored value IS the Monday
 * label, so what the agent picks is exactly what the Monday push writes - no
 * translation table to drift out of sync. Legacy duplicates / truncated labels
 * that exist on the board (e.g. "3 - במצב שמור (במצב טוב", "חלקי:בחלק מהדירה")
 * are left out of what agents can pick.
 *
 * Columns: dropdown__1 (property type), dropdown01__1 (publish notes),
 * dropdown0__1 (client source), dropdown596__1 (other source), dropdown1__1
 * (condition), dropdown8__1 (elevator), dropdown86__1 (balcony), dropdown11__1
 * (a/c), dropdown861__1 (parking), dropdown4__1 (extra features), ...
 */

export const YES = "כן";
export const NO = "לא";
export const YES_NO = [YES, NO] as const;

export const PROPERTY_TYPES = [
  "דירה",
  "דירת גן",
  "גג/ פנטהאוז",
  "דופלקס",
  "בית פרטי/קוטג",
  "דו משפחתי",
  "דו משפחתים",
  "מסחרי",
  "פרויקט",
] as const;

/** "הערות לפרסם" - how much of the address may be published. */
export const PUBLISH_NOTES = ["כתובת מלא", "רק שכונה", "שם הרחוב בלי מספר"] as const;

/** "האם הלקוח הגיע מהפניה" / "מקור הגעת הלקוח" (dropdown0__1). */
export const REFERRAL_SOURCES = [
  "פניה אישית",
  "לקוח עבר",
  "ליד משרדי",
  "מוניטין",
  "המלצת מוכר",
  "הפניה סוכן חוץ",
  "הפניה סוכן משרד",
  NO,
] as const;
/** Choosing NO above reveals a required follow-up: where the client DID come
 *  from (dropdown596__1 "מקור הגעת הלקוח אחר"). */
export const REFERRAL_NONE = NO;
export const REFERRAL_EXTERNAL_AGENT = "הפניה סוכן חוץ";
export const REFERRAL_OFFICE_AGENT = "הפניה סוכן משרד";
export const OTHER_SOURCES = [
  "היכרות",
  "מעקב אחרי זוכה במכרז",
  "FSBO",
  "פלייר",
  "פרסום",
  "Door to Door",
  "מרכז קשרים",
  'שיחת נדל"ן אקראית',
  "רשתות חברתיות",
  "פניה אישית",
  "ליד משרדי",
  "המלצת מוכר",
  "לקוח עבר",
] as const;

export const CONDITIONS = [
  "0 - חדש מקבלן (לא גרו בו בכלל)",
  "1 - חדש (נכס בן עד 5 שנים)",
  "2 - משופץ (שופץ ב5 השנים האחרונות)",
  "3 - במצב שמור (במצב טוב, לא שופץ)",
  "4 - דרוש שיפוץ (זקוק לעבודת שיפוץ)",
] as const;

export const ELEVATOR = [YES, NO, "מעלית שבת"] as const;
export const BALCONY = [
  NO,
  YES,
  "מרפסת",
  "מרפסת גג",
  "מרפסת גינה",
  "כן (מרפסת גינה)",
  "מרפסת מקורה",
  "מרפסת סוכה",
] as const;
export const AIR_CONDITIONING = [
  NO,
  YES,
  "מזגן מרכזי",
  "יחידה בכל חדר",
  "חלקי, בחלק מהדירה",
  "אין",
] as const;
export const PARKING = [NO, YES, "חניה פרטית", "חנייה של הבניין"] as const;

/** "מאפיינים נוספים" - multi-select. */
export const ADDITIONAL_FEATURES = [
  "קרובה לתחבורה ציבורית",
  "קרובה לבתי כנסת",
  "קרובה לגנים/ בתי ספר",
  "נוף",
  "עיצוב אדריכלי",
  "דירה נגישה",
  "גישה לנכים",
  "מרוהטת",
  "מתאים להשקעה",
  "פנויה",
  "מושכרת",
  "לכניסה מיידית",
  "חימום תת רצפתי",
  "מערכת יונקרס לחימום המים ודקוהיט לרדיאטורים",
  "יונקרס חדש",
  "דוד חשמל",
  "דוד שמש",
  "מכשרי חשמל למטבח",
  "בריכת שחיה",
  "מיזוג מרכזי",
  "סורגים",
  "חדר כושר",
  "סָאוּנָה",
] as const;

/** Yad2 "Track" status column (color_mkt5rnyx). The app's own premium/ultra
 *  choice maps onto these. */
export const YAD2_TRACK_LABEL = {
  premium: "פרמיום",
  ultra: "אולטרה",
} as const;

/** Contract type status column (color7__1); the app stores a slug. */
export const CONTRACT_TYPE_LABEL = {
  biladiut: "בלעדיות",
  haskama: "הסכמה",
} as const;

/** Internal 0-10 rating questions (dropdown5__1 / 54 / 59 / 08). The board's
 *  labels are the bare number, except the low end which carries a caption. */
export const RATING_MAX = 10;
export const RATING_LOW_CAPTION = {
  sellabilityRating: "0 -נכס טוב שימכר מהר",
  sellerMotivation: "0 - מוטיבציה נמוכה ביותר",
  priceToCmaMatch: "0 - גבוה מאוד",
  ownerPressureToSell: "0 - לא לחוצים בכלל",
} as const;
export const RATING_HIGH_CAPTION = {
  sellabilityRating: "9 - נכס שלא ימכר מהר",
  sellerMotivation: "9 - מוטיבציה גבוהה ביותר",
  priceToCmaMatch: "9 - בדיוק לפי ה- CMA",
  ownerPressureToSell: "9 - חייבים כבר למכור",
} as const;
export const LETTER_GRADES = ["A", "B", "C", "D"] as const;

/** True when a yes/no-style dropdown answer means "has it" (anything but לא/אין). */
export function hasFeature(answer: string | undefined): boolean {
  return !!answer && answer !== NO && answer !== "אין";
}
