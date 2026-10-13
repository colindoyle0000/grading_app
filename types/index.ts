export type GradeBucket = {
  grade: string;
  minPct: number; // 0–100
  maxPct: number; // 0–100
};

export type Student = {
  id: string;
  rawScore: number;
  rank: number; // 1 = highest score
  assignedGrade: string | null;
  curvedScore?: number | null; // Easynorm's normalized score; null for bucket presets
};

export type BucketConstraints = GradeBucket & {
  minCount: number; // floor(minPct * N / 100)
  maxCount: number; // floor(maxPct * N / 100)
};

export type SlotUsage = Record<string, number>;

export type DistributionPreset = "generous" | "stingy" | "easynorm";

// How a mean mandate measures the class: the 0–100 numeric score, or the GPA of the letters.
export type MandateMode = "score" | "gpa";

// A rule on the class mean, applied to every preset. The score range and the
// GPA range are kept separately so switching modes doesn't lose either one.
export type MeanMandate = {
  enabled: boolean;
  mode: MandateMode;
  min: number;    // lowest allowed class mean score (0–100 scale)
  max: number;    // highest allowed class mean score
  gpaMin: number; // lowest allowed class mean GPA
  gpaMax: number; // highest allowed class mean GPA
};

export type NormParams = {
  mean: number; // target mean of the curved scores (0–100 scale)
  sd: number;   // target standard deviation of the curved scores
};

export type MergeField = "min" | "max";

export type MergeGroup = {
  id: string;           // e.g. "max-A+,A,A-"
  field: MergeField;
  grades: string[];     // 2+ adjacent grades in GRADE_SCALE order
  totalPct: number;     // shared pool (0–100)
};
