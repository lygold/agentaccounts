"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Freehand signature capture on a plain <canvas> — no library. This is
 * simple enough (draw a line between consecutive pointer positions, export
 * via toDataURL) that a dependency isn't worth it; see the offers feature
 * plan for the reasoning.
 *
 * Emits a data URL ("data:image/png;base64,...") via onChange, or null once
 * cleared/empty. The parent puts that data URL in a hidden form field (or
 * converts it to a Blob before upload) — this component has no knowledge of
 * where the signature goes.
 */
export function SignaturePad({
  onChange,
  label,
  required,
}: {
  onChange: (dataUrl: string | null) => void;
  label?: string;
  required?: boolean;
}) {
  const t = useTranslations("SignaturePad");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasStroke, setHasStroke] = useState(false);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Canvas backing store is 2x the CSS size for a crisp line (see the
    // width/height vs. style width/height split below) — scale pointer
    // coordinates to match.
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = point(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const from = lastPoint.current;
    const to = point(e);
    if (!ctx || !from) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    lastPoint.current = to;
    if (!hasStroke) setHasStroke(true);
  }

  function end() {
    drawing.current = false;
    lastPoint.current = null;
    const canvas = canvasRef.current;
    onChange(canvas && hasStroke ? canvas.toDataURL("image/png") : null);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="text-sm font-medium">
          {label}
          {required && <span className="text-primary"> *</span>}
        </p>
      )}
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="touch-none rounded-md border bg-white"
        style={{ width: "100%", height: "160px" }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <Button type="button" variant="outline" size="sm" onClick={clear} className="self-start">
        {t("clear")}
      </Button>
    </div>
  );
}
