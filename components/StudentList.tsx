"use client";

import { Student, GradeBucket } from "@/types";
import { GRADE_SCALE } from "@/lib/grades";

interface Props {
  students: Student[];
  buckets: GradeBucket[];
  onGradeChange: (studentIdx: number, grade: string) => void;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "A":  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "A-": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "B+": "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  "B":  "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  "B-": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  "C+": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "C":  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "C-": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "D+": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "D":  "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "D-": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "F":  "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200",
};

export function StudentList({ students, onGradeChange }: Omit<Props, "buckets"> & { buckets?: GradeBucket[] }) {
  if (students.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No students loaded yet.
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[560px]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="text-xs text-muted-foreground border-b">
            <th className="py-1.5 text-left font-medium w-8">#</th>
            <th className="py-1.5 text-left font-medium">ID</th>
            <th className="py-1.5 text-right font-medium pr-2">Score</th>
            <th className="py-1.5 text-right font-medium">Grade</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, idx) => (
            <tr
              key={s.id + idx}
              className="border-b border-muted/20 hover:bg-muted/30 transition-colors"
            >
              <td className="py-0.5 text-xs text-muted-foreground">{s.rank}</td>
              <td className="py-0.5 font-mono text-xs max-w-[120px] truncate" title={s.id}>
                {s.id}
              </td>
              <td className="py-0.5 text-right pr-2 tabular-nums">{s.rawScore.toFixed(1)}</td>
              <td className="py-0.5 text-right">
                {s.assignedGrade === null ? (
                  <span className="text-muted-foreground text-xs">—</span>
                ) : (
                  <select
                    value={s.assignedGrade}
                    onChange={(e) => onGradeChange(idx, e.target.value)}
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${
                      GRADE_COLORS[s.assignedGrade] ?? "bg-muted text-foreground"
                    }`}
                  >
                    {GRADE_SCALE.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
