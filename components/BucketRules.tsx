"use client";

import React from "react";
import { GradeBucket, MergeGroup, MergeField } from "@/types";
import { validateBuckets, buildConstraints } from "@/lib/algorithms";

interface Props {
  buckets: GradeBucket[];
  onChange: (buckets: GradeBucket[]) => void;
  studentCount: number;
  mergeGroups: MergeGroup[];
  onMerge: (gradeAbove: string, gradeBelow: string, field: MergeField) => void;
  onSplit: (gradeAbove: string, gradeBelow: string, field: MergeField) => void;
  onGroupTotalChange: (groupId: string, newTotalPct: number) => void;
}

// ── Separator cell: merge/split control between two adjacent grade rows ──────

interface SeparatorCellProps {
  group: MergeGroup | null;
  field: MergeField;
  gradeAbove: string;
  gradeBelow: string;
  isFirstSepInGroup: boolean; // show totalPct input here
  onMerge: (a: string, b: string, f: MergeField) => void;
  onSplit: (a: string, b: string, f: MergeField) => void;
  onGroupTotalChange: (id: string, v: number) => void;
}

function SeparatorCell({
  group,
  field,
  gradeAbove,
  gradeBelow,
  isFirstSepInGroup,
  onMerge,
  onSplit,
  onGroupTotalChange,
}: SeparatorCellProps) {
  if (!group) {
    return (
      <div className="flex justify-center py-0.5 opacity-0 hover:opacity-100 transition-opacity duration-100">
        <button
          onClick={() => onMerge(gradeAbove, gradeBelow, field)}
          className="text-[9px] leading-none text-blue-400 hover:text-blue-600 border border-blue-200 hover:border-blue-400 rounded px-1 py-0.5 bg-blue-50 hover:bg-blue-100 transition-colors"
          title={`Merge ${field === "max" ? "Max" : "Min"}% for ${gradeAbove} and ${gradeBelow}`}
        >
          link
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-0.5 py-0.5">
      {isFirstSepInGroup ? (
        <>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={group.totalPct}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) onGroupTotalChange(group.id, Math.max(0, Math.min(100, val)));
            }}
            className="w-14 text-right rounded border border-blue-300 px-1 py-0 text-xs bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
            title={`Shared ${field === "max" ? "Max" : "Min"}% pool for ${group.grades.join(", ")}`}
          />
          <button
            onClick={() => onSplit(gradeAbove, gradeBelow, field)}
            className="text-[10px] text-blue-400 hover:text-red-500 px-0.5 leading-none"
            title={`Split ${field === "max" ? "Max" : "Min"}% group here`}
          >
            ✂
          </button>
        </>
      ) : (
        <button
          onClick={() => onSplit(gradeAbove, gradeBelow, field)}
          className="text-[10px] text-blue-400 hover:text-red-500 px-0.5 leading-none"
          title={`Split ${field === "max" ? "Max" : "Min"}% group here`}
        >
          ✂
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BucketRules({
  buckets,
  onChange,
  studentCount,
  mergeGroups,
  onMerge,
  onSplit,
  onGroupTotalChange,
}: Props) {
  const errors = validateBuckets(buckets, mergeGroups);
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

  // For a given pair (gradeAbove, gradeBelow) and field, find if they share a group,
  // and whether this separator is the "first" one in that group (where totalPct input lives).
  function getSepInfo(
    gradeAbove: string,
    gradeBelow: string,
    field: MergeField,
  ): { group: MergeGroup | null; isFirstSep: boolean } {
    const group =
      mergeGroups.find(
        (g) =>
          g.field === field &&
          g.grades.includes(gradeAbove) &&
          g.grades.includes(gradeBelow),
      ) ?? null;
    if (!group) return { group: null, isFirstSep: false };
    // "First separator" = the one between grades[0] and grades[1]
    const isFirstSep =
      group.grades.indexOf(gradeAbove) === 0 &&
      group.grades.indexOf(gradeBelow) === 1;
    return { group, isFirstSep };
  }

  // Is this grade part of a merged group for the given field?
  function isInGroup(grade: string, field: MergeField): boolean {
    return mergeGroups.some((g) => g.field === field && g.grades.includes(grade));
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
              const inMinGroup = isInGroup(b.grade, "min");
              const inMaxGroup = isInGroup(b.grade, "max");

              // Separator info for the gap below this row (between row i and row i+1)
              const hasNext = i < buckets.length - 1;
              const nextGrade = hasNext ? buckets[i + 1].grade : null;

              const minSep = hasNext
                ? getSepInfo(b.grade, nextGrade!, "min")
                : null;
              const maxSep = hasNext
                ? getSepInfo(b.grade, nextGrade!, "max")
                : null;

              return (
                <React.Fragment key={b.grade}>
                  {/* ── Grade row ── */}
                  <tr className={rowError ? "bg-destructive/10" : undefined}>
                    <td className="py-0.5 font-mono font-semibold text-sm w-10">
                      <div className="flex items-center gap-1">
                        {/* Thin coloured left border for merged grades */}
                        {(inMinGroup || inMaxGroup) && (
                          <div className="w-0.5 h-4 rounded-full bg-blue-400 shrink-0" />
                        )}
                        {b.grade}
                      </div>
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

                  {/* ── Separator row (between this row and the next) ── */}
                  {hasNext && (
                    <tr className="h-0 group/sep">
                      <td className="p-0 w-10">
                        {/* Connector dot if either field is merged across this boundary */}
                        {(minSep?.group || maxSep?.group) && (
                          <div className="flex justify-center">
                            <div className="w-0.5 h-2 bg-blue-300" />
                          </div>
                        )}
                      </td>
                      <td className="p-0">
                        <SeparatorCell
                          group={minSep!.group}
                          field="min"
                          gradeAbove={b.grade}
                          gradeBelow={nextGrade!}
                          isFirstSepInGroup={minSep!.isFirstSep}
                          onMerge={onMerge}
                          onSplit={onSplit}
                          onGroupTotalChange={onGroupTotalChange}
                        />
                      </td>
                      <td className="p-0">
                        <SeparatorCell
                          group={maxSep!.group}
                          field="max"
                          gradeAbove={b.grade}
                          gradeBelow={nextGrade!}
                          isFirstSepInGroup={maxSep!.isFirstSep}
                          onMerge={onMerge}
                          onSplit={onSplit}
                          onGroupTotalChange={onGroupTotalChange}
                        />
                      </td>
                      {constraints && <td className="p-0" />}
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      <div className="border-t pt-2 text-xs space-y-1">
        <div
          className={`flex justify-between ${
            sumMin > 100 ? "text-destructive font-semibold" : "text-muted-foreground"
          }`}
        >
          <span>Sum of mins</span>
          <span>
            {sumMin.toFixed(1)}%{sumMin > 100 ? " ⚠" : ""}
          </span>
        </div>
        <div
          className={`flex justify-between ${
            sumMax < 100 ? "text-destructive font-semibold" : "text-muted-foreground"
          }`}
        >
          <span>Sum of maxes</span>
          <span>
            {sumMax.toFixed(1)}%{sumMax < 100 ? " ⚠" : ""}
          </span>
        </div>
        {mergeGroups.filter((g) => g.field === "max").map((g) => (
          <div key={g.id} className="flex justify-between text-blue-600">
            <span>[{g.grades.join("+")}] pool</span>
            <span>{g.totalPct.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded p-2 text-xs text-destructive space-y-1">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          const rows = [["Grade", "Min%", "Max%"], ...buckets.map((b) => [b.grade, String(b.minPct), String(b.maxPct)])];
          downloadCsv("grading-rules.csv", rows);
        }}
        className="w-full text-xs text-muted-foreground border border-input rounded px-2 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        Download rules as CSV
      </button>
    </div>
  );
}
