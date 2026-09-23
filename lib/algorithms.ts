import { GradeBucket, Student, BucketConstraints, SlotUsage, MergeGroup, NormParams } from "@/types";
import { GPA_MAP } from "@/lib/grades";

/** Build BucketConstraints from raw bucket config + student count */
export function buildConstraints(buckets: GradeBucket[], n: number): BucketConstraints[] {
  return buckets.map((b) => ({
    ...b,
    minCount: Math.floor((b.minPct / 100) * n),
    maxCount: Math.floor((b.maxPct / 100) * n),
  }));
}

/**
 * Effective sum of max percentages, accounting for merge groups.
 * For grades in a max group: the group's totalPct counts once (not each grade's individual maxPct).
 * For ungrouped grades: their individual maxPct is used.
 */
function computeEffectiveSumMaxPct(buckets: GradeBucket[], mergeGroups: MergeGroup[]): number {
  const maxGroups = mergeGroups.filter((g) => g.field === "max");
  const gradesInMaxGroup = new Set(maxGroups.flatMap((g) => g.grades));
  let sum = 0;
  for (const group of maxGroups) sum += group.totalPct;
  for (const b of buckets) {
    if (!gradesInMaxGroup.has(b.grade)) sum += b.maxPct;
  }
  return sum;
}

/**
 * Core allocator: given constraints and N students, returns how many go in each
 * bucket (parallel array to constraints). Returns null if infeasible.
 *
 * fillOrder: indices into constraints, in the order to pile on slack.
 * mergeGroups: optional group constraints; max-group members share a total cap.
 */
function allocate(
  constraints: BucketConstraints[],
  n: number,
  fillOrder: number[],
  mergeGroups: MergeGroup[] = [],
): number[] | null {
  const allocs = constraints.map((c) => c.minCount);
  let remaining = n - allocs.reduce((a, b) => a + b, 0);

  if (remaining < 0) return null; // sum of mins > N

  // Build group lookup for max-merge groups
  // gradeToGroupGrades[grade] = all grades sharing this grade's max pool
  // groupTotalCounts[grade]   = floor(totalPct/100 * n) for this grade's group
  const groupTotalCounts: Record<string, number> = {};
  const gradeToGroupGrades: Record<string, string[]> = {};
  for (const group of mergeGroups) {
    if (group.field !== "max") continue;
    const total = Math.floor((group.totalPct / 100) * n);
    for (const g of group.grades) {
      groupTotalCounts[g] = total;
      gradeToGroupGrades[g] = group.grades;
    }
  }

  // Feasibility: effective sum of maxes >= n
  const effectiveSumMax = (() => {
    const maxGroups = mergeGroups.filter((g) => g.field === "max");
    const inGroup = new Set(maxGroups.flatMap((g) => g.grades));
    let s = 0;
    for (const group of maxGroups) s += Math.floor((group.totalPct / 100) * n);
    for (const c of constraints) {
      if (!inGroup.has(c.grade)) s += c.maxCount;
    }
    return s;
  })();
  if (effectiveSumMax < n) return null;

  function getEffectiveCap(i: number): number {
    const c = constraints[i];
    if (groupTotalCounts[c.grade] === undefined) return c.maxCount;
    const groupGrades = gradeToGroupGrades[c.grade];
    const currentGroupAlloc = groupGrades.reduce((sum, g) => {
      const idx = constraints.findIndex((x) => x.grade === g);
      return sum + (idx >= 0 ? allocs[idx] : 0);
    }, 0);
    return Math.min(c.maxCount, groupTotalCounts[c.grade] - currentGroupAlloc);
  }

  for (const i of fillOrder) {
    if (remaining <= 0) break;
    const cap = getEffectiveCap(i);
    const add = Math.min(cap - allocs[i], remaining);
    if (add > 0) {
      allocs[i] += add;
      remaining -= add;
    }
  }

  if (remaining > 0) return null; // couldn't fit everyone
  return allocs;
}

/** Assign grades to students (sorted best→worst) given allocation counts */
function assignFromAllocation(students: Student[], allocs: number[]): Student[] {
  const result: Student[] = [];
  let bucketIdx = 0;
  let countInBucket = 0;

  // Skip empty buckets
  while (bucketIdx < allocs.length && allocs[bucketIdx] === 0) bucketIdx++;

  for (const student of students) {
    if (bucketIdx >= allocs.length) {
      result.push({ ...student, assignedGrade: null });
      continue;
    }
    const grade = GRADE_SCALE_FROM_IDX(bucketIdx);
    result.push({ ...student, assignedGrade: grade });
    countInBucket++;
    if (countInBucket >= allocs[bucketIdx]) {
      countInBucket = 0;
      bucketIdx++;
      while (bucketIdx < allocs.length && allocs[bucketIdx] === 0) bucketIdx++;
    }
  }
  return result;
}

// Need GRADE_SCALE here — import inline to avoid circular
const GRADE_SCALE = [
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
];
function GRADE_SCALE_FROM_IDX(i: number) { return GRADE_SCALE[i]; }

/**
 * Generous: fill high-grade buckets (A+, A, …) with as many students as allowed.
 * Fill order: 0, 1, 2, … (best first)
 */
export function distributeGenerous(
  students: Student[],
  buckets: GradeBucket[],
  mergeGroups: MergeGroup[] = [],
): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  const constraints = buildConstraints(buckets, sorted.length);
  const fillOrder = constraints.map((_, i) => i); // 0..12
  const allocs = allocate(constraints, sorted.length, fillOrder, mergeGroups);
  if (!allocs) return sorted;
  return assignFromAllocation(sorted, allocs);
}

/**
 * Stingy: fill low-grade buckets (F, D-, …) with as many students as allowed.
 * Fill order: 12, 11, 10, … (worst first)
 */
export function distributeStingy(
  students: Student[],
  buckets: GradeBucket[],
  mergeGroups: MergeGroup[] = [],
): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  const constraints = buildConstraints(buckets, sorted.length);
  const fillOrder = constraints.map((_, i) => i).reverse(); // 12..0
  const allocs = allocate(constraints, sorted.length, fillOrder, mergeGroups);
  if (!allocs) return sorted;
  return assignFromAllocation(sorted, allocs);
}

/**
 * Condensed: cluster as many students as possible in the middle (center-out).
 * Center is determined dynamically: the grade where the median student falls
 * under the minimum allocations. This anchors the condensed distribution around
 * the natural midpoint of the constrained grade range rather than the fixed
 * midpoint of the 13-grade scale (which drifts away from the actual median when
 * minimums are concentrated in the upper half). Falls back to the grade-scale
 * midpoint (C+, index 6) when minimums are too sparse to determine the median.
 */
export function distributeCondensed(
  students: Student[],
  buckets: GradeBucket[],
  mergeGroups: MergeGroup[] = [],
): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  const constraints = buildConstraints(buckets, sorted.length);
  const n = constraints.length;

  // Find the grade where the median student lands under minimum allocations.
  const half = Math.floor(sorted.length / 2);
  let center = Math.floor(n / 2); // fallback: C+ (grade-scale midpoint)
  let cumulative = 0;
  for (let i = 0; i < n; i++) {
    cumulative += constraints[i].minCount;
    if (cumulative >= half) {
      center = i;
      break;
    }
  }

  const fillOrder: number[] = [center];
  for (let offset = 1; offset < n; offset++) {
    if (center - offset >= 0) fillOrder.push(center - offset);
    if (center + offset < n) fillOrder.push(center + offset);
  }
  const allocs = allocate(constraints, sorted.length, fillOrder, mergeGroups);
  if (!allocs) return sorted;
  return assignFromAllocation(sorted, allocs);
}

/**
 * Spread: maximize number of distinct grade buckets used.
 * Round-robin in center-out order, giving 1 extra per pass until remaining = 0.
 */
export function distributeSpread(
  students: Student[],
  buckets: GradeBucket[],
  mergeGroups: MergeGroup[] = [],
): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  const constraints = buildConstraints(buckets, sorted.length);
  const n = constraints.length;
  const center = Math.floor(n / 2);
  const centerOut: number[] = [center];
  for (let offset = 1; offset < n; offset++) {
    if (center - offset >= 0) centerOut.push(center - offset);
    if (center + offset < n) centerOut.push(center + offset);
  }

  // Build group lookup (same as allocate)
  const groupTotalCounts: Record<string, number> = {};
  const gradeToGroupGrades: Record<string, string[]> = {};
  for (const group of mergeGroups) {
    if (group.field !== "max") continue;
    const total = Math.floor((group.totalPct / 100) * sorted.length);
    for (const g of group.grades) {
      groupTotalCounts[g] = total;
      gradeToGroupGrades[g] = group.grades;
    }
  }

  // For spread, use a custom round-robin allocator
  const allocs = constraints.map((c) => c.minCount);
  let remaining = sorted.length - allocs.reduce((a, b) => a + b, 0);

  function getEffectiveCap(i: number): number {
    const c = constraints[i];
    if (groupTotalCounts[c.grade] === undefined) return c.maxCount;
    const groupGrades = gradeToGroupGrades[c.grade];
    const currentGroupAlloc = groupGrades.reduce((sum, g) => {
      const idx = constraints.findIndex((x) => x.grade === g);
      return sum + (idx >= 0 ? allocs[idx] : 0);
    }, 0);
    return Math.min(c.maxCount, groupTotalCounts[c.grade] - currentGroupAlloc);
  }

  while (remaining > 0) {
    let added = 0;
    for (const i of centerOut) {
      if (remaining <= 0) break;
      if (allocs[i] < getEffectiveCap(i)) {
        allocs[i]++;
        remaining--;
        added++;
      }
    }
    if (added === 0) break; // no room left anywhere
  }

  return assignFromAllocation(sorted, allocs);
}

/**
 * Map a curved score (0–100 scale) to a letter grade.
 */
export function normalizedScoreToGrade(score: number): string {
  // Cutoffs are whole-number scores, so round first (81.4 → 81 → B, 81.5 → 82 → B+).
  const rounded = Math.round(score);
  for (const [cutoff, grade] of EASYNORM_CUTOFFS) {
    if (rounded >= cutoff) return grade;
  }
  return "F"; // 57 and below
}

// Lowest score for each grade, best → worst, in 3-point bands. 94–100 is "A+*"
// on the source scale; it maps to A+ because the grade scale has no A+* bucket.
// C- and below continue the 3-point pattern down from C.
const EASYNORM_CUTOFFS: [number, string][] = [
  [91, "A+"],
  [88, "A"],
  [85, "A-"],
  [82, "B+"],
  [79, "B"],
  [76, "B-"],
  [73, "C+"],
  [70, "C"],
  [67, "C-"],
  [64, "D+"],
  [61, "D"],
  [58, "D-"],
];

/**
 * Easynorm: rescale raw scores so the class has the target mean and SD, then
 * convert each curved score to a letter with normalizedScoreToGrade().
 * Ignores bucket rules — any mismatch shows up as constraint violations.
 */
export function distributeEasynorm(students: Student[], params: NormParams): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  const n = sorted.length;
  if (n === 0) return sorted;
  const rawMean = sorted.reduce((acc, s) => acc + s.rawScore, 0) / n;
  const rawSd = Math.sqrt(sorted.reduce((acc, s) => acc + (s.rawScore - rawMean) ** 2, 0) / n);
  return sorted.map((s) => {
    // All-identical scores have no spread: everyone lands on the target mean.
    const z = rawSd > 0 ? (s.rawScore - rawMean) / rawSd : 0;
    return { ...s, assignedGrade: normalizedScoreToGrade(params.mean + z * params.sd) };
  });
}

/** Compute slot usage (grade → count) from a student list */
export function computeSlotUsage(students: Student[]): SlotUsage {
  const usage: SlotUsage = {};
  for (const s of students) {
    if (s.assignedGrade) {
      usage[s.assignedGrade] = (usage[s.assignedGrade] ?? 0) + 1;
    }
  }
  return usage;
}

/** Compute mean GPA from assigned grades */
export function computeMean(students: Student[]): number {
  const graded = students.filter((s) => s.assignedGrade !== null);
  if (graded.length === 0) return 0;
  const sum = graded.reduce((acc, s) => acc + (GPA_MAP[s.assignedGrade!] ?? 0), 0);
  return sum / graded.length;
}

/** Compute median GPA from assigned grades */
export function computeMedian(students: Student[]): number {
  const graded = students.filter((s) => s.assignedGrade !== null);
  if (graded.length === 0) return 0;
  const gpas = graded
    .map((s) => GPA_MAP[s.assignedGrade!] ?? 0)
    .sort((a, b) => a - b);
  const mid = Math.floor(gpas.length / 2);
  return gpas.length % 2 === 0 ? (gpas[mid - 1] + gpas[mid]) / 2 : gpas[mid];
}

/** Convert a GPA number to the nearest letter grade */
export function gpaToLetterGrade(gpa: number): string {
  let best = "F";
  let minDiff = Infinity;
  for (const [grade, val] of Object.entries(GPA_MAP)) {
    const diff = Math.abs(val - gpa);
    if (diff < minDiff) {
      minDiff = diff;
      best = grade;
    }
  }
  return best;
}

/** Compute standard deviation of GPA from assigned grades */
export function computeStdDev(students: Student[]): number {
  const graded = students.filter((s) => s.assignedGrade !== null);
  if (graded.length < 2) return 0;
  const mean = computeMean(graded);
  const variance =
    graded.reduce((acc, s) => {
      const diff = (GPA_MAP[s.assignedGrade!] ?? 0) - mean;
      return acc + diff * diff;
    }, 0) / graded.length;
  return Math.sqrt(variance);
}

/** Guaranteed minimums: floor(minPct * N / 100) for key grades */
export function computeGuaranteed(
  buckets: GradeBucket[],
  n: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const b of buckets) {
    result[b.grade] = Math.floor((b.minPct / 100) * n);
  }
  return result;
}

/** Validation: returns list of error strings (empty = valid) */
export function validateBuckets(
  buckets: GradeBucket[],
  mergeGroups: MergeGroup[] = [],
): string[] {
  const errors: string[] = [];
  const sumMin = buckets.reduce((a, b) => a + b.minPct, 0);
  const effectiveSumMax = computeEffectiveSumMaxPct(buckets, mergeGroups);

  if (sumMin > 100) errors.push(`Sum of minimums is ${sumMin.toFixed(1)}% — must be ≤ 100%`);
  if (effectiveSumMax < 100) {
    errors.push(`Effective sum of maximums is ${effectiveSumMax.toFixed(1)}% — must be ≥ 100%`);
  }

  for (const b of buckets) {
    if (b.minPct > b.maxPct) errors.push(`${b.grade}: min (${b.minPct}%) > max (${b.maxPct}%)`);
    if (b.minPct < 0 || b.maxPct > 100) errors.push(`${b.grade}: percentages must be 0–100`);
  }

  // Group-level checks
  for (const group of mergeGroups) {
    if (group.field === "max") {
      const groupMinSum = group.grades.reduce((sum, g) => {
        const bucket = buckets.find((b) => b.grade === g);
        return sum + (bucket?.minPct ?? 0);
      }, 0);
      if (group.totalPct < groupMinSum) {
        errors.push(
          `Merged max [${group.grades.join(", ")}]: pool ${group.totalPct}% < sum of minimums ${groupMinSum}%`
        );
      }
    }
  }

  return errors;
}

/** Check if the current manual assignment violates any bucket constraints */
export function checkViolations(
  students: Student[],
  buckets: GradeBucket[],
  mergeGroups: MergeGroup[] = [],
): string[] {
  const n = students.length;
  if (n === 0) return [];
  const constraints = buildConstraints(buckets, n);
  const usage = computeSlotUsage(students);
  const violations: string[] = [];

  for (const c of constraints) {
    const count = usage[c.grade] ?? 0;
    if (count < c.minCount) violations.push(`${c.grade} below minimum (${count}/${c.minCount})`);
    if (count > c.maxCount) violations.push(`${c.grade} above maximum (${count}/${c.maxCount})`);
  }

  // Group-level max violations
  for (const group of mergeGroups) {
    if (group.field !== "max") continue;
    const groupCount = group.grades.reduce((sum, g) => sum + (usage[g] ?? 0), 0);
    const groupMax = Math.floor((group.totalPct / 100) * n);
    if (groupCount > groupMax) {
      violations.push(
        `Group [${group.grades.join(", ")}] above shared max (${groupCount}/${groupMax})`
      );
    }
  }

  return violations;
}
