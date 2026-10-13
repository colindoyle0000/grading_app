import { GradeBucket, MergeGroup, NormParams, MeanMandate } from "@/types";

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
  { grade: "A+", minPct: 2.5,  maxPct: 7.5  },
  { grade: "A",  minPct: 7.5,  maxPct: 12.5 },
  { grade: "A-", minPct: 12.5, maxPct: 17.5 },
  { grade: "B+", minPct: 17.5, maxPct: 22.5 },
  { grade: "B",  minPct: 17.5, maxPct: 22.5 },
  { grade: "B-", minPct: 12.5, maxPct: 17.5 },
  { grade: "C+", minPct: 7.5,  maxPct: 12.5 },
  { grade: "C",  minPct: 2.5,  maxPct: 7.5  },
  { grade: "C-", minPct: 0,    maxPct: 5    },
  { grade: "D+", minPct: 0,    maxPct: 5    },
  { grade: "D",  minPct: 0,    maxPct: 5    },
  { grade: "D-", minPct: 0,    maxPct: 5    },
  { grade: "F",  minPct: 0,    maxPct: 5    },
];

// C- through F share one pool: 0–5% combined (each individually capped at 5%).
const LOW_GRADES = ["C-", "D+", "D", "D-", "F"];
export const DEFAULT_MERGE_GROUPS: MergeGroup[] = [
  { id: `max-${LOW_GRADES.join(",")}`, field: "max", grades: LOW_GRADES, totalPct: 5 },
  { id: `min-${LOW_GRADES.join(",")}`, field: "min", grades: LOW_GRADES, totalPct: 0 },
];

export const DEFAULT_NORM_PARAMS: NormParams = { mean: 81, sd: 6 };

export const DEFAULT_MEAN_MANDATE: MeanMandate = {
  enabled: true,
  mode: "score",
  min: 80,
  max: 82,
  gpaMin: 3.0,
  gpaMax: 3.3,
};

/**
 * Representative 0–100 score for each letter: the midpoint of its band on the
 * Easynorm scale (see EASYNORM_CUTOFFS). A+ spans 91–100 and F is open-ended
 * below 58, so those two use 95 and 50. Used wherever a letter has to stand in
 * for a number, e.g. the class mean of a bucket preset.
 */
export const GRADE_SCORE: Record<string, number> = {
  "A+": 95, "A": 89, "A-": 86,
  "B+": 83, "B": 80, "B-": 77,
  "C+": 74, "C": 71, "C-": 68,
  "D+": 65, "D": 62, "D-": 59,
  "F": 50,
};
