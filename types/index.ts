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
