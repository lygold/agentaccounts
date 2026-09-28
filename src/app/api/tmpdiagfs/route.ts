import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// TEMPORARY diagnostic route — not a fix, just ground truth about the
// production filesystem layout, to figure out why process.cwd()-based
// public/ asset reads (fonts, logo) fail with ENOENT in Amplify's SSR
// compute even though the same pattern for pdfkit's node_modules files
// now works after outputFileTracingIncludes. Delete after use.
export async function GET() {
  const report: Record<string, unknown> = {};

  report.cwd = process.cwd();
  report.dirname = typeof __dirname !== "undefined" ? __dirname : "undefined";

  function safeReaddir(p: string) {
    try {
      return readdirSync(p);
    } catch (e) {
      return `ERROR: ${(e as Error).message}`;
    }
  }
  function safeExists(p: string) {
    try {
      return existsSync(p);
    } catch (e) {
      return `ERROR: ${(e as Error).message}`;
    }
  }

  report.cwd_listing = safeReaddir(process.cwd());
  report.cwd_public_exists = safeExists(path.join(process.cwd(), "public"));
  report.cwd_public_listing = safeReaddir(path.join(process.cwd(), "public"));
  report.cwd_public_fonts_exists = safeExists(path.join(process.cwd(), "public", "fonts"));

  report.var_task_exists = safeExists("/var/task");
  report.var_task_listing = safeReaddir("/var/task");
  report.var_task_public_exists = safeExists("/var/task/public");
  report.var_task_public_fonts_listing = safeReaddir("/var/task/public/fonts");
  report.var_task_public_fonts_font_exists = safeExists(
    "/var/task/public/fonts/NotoSansHebrew-Regular.ttf",
  );

  report.tmp_app_exists = safeExists("/tmp/app");
  report.tmp_app_listing = safeReaddir("/tmp/app");

  // Where did the NOW-WORKING pdfkit standard font actually get resolved
  // from? This is our one confirmed-working reference point.
  try {
    report.pdfkit_helvetica_resolved_path = require.resolve(
      "pdfkit/js/standard-fonts/Helvetica.cjs",
    );
  } catch (e) {
    report.pdfkit_helvetica_resolve_error = (e as Error).message;
  }

  // __dirname of THIS route file, and what's around it, for comparison.
  if (typeof __dirname !== "undefined") {
    report.dirname_listing = safeReaddir(__dirname);
    report.dirname_parent_listing = safeReaddir(path.join(__dirname, ".."));
  }

  return Response.json(report);
}
