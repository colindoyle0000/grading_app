import { GradeBucket, Student, BucketConstraints, SlotUsage } from "@/types";
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
 * Core allocator: given constraints and N students, returns how many go in each
 * bucket (parallel array to constraints). Returns null if infeasible.
 *
 * fillOrder: indices into constraints, in the order to pile on slack.
 */
function allocate(constraints: BucketConstraints[], n: number, fillOrder: number[]): number[] | null {
  const allocs = constraints.map((c) => c.minCount);
  let remaining = n - allocs.reduce((a, b) => a + b, 0);

  if (remaining < 0) return null; // sum of mins > N
  if (constraints.reduce((a, c) => a + c.maxCount, 0) < n) return null; // sum of maxes < N

  for (const i of fillOrder) {
    if (remaining <= 0) break;
    const add = Math.min(constraints[i].maxCount - allocs[i], remaining);
    allocs[i] += add;
    remaining -= add;
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
export function distributeGenerous(students: Student[], buckets: GradeBucket[]): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  const constraints = buildConstraints(buckets, sorted.length);
  const fillOrder = constraints.map((_, i) => i); // 0..12
  const allocs = allocate(constraints, sorted.length, fillOrder);
  if (!allocs) return sorted;
  return assignFromAllocation(sorted, allocs);
}

/**
 * Stingy: fill low-grade buckets (F, D-, …) with as many students as allowed.
 * Fill order: 12, 11, 10, … (worst first)
 */
export function distributeStingy(students: Student[], buckets: GradeBucket[]): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  const constraints = buildConstraints(buckets, sorted.length);
  const fillOrder = constraints.map((_, i) => i).reverse(); // 12..0
  const allocs = allocate(constraints, sorted.length, fillOrder);
  if (!allocs) return sorted;
  return assignFromAllocation(sorted, allocs);
}

/**
 * Condensed: cluster as many students as possible in the middle (center-out).
 * Middle = index 6 (C+). Expands outward alternately: 6, 5, 7, 4, 8, …
 */
export function distributeCondensed(students: Student[], buckets: GradeBucket[]): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  const constraints = buildConstraints(buckets, sorted.length);
  const n = constraints.length; // 13
  const center = Math.floor(n / 2); // 6
  const fillOrder: number[] = [center];
  for (let offset = 1; offset < n; offset++) {
    if (center - offset >= 0) fillOrder.push(center - offset);
    if (center + offset < n) fillOrder.push(center + offset);
  }
  const allocs = allocate(constraints, sorted.length, fillOrder);
  if (!allocs) return sorted;
  return assignFromAllocation(sorted, allocs);
}

/**
 * Spread: maximize number of distinct grade buckets used.
 * Round-robin in center-out order, giving 1 extra per pass until remaining = 0.
 */
export function distributeSpread(students: Student[], buckets: GradeBucket[]): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  const constraints = buildConstraints(buckets, sorted.length);
  const n = constraints.length;
  const center = Math.floor(n / 2);
  const centerOut: number[] = [center];
  for (let offset = 1; offset < n; offset++) {
    if (center - offset >= 0) centerOut.push(center - offset);
    if (center + offset < n) centerOut.push(center + offset);
  }
  // For spread, use a custom round-robin allocator
  const allocs = constraints.map((c) => c.minCount);
  let remaining = sorted.length - allocs.reduce((a, b) => a + b, 0);

  while (remaining > 0) {
    let added = 0;
    for (const i of centerOut) {
      if (remaining <= 0) break;
      if (allocs[i] < constraints[i].maxCount) {
        allocs[i]++;
        remaining--;
        added++;
      }
    }
    if (added === 0) break; // no room left anywhere
  }

  return assignFromAllocation(sorted, allocs);
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
export function validateBuckets(buckets: GradeBucket[]): string[] {
  const errors: string[] = [];
  const sumMin = buckets.reduce((a, b) => a + b.minPct, 0);
  const sumMax = buckets.reduce((a, b) => a + b.maxPct, 0);
  if (sumMin > 100) errors.push(`Sum of minimums is ${sumMin.toFixed(1)}% — must be ≤ 100%`);
  if (sumMax < 100) errors.push(`Sum of maximums is ${sumMax.toFixed(1)}% — must be ≥ 100%`);
  for (const b of buckets) {
    if (b.minPct > b.maxPct) errors.push(`${b.grade}: min (${b.minPct}%) > max (${b.maxPct}%)`);
    if (b.minPct < 0 || b.maxPct > 100) errors.push(`${b.grade}: percentages must be 0–100`);
  }
  return errors;
}

/** Check if the current manual assignment violates any bucket constraints */
export function checkViolations(
  students: Student[],
  buckets: GradeBucket[]
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
  return violations;
}
