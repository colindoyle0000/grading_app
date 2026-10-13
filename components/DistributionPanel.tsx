"use client";

import { NormField } from "@/components/NormField";
import { Student, GradeBucket, DistributionPreset, MergeGroup, NormParams, MeanMandate } from "@/types";
import { GRADE_SCALE, GPA_MAP } from "@/lib/grades";
import {
  buildConstraints,
  computeSlotUsage,
  computeMean,
  computeMedian,
  computeMeanScore,
  computeMedianScore,
  computeMeanRaw,
  computeMedianRaw,
  computeStdDev,
  gpaToLetterGrade,
  checkViolations,
} from "@/lib/algorithms";
import { Button } from "@/components/ui/button";

interface Props {
  students: Student[];
  buckets: GradeBucket[];
  mergeGroups: MergeGroup[];
  meanMandate: MeanMandate;
  onPreset: (preset: DistributionPreset) => void;
  activePreset: DistributionPreset | null;
  normParams: NormParams;
  onNormParamsChange: (params: NormParams) => void;
}

const PRESETS: { key: Exclude<DistributionPreset, "easynorm">; label: string; description: string }[] = [
  { key: "generous", label: "Generous", description: "Preview most generous distribution of grades under current rules" },
  { key: "stingy",   label: "Stingy",   description: "Preview stingiest distribution of grades under current rules" },
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

export function DistributionPanel({
  students,
  buckets,
  mergeGroups,
  meanMandate,
  onPreset,
  activePreset,
  normParams,
  onNormParamsChange,
}: Props) {
  const easynormActive = activePreset === "easynorm";
  const n = students.length;
  const hasStudents = n > 0;
  const hasGrades = students.some((s) => s.assignedGrade !== null);

  const constraints = hasStudents ? buildConstraints(buckets, n) : [];
  const usage = hasStudents ? computeSlotUsage(students) : {};
  const mean = hasGrades ? computeMean(students) : null;
  const median = hasGrades ? computeMedian(students) : null;
  const stdDev = hasGrades ? computeStdDev(students) : null;
  const violations = hasGrades ? checkViolations(students, buckets, mergeGroups, meanMandate) : [];

  const meanScore = hasGrades ? computeMeanScore(students) : null;
  const medianScore = hasGrades ? computeMedianScore(students) : null;
  const meanRaw = hasGrades ? computeMeanRaw(students) : null;
  const medianRaw = hasGrades ? computeMedianRaw(students) : null;

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
            GPA {mean !== null ? mean.toFixed(2) : "—"}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Score {meanScore !== null ? meanScore.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Raw {meanRaw !== null ? meanRaw.toFixed(1) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Median</p>
          <p className="text-xl font-bold">
            {median !== null ? gpaToLetterGrade(median) : "—"}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            GPA {median !== null ? median.toFixed(2) : "—"}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Score {medianScore !== null ? medianScore.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Raw {medianRaw !== null ? medianRaw.toFixed(1) : "—"}
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
          Distribution Preview
        </p>
        <div
          className={`mb-1.5 rounded-lg border p-1.5 ${
            easynormActive ? "border-primary bg-primary/5" : "border-input"
          }`}
        >
          <Button
            variant={easynormActive ? "default" : "outline"}
            size="sm"
            onClick={() => onPreset("easynorm")}
            disabled={!hasStudents}
            className="w-full flex flex-col h-auto py-1.5 text-xs"
            title="Curve raw scores to a target mean and standard deviation"
          >
            <span className="font-semibold">Easynorm</span>
            <span
              className={`text-[10px] ${
                easynormActive ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
            >
              Normalize to a target mean &amp; SD
            </span>
          </Button>
          <div className="flex items-center justify-between gap-2 px-1 pt-1.5">
            <NormField
              label="Mean"
              value={normParams.mean}
              min={0}
              max={100}
              onCommit={(mean) => onNormParamsChange({ ...normParams, mean })}
            />
            <NormField
              label="SD"
              value={normParams.sd}
              min={0.5}
              max={50}
              onCommit={(sd) => onNormParamsChange({ ...normParams, sd })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={activePreset === p.key ? "default" : "outline"}
              size="sm"
              onClick={() => onPreset(p.key)}
              disabled={!hasStudents}
              className="w-full flex flex-col h-auto py-1.5 text-xs whitespace-normal text-center"
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
        <button
          onClick={() => {
            const rows = [
              ["ID", "Raw Score", "Score", "Letter Grade", "GPA"],
              ...students.map((s) => [
                s.id,
                String(s.rawScore),
                s.curvedScore != null ? s.curvedScore.toFixed(1) : "",
                s.assignedGrade ?? "",
                s.assignedGrade ? GPA_MAP[s.assignedGrade].toFixed(3) : "",
              ]),
            ];
            const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "grades.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={!hasGrades}
          className="mt-2 w-full text-xs text-muted-foreground border border-input rounded px-2 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Download grades as CSV
        </button>
      </div>
    </div>
  );
}
