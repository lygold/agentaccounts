"use client";

/** A required כן / לא question as native radio buttons (so the browser
 *  enforces `required`, and the answer is a real "yes"/"no" - never a silent
 *  unchecked default). Submits "yes" | "no" under `name`. */
export function YesNoRadios({
  name,
  label,
  hint,
  value,
  yesLabel,
  noLabel,
  required = true,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  value?: boolean;
  yesLabel: string;
  noLabel: string;
  required?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">
        {label}
        {required && <span className="text-primary"> *</span>}
      </legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value="yes"
            required={required}
            defaultChecked={value === true}
            onChange={() => onChange?.(true)}
            className="h-4 w-4"
          />
          {yesLabel}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value="no"
            required={required}
            defaultChecked={value === false}
            onChange={() => onChange?.(false)}
            className="h-4 w-4"
          />
          {noLabel}
        </label>
      </div>
    </fieldset>
  );
}
