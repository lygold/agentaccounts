import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Document, Page, Text, Font, renderToBuffer } from "@react-pdf/renderer";

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

  // Exact same operation type (open()) as what actually failed in
  // production — existsSync alone doesn't prove readFileSync also works.
  const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansHebrew-Regular.ttf");
  try {
    const stat = statSync(fontPath);
    report.font_stat_size = stat.size;
    const buf = readFileSync(fontPath);
    report.font_readFileSync_bytes = buf.length;
  } catch (e) {
    report.font_readFileSync_error = `${(e as Error).name}: ${(e as Error).message}`;
  }

  // The actual, real thing that failed: register this exact font the same
  // way offer-document.tsx does, then render a real PDF using it.
  try {
    Font.register({ family: "DiagNotoSansHebrew", fonts: [{ src: fontPath }] });
    const buf = await renderToBuffer(
      <Document>
        <Page size="A4" style={{ fontFamily: "DiagNotoSansHebrew" }}>
          <Text>diagnostic test render</Text>
        </Page>
      </Document>,
    );
    report.real_render_succeeded = true;
    report.real_render_bytes = buf.length;
  } catch (e) {
    report.real_render_error = `${(e as Error).name}: ${(e as Error).message}`;
  }

  return Response.json(report);
}
