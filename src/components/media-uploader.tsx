"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  finalizeMediaUpload,
  requestMediaUpload,
} from "@/app/properties/new/(wizard)/media/upload-actions";
import type { PropertyMediaCategory } from "@/lib/types";

export interface UploadedItem {
  name: string;
  thumbUrl: string | null;
}

/** Plain templates (server components can't pass functions to client ones):
 *  `{done}` `{total}` `{name}` `{reason}` `{count}` are filled in here. */
interface Strings {
  uploading: string;
  failed: string;
  alreadyUploaded: string;
  waitForUploads: string;
}

/** Shared by every <MediaUploader> on the page. The wizard draft is a single
 *  read-modify-write blob, so two fields recording a file at the same moment
 *  could overwrite each other's update and silently drop a photo. */
let uploadQueue: Promise<void> = Promise.resolve();

function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

/** Uploads straight from the browser to storage (presigned PUT), one file at
 *  a time, then records each on the wizard draft. The enclosing <form> is
 *  blocked from submitting while any uploader is busy. */
export function MediaUploader({
  category,
  id,
  label,
  accept,
  initial,
  strings,
  required,
}: {
  category: PropertyMediaCategory;
  id: string;
  label: string;
  accept: string;
  initial: UploadedItem[];
  strings: Strings;
  /** Show the mandatory marker; the wizard enforces it when Continue is pressed. */
  required?: boolean;
}) {
  const [items, setItems] = useState<UploadedItem[]>(initial);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  // Block form submission while uploading (capture phase, before React's
  // delegated submit handling sees it).
  useEffect(() => {
    const form = inputRef.current?.closest("form");
    if (!form) return;
    const block = (e: Event) => {
      if (document.querySelector("[data-media-busy='true']")) {
        e.preventDefault();
        e.stopPropagation();
        window.alert(strings.waitForUploads);
      }
    };
    form.addEventListener("submit", block, true);
    return () => form.removeEventListener("submit", block, true);
  }, [strings.waitForUploads]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || busyRef.current) return;

    busyRef.current = true;
    setErrors([]);
    setProgress({ done: 0, total: files.length });
    const failures: string[] = [];

    // Run behind the shared queue: only one file is ever being recorded on the
    // draft at a time, across every field on the page.
    const job = uploadQueue.then(async () => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const type = file.type || "application/octet-stream";
          const req = await requestMediaUpload({ name: file.name, type, size: file.size });
          if (!req.ok) throw new Error(req.error);

          const put = await fetch(req.url, { method: "PUT", headers: req.headers, body: file });
          if (!put.ok) throw new Error(`storage ${put.status}`);

          const done = await finalizeMediaUpload(category, req.key, { name: file.name, type });
          if (!done.ok) throw new Error(done.error);
          setItems((prev) => [...prev, { name: done.name, thumbUrl: done.thumbUrl }]);
        } catch (err) {
          console.error("[media-uploader]", file.name, err);
          failures.push(fmt(strings.failed, { name: file.name, reason: err instanceof Error ? err.message : "error" }));
        }
        setProgress({ done: i + 1, total: files.length });
      }
    });
    uploadQueue = job.catch(() => {});
    await job;

    setErrors(failures);
    setProgress(null);
    busyRef.current = false;
  }

  return (
    <div className="flex flex-col gap-1.5" data-media-busy={progress ? "true" : "false"}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept={accept}
        onChange={onChange}
        disabled={!!progress}
        className="text-sm file:me-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
      />
      {progress && (
        <p className="text-xs text-muted-foreground" role="status">
          {fmt(strings.uploading, progress)}
        </p>
      )}
      {errors.map((m) => (
        <p key={m} className="text-xs text-destructive" role="alert">
          {m}
        </p>
      ))}
      {items.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{fmt(strings.alreadyUploaded, { count: items.length })}</p>
          <ul className="flex flex-wrap gap-2">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="w-20 text-center text-[10px] text-muted-foreground">
                {it.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served from the CDN; next/image would proxy bytes through Amplify
                  <img src={it.thumbUrl} alt={it.name} className="h-16 w-20 rounded-md object-cover" />
                ) : (
                  <div className="flex h-16 w-20 items-center justify-center rounded-md bg-muted">{it.name.split(".").pop()?.toUpperCase().slice(0, 4)}</div>
                )}
                <span className="line-clamp-1">{it.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
