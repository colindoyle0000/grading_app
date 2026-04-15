"use client";

import { Student, GradeBucket, DistributionPreset } from "@/types";
import { GRADE_SCALE } from "@/lib/grades";
import {
  buildConstraints,
  computeSlotUsage,
  computeMean,
  computeMedian,
  computeStdDev,
  gpaToLetterGrade,
  checkViolations,
} from "@/lib/algorithms";
import { Button } from "@/components/ui/button";

interface Props {
  students: Student[];
  buckets: GradeBucket[];
  onPreset: (preset: DistributionPreset) => void;
  activePreset: DistributionPreset | null;
}

const PRESETS: { key: DistributionPreset; label: string; description: string }[] = [
  { key: "generous",  label: "Generous",  description: "Maximize high grades" },
  { key: "stingy",    label: "Stingy",    description: "Minimize high grades" },
  { key: "condensed", label: "Condensed", description: "Cluster in the middle" },
  { key: "spread",    label: "Spread",    description: "Maximize grade diversity" },
];

const GRADE_BAR_COLORS: Record<string, string> = {
  "A+": "bg-emerald-500",
  "A":  "bg-emerald-500",
  "A-": "bg-green-500",
  "B+": "bg-teal-500",
  "B":  "bg-teal-500",
  "B-": "bg-cyan-500",
  "C+": "bg-yellow-500",
  "C":  "bg-yellow-500",
  "C-": "bg-amber-500",
  "D+": "bg-orange-500",
  "D":  "bg-orange-500",
  "D-": "bg-red-400",
  "F":  "bg-red-600",
};

export function DistributionPanel({ students, buckets, onPreset, activePreset }: Props) {
  const n = students.length;
  const hasStudents = n > 0;
  const hasGrades = students.some((s) => s.assignedGrade !== null);

  const constraints = hasStudents ? buildConstraints(buckets, n) : [];
  const usage = hasStudents ? computeSlotUsage(students) : {};
  const mean = hasGrades ? computeMean(students) : null;
  const median = hasGrades ? computeMedian(students) : null;
  const stdDev = hasGrades ? computeStdDev(students) : null;
  const violations = hasGrades ? checkViolations(students, buckets) : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Violations */}
      {violations.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded p-2 text-xs text-destructive space-y-0.5">
          <p className="font-semibold mb-0.5">Constraint violations:</p>
          {violations.map((v) => (
            <div key={v}>• {v}</div>
          ))}
        </div>
      )}

      {/* Slot table */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
          Grade Slots {hasStudents && `(N = ${n})`}
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="py-1 text-left font-medium w-10">Grade</th>
              <th className="py-1 text-right font-medium">Assigned</th>
              <th className="py-1 text-right font-medium">Slots</th>
              <th className="py-1 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {GRADE_SCALE.map((grade) => {
              const c = constraints.find((x) => x.grade === grade);
              const count = usage[grade] ?? 0;
              const pct = n > 0 ? (count / n) * 100 : 0;
              const isViolation = c && (count > c.maxCount || count < c.minCount);

              return (
                <tr key={grade} className={isViolation ? "bg-destructive/10" : undefined}>
                  <td className="py-0.5 font-mono font-semibold text-sm">{grade}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1.5">
                      {count > 0 && (
                        <div
                          className={`h-2 rounded-full opacity-70 ${GRADE_BAR_COLORS[grade] ?? "bg-muted"}`}
                          style={{ width: `${Math.max(4, (count / Math.max(n, 1)) * 60)}px` }}
                        />
                      )}
                      <span className={isViolation ? "text-destructive font-semibold" : ""}>
                        {count}
                      </span>
                    </div>
                  </td>
                  <td className="py-0.5 text-right text-xs text-muted-foreground font-mono">
                    {c ? `${c.minCount}–${c.maxCount}` : "—"}
                  </td>
                  <td className="py-0.5 text-right text-xs text-muted-foreground tabular-nums">
                    {n > 0 ? `${pct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div className="border-t pt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Mean</p>
          <p className="text-xl font-bold">
            {mean !== null ? gpaToLetterGrade(mean) : "—"}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {mean !== null ? mean.toFixed(2) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Median</p>
          <p className="text-xl font-bold">
            {median !== null ? gpaToLetterGrade(median) : "—"}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {median !== null ? median.toFixed(2) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Std Dev</p>
          <p className="text-xl font-bold tabular-nums">
            {stdDev !== null ? stdDev.toFixed(2) : "—"}
          </p>
        </div>
      </div>

      {/* Preset buttons */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Distribution Presets
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={activePreset === p.key ? "default" : "outline"}
              size="sm"
              onClick={() => onPreset(p.key)}
              disabled={!hasStudents}
              className="flex flex-col h-auto py-1.5 text-xs"
              title={p.description}
            >
              <span className="font-semibold">{p.label}</span>
              <span
                className={`text-[10px] ${
                  activePreset === p.key ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {p.description}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
