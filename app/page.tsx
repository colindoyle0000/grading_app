"use client";

import { useState, useCallback } from "react";
import { Student, GradeBucket, DistributionPreset, MergeGroup, MergeField, NormParams } from "@/types";
import { DEFAULT_BUCKETS, DEFAULT_MERGE_GROUPS, DEFAULT_NORM_PARAMS, GRADE_SCALE } from "@/lib/grades";
import {
  distributeGenerous,
  distributeStingy,
  distributeCondensed,
  distributeSpread,
  distributeEasynorm,
  validateBuckets,
} from "@/lib/algorithms";
import { rankStudents } from "@/lib/excelParser";
import { BucketRules } from "@/components/BucketRules";
import { StudentPanel } from "@/components/StudentPanel";
import { DistributionPanel } from "@/components/DistributionPanel";
import { Button } from "@/components/ui/button";

function makeDefaultStudents(): Student[] {
  const raw = Array.from({ length: 100 }, (_, i) => ({
    id: `ID${i + 1}`,
    rawScore: 100 - i * 0.5,
    rank: 0,
    assignedGrade: null,
  }));
  return rankStudents(raw);
}

const BUCKET_DISTRIBUTORS: Record<Exclude<DistributionPreset, "easynorm">, typeof distributeGenerous> = {
  generous: distributeGenerous,
  stingy: distributeStingy,
  condensed: distributeCondensed,
  spread: distributeSpread,
};

// Easynorm curves raw scores and ignores bucket rules; the others fill buckets.
function runPreset(
  preset: DistributionPreset,
  students: Student[],
  buckets: GradeBucket[],
  mergeGroups: MergeGroup[],
  normParams: NormParams,
): Student[] {
  if (preset === "easynorm") return distributeEasynorm(students, normParams);
  return BUCKET_DISTRIBUTORS[preset](students, buckets, mergeGroups);
}

export default function Home() {
  const [buckets, setBuckets] = useState<GradeBucket[]>(DEFAULT_BUCKETS);
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>(DEFAULT_MERGE_GROUPS);
  const [normParams, setNormParams] = useState<NormParams>(DEFAULT_NORM_PARAMS);
  const [students, setStudents] = useState<Student[]>(() =>
    distributeEasynorm(makeDefaultStudents(), DEFAULT_NORM_PARAMS),
  );
  const [activePreset, setActivePreset] = useState<DistributionPreset | null>("easynorm");

  const isFeasible = validateBuckets(buckets, mergeGroups).length === 0;

  // Called when new students are loaded (file upload / manual entry).
  // Auto-applies the Easynorm preset so the chart is immediately populated.
  const handleLoadStudents = useCallback(
    (newStudents: Student[]) => {
      setStudents(distributeEasynorm(newStudents, normParams));
      setActivePreset("easynorm");
    },
    [normParams],
  );

  // Called when grades change via drag in the bar chart — no preset reset.
  const handleStudentsChange = useCallback((newStudents: Student[]) => {
    setStudents(newStudents);
    setActivePreset(null);
  }, []);

  const handleBucketsChange = useCallback(
    (newBuckets: GradeBucket[]) => {
      setBuckets(newBuckets);
      if (
        activePreset &&
        activePreset !== "easynorm" &&
        students.length > 0 &&
        validateBuckets(newBuckets, mergeGroups).length === 0
      ) {
        setStudents(runPreset(activePreset, students, newBuckets, mergeGroups, normParams));
      }
    },
    [activePreset, students, mergeGroups, normParams],
  );

  const handlePreset = useCallback(
    (preset: DistributionPreset) => {
      if (students.length === 0) return;
      if (preset !== "easynorm" && !isFeasible) return;
      setStudents(runPreset(preset, students, buckets, mergeGroups, normParams));
      setActivePreset(preset);
    },
    [students, buckets, isFeasible, mergeGroups, normParams],
  );

  // Editing the target mean/SD re-curves immediately and selects Easynorm.
  const handleNormParamsChange = useCallback(
    (params: NormParams) => {
      setNormParams(params);
      if (students.length === 0) return;
      setStudents(distributeEasynorm(students, params));
      setActivePreset("easynorm");
    },
    [students],
  );

  // Grade change with rank-order cascade:
  const handleGradeChange = useCallback((studentIdx: number, grade: string) => {
    setStudents((prev) => {
      const gradeScaleArr: string[] = Array.from(GRADE_SCALE);
      const changedStudent = prev[studentIdx];
      const newGradeIdx = gradeScaleArr.indexOf(grade);
      return prev.map((s, i) => {
        if (i === studentIdx) return { ...s, assignedGrade: grade };
        if (s.assignedGrade === null) return s;
        const curGradeIdx = gradeScaleArr.indexOf(s.assignedGrade);
        if (s.rank < changedStudent.rank && curGradeIdx > newGradeIdx) {
          return { ...s, assignedGrade: grade };
        }
        if (s.rank > changedStudent.rank && curGradeIdx < newGradeIdx) {
          return { ...s, assignedGrade: grade };
        }
        return s;
      });
    });
    setActivePreset(null);
  }, []);

  const handleReset = useCallback(() => {
    setBuckets(DEFAULT_BUCKETS);
    setMergeGroups(DEFAULT_MERGE_GROUPS);
    setNormParams(DEFAULT_NORM_PARAMS);
    setStudents(distributeEasynorm(makeDefaultStudents(), DEFAULT_NORM_PARAMS));
    setActivePreset("easynorm");
  }, []);

  // ── Merge/split handlers ───────────────────────────────────────────────────

  const handleMerge = useCallback(
    (gradeAbove: string, gradeBelow: string, field: MergeField) => {
      setMergeGroups((prev) => {
        const existingAbove = prev.find(
          (g) => g.field === field && g.grades.includes(gradeAbove)
        );
        const existingBelow = prev.find(
          (g) => g.field === field && g.grades.includes(gradeBelow)
        );

        if (!existingAbove && !existingBelow) {
          // Create new 2-grade group; totalPct defaults to sum of individual pcts
          const bAbove = buckets.find((b) => b.grade === gradeAbove)!;
          const bBelow = buckets.find((b) => b.grade === gradeBelow)!;
          const totalPct =
            field === "max"
              ? bAbove.maxPct + bBelow.maxPct
              : bAbove.minPct + bBelow.minPct;
          const grades = [gradeAbove, gradeBelow];
          return [
            ...prev,
            { id: `${field}-${grades.join(",")}`, field, grades, totalPct },
          ];
        }

        if (existingAbove && !existingBelow) {
          // Extend existingAbove to include gradeBelow
          const bBelow = buckets.find((b) => b.grade === gradeBelow)!;
          const addPct = field === "max" ? bBelow.maxPct : bBelow.minPct;
          const newGrades = [...existingAbove.grades, gradeBelow];
          const updated: MergeGroup = {
            ...existingAbove,
            grades: newGrades,
            totalPct: existingAbove.totalPct + addPct,
            id: `${field}-${newGrades.join(",")}`,
          };
          return prev.map((g) => (g === existingAbove ? updated : g));
        }

        if (!existingAbove && existingBelow) {
          // Prepend gradeAbove to existingBelow
          const bAbove = buckets.find((b) => b.grade === gradeAbove)!;
          const addPct = field === "max" ? bAbove.maxPct : bAbove.minPct;
          const newGrades = [gradeAbove, ...existingBelow.grades];
          const updated: MergeGroup = {
            ...existingBelow,
            grades: newGrades,
            totalPct: existingBelow.totalPct + addPct,
            id: `${field}-${newGrades.join(",")}`,
          };
          return prev.map((g) => (g === existingBelow ? updated : g));
        }

        // Both in different groups — merge them
        const newGrades = [...existingAbove!.grades, ...existingBelow!.grades];
        const combined: MergeGroup = {
          id: `${field}-${newGrades.join(",")}`,
          field,
          grades: newGrades,
          totalPct: existingAbove!.totalPct + existingBelow!.totalPct,
        };
        return prev
          .filter((g) => g !== existingAbove && g !== existingBelow)
          .concat(combined);
      });
    },
    [buckets],
  );

  const handleSplit = useCallback(
    (gradeAbove: string, gradeBelow: string, field: MergeField) => {
      setMergeGroups((prev) => {
        const group = prev.find(
          (g) =>
            g.field === field &&
            g.grades.includes(gradeAbove) &&
            g.grades.includes(gradeBelow),
        );
        if (!group) return prev;

        const splitIdx = group.grades.indexOf(gradeBelow);
        const topGrades = group.grades.slice(0, splitIdx);
        const bottomGrades = group.grades.slice(splitIdx);

        // Allocate totalPct proportionally by sum of individual pcts in each half
        const getPct = (g: string) => {
          const b = buckets.find((x) => x.grade === g);
          return field === "max" ? (b?.maxPct ?? 0) : (b?.minPct ?? 0);
        };
        const topPctSum = topGrades.reduce((s, g) => s + getPct(g), 0);
        const bottomPctSum = bottomGrades.reduce((s, g) => s + getPct(g), 0);
        const denom = topPctSum + bottomPctSum || 1;

        const replacements: MergeGroup[] = [];
        if (topGrades.length >= 2) {
          replacements.push({
            id: `${field}-${topGrades.join(",")}`,
            field,
            grades: topGrades,
            totalPct: Math.round((group.totalPct * topPctSum) / denom * 10) / 10,
          });
        }
        if (bottomGrades.length >= 2) {
          replacements.push({
            id: `${field}-${bottomGrades.join(",")}`,
            field,
            grades: bottomGrades,
            totalPct: Math.round((group.totalPct * bottomPctSum) / denom * 10) / 10,
          });
        }

        return prev.filter((g) => g !== group).concat(replacements);
      });
    },
    [buckets],
  );

  const handleGroupTotalChange = useCallback(
    (groupId: string, newTotalPct: number) => {
      setMergeGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, totalPct: newTotalPct } : g))
      );
    },
    [],
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Bucket Grading Playground</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
          Reset All
        </Button>
      </header>

      {/* Main 3-column grid */}
      <div
        className="flex-1 grid divide-x overflow-hidden"
        style={{ gridTemplateColumns: "280px 1fr 300px" }}
      >
        {/* LEFT: Bucket Rules */}
        <aside className="flex flex-col p-4 overflow-auto">
          <h2 className="text-sm font-semibold mb-3">Bucket Rules</h2>
          <BucketRules
            buckets={buckets}
            onChange={handleBucketsChange}
            studentCount={students.length}
            mergeGroups={mergeGroups}
            onMerge={handleMerge}
            onSplit={handleSplit}
            onGroupTotalChange={handleGroupTotalChange}
          />
        </aside>

        {/* CENTER: Students */}
        <main className="flex flex-col p-4">
          <h2 className="text-sm font-semibold mb-3">
            Students
            {students.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({students.length} loaded)
              </span>
            )}
          </h2>
          <StudentPanel
            students={students}
            buckets={buckets}
            mergeGroups={mergeGroups}
            activePreset={activePreset}
            onStudentsChange={handleStudentsChange}
            onLoadStudents={handleLoadStudents}
            onGradeChange={handleGradeChange}
          />
        </main>

        {/* RIGHT: Distribution */}
        <aside className="flex flex-col p-4 overflow-auto">
          <h2 className="text-sm font-semibold mb-3">Distribution</h2>
          <DistributionPanel
            students={students}
            buckets={buckets}
            mergeGroups={mergeGroups}
            onPreset={handlePreset}
            activePreset={activePreset}
            normParams={normParams}
            onNormParamsChange={handleNormParamsChange}
          />
        </aside>
      </div>

    </div>
  );
}
