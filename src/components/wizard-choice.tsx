import { cn } from "@/lib/utils";

interface ChoiceOption {
  value: string;
  /** Big Hebrew label, e.g. "מכירה" */
  label: string;
  /** Smaller helper line under the label, optional. */
  hint?: string;
}

/**
 * Big tap-friendly choice cards. Each card is a submit button with its value
 * sent in the named field — server action receives `formData.get(name)`.
 * Pure HTML form, no JS needed for the choice itself.
 */
export function ChoiceCards({
  name,
  options,
  selected,
}: {
  name: string;
  options: ChoiceOption[];
  /** Highlight the currently-saved choice (revisits show the prior answer). */
  selected?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="submit"
          name={name}
          value={opt.value}
          className={cn(
            "flex flex-col items-stretch gap-1 rounded-lg border-2 p-5 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selected === opt.value
              ? "border-primary bg-primary/5"
              : "border-input",
          )}
        >
          <span className="text-lg font-semibold">{opt.label}</span>
          {opt.hint && (
            <span className="text-sm text-muted-foreground">{opt.hint}</span>
          )}
        </button>
      ))}
    </div>
  );
}
