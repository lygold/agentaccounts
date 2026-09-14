import "server-only";
import mammoth from "mammoth";

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ text: string; isImage: boolean }> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "pdf" || mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const result = await pdfParse(buffer);
    if (!result.text.trim()) {
      // PDF has no text layer — treat as image for Claude vision
      return { text: "", isImage: true };
    }
    return { text: result.text, isImage: false };
  }

  if (
    ext === "docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, isImage: false };
  }

  // Anything else (jpg, png, webp etc.) — pass to Claude vision
  return { text: "", isImage: true };
}