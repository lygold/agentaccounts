/** "yes" | "no" | undefined -> boolean | undefined (undefined = unanswered).
 *  Kept out of components/yes-no-radios.tsx: that file is a client module, and
 *  server actions can't call functions exported from one. */
export function parseYesNo(v: FormDataEntryValue | string | null | undefined): boolean | undefined {
  return v === "yes" ? true : v === "no" ? false : undefined;
}
