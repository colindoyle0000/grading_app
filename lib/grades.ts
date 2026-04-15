import { GradeBucket } from "@/types";

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
  "A+": 4.3,
  "A":  4.0,
  "A-": 3.7,
  "B+": 3.3,
  "B":  3.0,
  "B-": 2.7,
  "C+": 2.3,
  "C":  2.0,
  "C-": 1.7,
  "D+": 1.3,
  "D":  1.0,
  "D-": 0.7,
  "F":  0.0,
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
  { grade: "C-", minPct: 0,    maxPct: 0  },
  { grade: "D+", minPct: 0,    maxPct: 0  },
  { grade: "D",  minPct: 0,    maxPct: 0  },
  { grade: "D-", minPct: 0,    maxPct: 0  },
  { grade: "F",  minPct: 0,    maxPct: 0  },
];
