"use client";

import { GradeBucket } from "@/types";
import { validateBuckets } from "@/lib/algorithms";
import { buildConstraints } from "@/lib/algorithms";

interface Props {
  buckets: GradeBucket[];
  onChange: (buckets: GradeBucket[]) => void;
  studentCount: number;
}

export function BucketRules({ buckets, onChange, studentCount }: Props) {
  const errors = validateBuckets(buckets);
  const sumMin = buckets.reduce((a, b) => a + b.minPct, 0);
  const sumMax = buckets.reduce((a, b) => a + b.maxPct, 0);
  const constraints = studentCount > 0 ? buildConstraints(buckets, studentCount) : null;

  function update(idx: number, field: "minPct" | "maxPct", raw: string) {
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    const clamped = Math.max(0, Math.min(100, val));
    const next = buckets.map((b, i) => (i === idx ? { ...b, [field]: clamped } : b));
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="py-1.5 text-left font-medium w-10">Grade</th>
              <th className="py-1.5 text-right font-medium pr-1">Min%</th>
              <th className="py-1.5 text-right font-medium pr-1">Max%</th>
              {constraints && (
                <th className="py-1.5 text-right font-medium text-xs">Counts</th>
              )}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b, i) => {
              const rowError = b.minPct > b.maxPct;
              const c = constraints?.[i];
              return (
                <tr
                  key={b.grade}
                  className={rowError ? "bg-destructive/10" : undefined}
                >
                  <td className="py-0.5 font-mono font-semibold text-sm w-10">
                    {b.grade}
                  </td>
                  <td className="py-0.5 pr-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={b.minPct}
                      onChange={(e) => update(i, "minPct", e.target.value)}
                      className={`w-16 text-right rounded border px-1.5 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring ${
                        rowError ? "border-destructive" : "border-input"
                      }`}
                    />
                  </td>
                  <td className="py-0.5 pr-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={b.maxPct}
                      onChange={(e) => update(i, "maxPct", e.target.value)}
                      className={`w-16 text-right rounded border px-1.5 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring ${
                        rowError ? "border-destructive" : "border-input"
                      }`}
                    />
                  </td>
                  {constraints && c && (
                    <td className="py-0.5 text-right text-xs text-muted-foreground font-mono">
                      {c.minCount}–{c.maxCount}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      <div className="border-t pt-2 text-xs space-y-1">
        <div className={`flex justify-between ${sumMin > 100 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
          <span>Sum of mins</span>
          <span>{sumMin.toFixed(1)}%{sumMin > 100 ? " ⚠" : ""}</span>
        </div>
        <div className={`flex justify-between ${sumMax < 100 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
          <span>Sum of maxes</span>
          <span>{sumMax.toFixed(1)}%{sumMax < 100 ? " ⚠" : ""}</span>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded p-2 text-xs text-destructive space-y-1">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
