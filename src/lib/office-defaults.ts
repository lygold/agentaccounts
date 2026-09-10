/**
 * Office standard expense unit prices, ex-VAT — from RE/MAX Vision's Morning
 * item catalog (items-1789046378398.csv, docs/mem/gi-item-catalog.md).
 * Becomes `office.settings.standardExpenses` in Phase 5c; a constant for now.
 */
export const STANDARD_EXPENSES = {
  officeFee: 300, // דמי משרד
  madlan: 254, // מדלן — מנוי חודשי
  madlanPremium: 440, // מדלן פרימיום
  yad2: 50, // יד2 — מודעה רגילה
  yad2Premium: 100,
  yad2Ultra: 150,
  torahTidbits: 100, // פרסום תורה טידביטס
  kolHair: 70, // כל העיר
  virtualTour: 350, // סיור וירטואלי
} as const;
