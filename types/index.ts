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
};

export type BucketConstraints = GradeBucket & {
  minCount: number; // floor(minPct * N / 100)
  maxCount: number; // floor(maxPct * N / 100)
};

export type SlotUsage = Record<string, number>;

export type DistributionPreset = "generous" | "stingy" | "condensed" | "spread";

export type MergeField = "min" | "max";

export type MergeGroup = {
  id: string;           // e.g. "max-A+,A,A-"
  field: MergeField;
  grades: string[];     // 2+ adjacent grades in GRADE_SCALE order
  totalPct: number;     // shared pool (0–100)
};
