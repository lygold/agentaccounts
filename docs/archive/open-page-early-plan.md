# RE/MAX Jerusalem Agent Links Dashboard

## Context

Agents currently find important links (new-property intake form, presentation scheduling, Drive folder, review link, office schedule sheet, contact sheet, passwords doc, deal-summary/price-quote/referral forms) buried inside a WhatsApp work-group description. Finding the right link means leaving the flow, opening WhatsApp, reading the group description, and hunting for the right line among many.

Goal: replace that hunt with a single page agents can tap open from their phone home screen. Phase 1 (this build) is a clean, categorized link launcher in Hebrew/RTL. It's explicitly the first step toward a bigger internal tool — later phases may pull live data (e.g. daily lead counts from the intake form/sheet) and add role-based views — so the foundation should not be a dead-end static page.

Decisions made with the user:
- Build custom (not Notion/Linktree) for RTL polish and room to grow.
- Framework: Next.js, since the user already has AWS Amplify Gen2 experience and Amplify Gen2 hosts Next.js (including future API routes/SSR) natively — avoids a rewrite when live-data phase starts.
- No auth for phase 1 — same trust level as the WhatsApp group today (anyone in the group already sees the passwords doc link).
- "One click" access = installable PWA (add-to-home-screen), so tapping a phone icon opens straight to the dashboard.
- `D:\Dev\Dashboard` is currently empty — greenfield project, no migration concerns.

## Link data (extracted from the WhatsApp group description screenshot)

Group into categories for the page:

**נכסים ולידים (Properties & Leads)**
- הוספת נכס חדש: `https://www.superform.spot-nik.com/form/66f3eedf7560d752eaab3ac0`
- קביעת פגישת פרזנטציה: `https://calendly.com/ariyel/presentation`
- טופס הפניה: `https://go.remaxjerusalem.com/referral`

**מסמכים ומשרד (Docs & Office)**
- דרייב: `https://drive.google.com/drive/folders/1BUrygkPWdzo3_JNeoPAvyL883CdVX0Cv`
- רשימת עדויות במשרד: `https://docs.google.com/spreadsheets/d/1tx4b-UGjichNWEXXjIzw_rgmw5ZI7oRahF8nVlcql3k/edit?usp=sharing`
- דף קשר: `https://docs.google.com/document/d/1cfG9oIiF0A0QdyHaH--tLJMfi-N_xQPXaUlndZLsGVU/edit?usp=sharing`
- סיסמאות: `https://docs.google.com/document/d/1YPZI8Njtc43oN7rHdE0_Z6KPu65BJXv3910bYh8W-bg/edit?usp=sharing`

**טפסי עסקה (Deal Forms)**
- טופס סיכום פגישה: `https://go.remaxjerusalem.com/summaryofterms`
- טופס הצעת מחיר: `https://forms.gle/D1XK8vxst8R7dsN2A`

**המלצות (Recommendations)**
- Recommendations / Google Review: `https://g.page/Remaxjerusalem/review?rc`

(Verify these against the live WhatsApp group description at build time in case wording/links have drifted since the screenshot.)

## Implementation

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS, `dir="rtl"`, Hebrew web font (e.g. Assistant/Rubik via next/font), PWA manifest for home-screen install.

**Structure:**
- `app/layout.tsx` — root layout, `<html lang="he" dir="rtl">`, font setup, PWA `<link rel="manifest">` and theme-color meta tags.
- `app/page.tsx` — renders categorized sections of link cards from the data file.
- `lib/links.ts` — single source of truth: array of `{ category, label, url, icon? }`. Keeping link data in one plain file (not hardcoded in JSX) makes future edits (new link, renamed label) a one-line change, and is also the natural seam for phase 2 when some entries start pulling live values instead of being static.
- `components/CategorySection.tsx`, `components/LinkCard.tsx` — presentational components; large tap targets since this is phone-first.
- `public/manifest.json` + app icon assets — enables "Add to Home Screen" so opening the dashboard is one tap, matching the user's actual ask.
- `tailwind.config.ts` — mobile-first breakpoints; verify RTL spacing utilities render correctly (Tailwind logical properties or a small RTL plugin if needed).

**Growth path (not built now, just don't block it):**
- Live data later slots in as Next.js API routes (e.g. `app/api/leads-today/route.ts`) calling the Google Sheets API, rendered as a stat tile alongside the static links.
- Role-based views later would layer on NextAuth or Amplify Auth (Cognito) — deferred per user's "no auth for now" decision, but Next.js + Amplify Gen2 supports adding this without a rewrite.

**Hosting:** AWS Amplify Gen2 (user's existing environment). Deployment itself (creating the Amplify app/repo connection) is a separate step to confirm with the user once the app works locally — not performed automatically as part of this build.

## Verification

1. `npm run dev`, open in browser at mobile viewport width — confirm all links present, correctly categorized, Hebrew renders RTL with no mirrored-punctuation or alignment bugs.
2. Click through every link once to confirm the URL data was transcribed correctly from the screenshot.
3. Test "Add to Home Screen" on an actual phone (or Chrome DevTools application panel) — confirm manifest icon/name and that launching from the home screen opens directly to the dashboard.
4. Run `npm run build` to confirm a clean production build before considering Amplify deployment.
