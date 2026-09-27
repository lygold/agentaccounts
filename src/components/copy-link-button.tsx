"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ link }: { link: string }) {
  const t = useTranslations("Common");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (non-secure context, permissions) —
      // the link is still shown as selectable text, so this is a nicety.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? t("copied") : t("copyLink")}
    </Button>
  );
}
