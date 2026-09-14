"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session-cookie";
import { patchDraft } from "@/lib/wizard/draft";
import { extractText } from "@/lib/wizard/extract/text";
import { extractDraftFromText, extractDraftFromImage } from "@/lib/wizard/claude-extract";

/** Ported from sikkumPigisha's form/upload/actions.ts — unchanged except
 *  patchDraft's key (session.agentId, not a draftId) and the post-extraction
 *  redirect target. */
export async function uploadDocument(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: false; message: string } | undefined> {
  const session = await requireSession();
  const t = await getTranslations("UploadStep");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: t("noFileSelected") };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, message: t("fileTooLarge") };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted;
  try {
    const { text, isImage } = await extractText(buffer, file.type, file.name);
    if (isImage) {
      extracted = await extractDraftFromImage(buffer, file.type);
    } else {
      extracted = await extractDraftFromText(text);
    }
  } catch (err) {
    console.error("Document extraction failed", err);
    return { ok: false, message: t("extractFailed") };
  }

  await patchDraft(session.agentId, { ...extracted, furthestStep: "review" });

  redirect("/deals/new/review");
}
