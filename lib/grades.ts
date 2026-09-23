import { GradeBucket, MergeGroup, NormParams } from "@/types";

// Ordered best → worst
export const GRADE_SCALE = [
  "A+", "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
] as const;

export type Grade = (typeof GRADE_SCALE)[number];

export const GPA_MAP: Record<string, number> = {
  "A+": 4.333,
  "A":  4.0,
  "A-": 3.667,
  "B+": 3.333,
  "B":  3.0,
  "B-": 2.667,
  "C+": 2.333,
  "C":  2.0,
  "C-": 1.7,
  "D+": 1.333,
  "D":  1.0,
  "D-": 0.7,
  "F":  0.333,
};

export const DEFAULT_BUCKETS: GradeBucket[] = [
  { grade: "A+", minPct: 0,    maxPct: 5  },
  { grade: "A",  minPct: 5,    maxPct: 10 },
  { grade: "A-", minPct: 7.5,  maxPct: 15 },
  { grade: "B+", minPct: 15,   maxPct: 25 },
  { grade: "B",  minPct: 15,   maxPct: 25 },
  { grade: "B-", minPct: 15,   maxPct: 25 },
  { grade: "C+", minPct: 7.5,  maxPct: 15 },
  { grade: "C",  minPct: 5,    maxPct: 10 },
  { grade: "C-", minPct: 0,    maxPct: 5  },
  { grade: "D+", minPct: 0,    maxPct: 5  },
  { grade: "D",  minPct: 0,    maxPct: 5  },
  { grade: "D-", minPct: 0,    maxPct: 5  },
  { grade: "F",  minPct: 0,    maxPct: 5  },
];

// C- through F share one pool: 0–5% combined (each individually capped at 5%).
const LOW_GRADES = ["C-", "D+", "D", "D-", "F"];
export const DEFAULT_MERGE_GROUPS: MergeGroup[] = [
  { id: `max-${LOW_GRADES.join(",")}`, field: "max", grades: LOW_GRADES, totalPct: 5 },
  { id: `min-${LOW_GRADES.join(",")}`, field: "min", grades: LOW_GRADES, totalPct: 0 },
];

export const DEFAULT_NORM_PARAMS: NormParams = { mean: 81, sd: 6 };
