"use client";

import { useState } from "react";

/**
 * Number field that keeps its own draft text so the user can clear it or type
 * "8." mid-edit; only valid values inside [min, max] are committed upward.
 */
export function NormField({
  label,
  value,
  min,
  max,
  step = 0.5,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  // Resync the draft when the value changes from outside (e.g. Reset All).
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }
  const parsed = parseFloat(draft);
  const invalid = draft.trim() === "" || isNaN(parsed) || parsed < min || parsed > max;

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= min && v <= max) {
            setLastValue(v);
            onCommit(v);
          }
        }}
        onBlur={() => setDraft(String(value))}
        aria-invalid={invalid}
        className={`w-16 text-right rounded border px-1.5 py-0.5 text-sm text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-ring ${
          invalid ? "border-destructive" : "border-input"
        }`}
      />
    </label>
  );
}
