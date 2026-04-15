"use client";

import { useState, useCallback } from "react";
import { Student, GradeBucket, DistributionPreset } from "@/types";
import { DEFAULT_BUCKETS, GRADE_SCALE } from "@/lib/grades";
import {
  distributeGenerous,
  distributeStingy,
  distributeCondensed,
  distributeSpread,
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

const DISTRIBUTORS: Record<DistributionPreset, typeof distributeGenerous> = {
  generous: distributeGenerous,
  stingy: distributeStingy,
  condensed: distributeCondensed,
  spread: distributeSpread,
};

export default function Home() {
  const [buckets, setBuckets] = useState<GradeBucket[]>(DEFAULT_BUCKETS);
  const [students, setStudents] = useState<Student[]>(() =>
    distributeSpread(makeDefaultStudents(), DEFAULT_BUCKETS),
  );
  const [activePreset, setActivePreset] = useState<DistributionPreset | null>("spread");

  const isFeasible = validateBuckets(buckets).length === 0;

  // Called when new students are loaded (file upload / manual entry).
  // Auto-applies the spread preset so the chart is immediately populated.
  const handleLoadStudents = useCallback(
    (newStudents: Student[]) => {
      if (validateBuckets(buckets).length === 0) {
        setStudents(distributeSpread(newStudents, buckets));
        setActivePreset("spread");
      } else {
        setStudents(newStudents);
        setActivePreset(null);
      }
    },
    [buckets],
  );

  // Called when grades change via drag in the bar chart — no preset reset.
  const handleStudentsChange = useCallback((newStudents: Student[]) => {
    setStudents(newStudents);
    setActivePreset(null);
  }, []);

  const handleBucketsChange = useCallback(
    (newBuckets: GradeBucket[]) => {
      setBuckets(newBuckets);
      if (activePreset && students.length > 0 && validateBuckets(newBuckets).length === 0) {
        const updated = DISTRIBUTORS[activePreset](students, newBuckets);
        setStudents(updated);
      }
    },
    [activePreset, students],
  );

  const handlePreset = useCallback(
    (preset: DistributionPreset) => {
      if (students.length === 0 || !isFeasible) return;
      const updated = DISTRIBUTORS[preset](students, buckets);
      setStudents(updated);
      setActivePreset(preset);
    },
    [students, buckets, isFeasible],
  );

  // Grade change with rank-order cascade:
  // Changing student at studentIdx to `grade` forces all rank-violating students
  // to the same grade, preserving the invariant: better rank ⟹ equal-or-better grade.
  const handleGradeChange = useCallback((studentIdx: number, grade: string) => {
    setStudents((prev) => {
      const gradeScaleArr: string[] = Array.from(GRADE_SCALE);
      const changedStudent = prev[studentIdx];
      const newGradeIdx = gradeScaleArr.indexOf(grade);
      return prev.map((s, i) => {
        if (i === studentIdx) return { ...s, assignedGrade: grade };
        if (s.assignedGrade === null) return s;
        const curGradeIdx = gradeScaleArr.indexOf(s.assignedGrade);
        // Better student (lower rank number) must have grade at least as good (lower gradeIdx)
        if (s.rank < changedStudent.rank && curGradeIdx > newGradeIdx) {
          return { ...s, assignedGrade: grade };
        }
        // Worse student (higher rank number) must have grade no better (higher or equal gradeIdx)
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
    setStudents(distributeSpread(makeDefaultStudents(), DEFAULT_BUCKETS));
    setActivePreset("spread");
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Bucket Grading Playground</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure bucket rules, load students, and explore distributions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
          Reset All
        </Button>
      </header>

      {/* Main 3-column grid */}
      <div
        className="flex-1 grid divide-x overflow-hidden"
        style={{ gridTemplateColumns: "260px 1fr 300px" }}
      >
        {/* LEFT: Bucket Rules */}
        <aside className="flex flex-col p-4 overflow-auto">
          <h2 className="text-sm font-semibold mb-3">Bucket Rules</h2>
          <BucketRules
            buckets={buckets}
            onChange={handleBucketsChange}
            studentCount={students.length}
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
            onPreset={handlePreset}
            activePreset={activePreset}
          />
        </aside>
      </div>

    </div>
  );
}
