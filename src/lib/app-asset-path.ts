import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolves a path under public/ for server-side filesystem reads (fonts,
 * logo — anything read via `fs`, not served over HTTP). NOT `process.cwd()`
 * — confirmed by direct production evidence (2026-09-28) that it's
 * unreliable here: `process.cwd()` evaluates to `/tmp/app` in Amplify's
 * Next.js SSR compute, and two real offer submissions failed with ENOENT
 * reading public/fonts/NotoSansHebrew-Regular.ttf from that path, while a
 * diagnostic probe immediately after found the exact same file present and
 * readable every time — consistent with the file only being reliably
 * available by the time `/tmp/app` extraction has fully completed after a
 * cold start, not always by the time the first request is handled.
 *
 * `/var/task` is AWS Lambda's own standard deployment root — populated by
 * Lambda's own packaging before the handler ever runs, no secondary
 * extraction step, no timing dependency. The same diagnostic confirmed
 * public/fonts/*.ttf present there too, every time. Falls back to
 * `process.cwd()` for local dev, where /var/task doesn't exist.
 *
 * Combined with `outputFileTracingIncludes` in next.config.ts (forces
 * these specific files into the trace, the same mechanism already proven
 * to fix pdfkit's own equivalent issue) as defense-in-depth, in case
 * Amplify's public/ copy into /var/task ever turns out to have its own
 * gaps this one diagnostic round didn't surface.
 */
export function appAssetPath(...segments: string[]): string {
  const root = existsSync("/var/task") ? "/var/task" : process.cwd();
  return path.join(root, "public", ...segments);
}
