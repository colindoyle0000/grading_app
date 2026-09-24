"use client";

import { useRef, useState, useEffect } from "react";
import { Student, GradeBucket, MergeGroup } from "@/types";
import { GRADE_SCALE } from "@/lib/grades";
import { buildConstraints } from "@/lib/algorithms";

// ─── SVG constants ────────────────────────────────────────────────────────────
const SVG_W = 1000;
const SVG_H = 500;
const ML = 50;   // margin left  (Y-axis)
const MT = 20;   // margin top
const MR = 15;   // margin right
const MB = 40;   // margin bottom (X-axis labels)
const CHART_W = SVG_W - ML - MR;       // 935
const CHART_H = SVG_H - MT - MB;       // 440
const CHART_BOTTOM = MT + CHART_H;     // 460
const R = 7;                           // circle radius (normal)
const R_HOVER = 9;                     // circle radius (hovered)
const V_UNIT = 17;                     // vertical spacing per circle (2R + 3px gap)

// Animation timing
const ANIM_DUR = 160;   // ms — position transition duration
const STAGGER = 30;     // ms — extra delay per circle in the arriving group

function circleY(circleIdxFromBottom: number): number {
  return CHART_BOTTOM - R - circleIdxFromBottom * V_UNIT;
}

function barH(count: number): number {
  return count * V_UNIT;
}

// ─── SVG coordinate helper ────────────────────────────────────────────────────
function clientToSVG(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const m = svg.getScreenCTM()!.inverse();
  return {
    x: clientX * m.a + clientY * m.c + m.e,
    y: clientX * m.b + clientY * m.d + m.f,
  };
}

// ─── Core drag logic (pure function) ─────────────────────────────────────────
function applyDrag(
  students: Student[],
  srcGradeIdx: number,
  dstGradeIdx: number,
  circleIdxFromBottom: number,
): Student[] {
  if (srcGradeIdx === dstGradeIdx) return students;

  const srcGrade = GRADE_SCALE[srcGradeIdx];
  const srcStudents = students
    .filter((s) => s.assignedGrade === srcGrade)
    .sort((a, b) => a.rank - b.rank); // index 0 = best rank = TOP of column

  if (!srcStudents.length) return students;

  const pivotIdx = Math.max(
    0,
    Math.min(srcStudents.length - 1, srcStudents.length - 1 - circleIdxFromBottom),
  );

  const moveIds = new Set<string>();

  if (dstGradeIdx < srcGradeIdx) {
    // Moving to BETTER grade: take the top portion (best-ranked, "above" dragged circle)
    srcStudents.slice(0, pivotIdx + 1).forEach((s) => moveIds.add(s.id));
    // Drain intermediate grades (rank-order preservation)
    for (let g = dstGradeIdx + 1; g < srcGradeIdx; g++) {
      students
        .filter((s) => s.assignedGrade === GRADE_SCALE[g])
        .forEach((s) => moveIds.add(s.id));
    }
  } else {
    // Moving to WORSE grade: take the bottom portion (worst-ranked, "below" dragged circle)
    srcStudents.slice(pivotIdx).forEach((s) => moveIds.add(s.id));
    // Drain intermediate grades
    for (let g = srcGradeIdx + 1; g < dstGradeIdx; g++) {
      students
        .filter((s) => s.assignedGrade === GRADE_SCALE[g])
        .forEach((s) => moveIds.add(s.id));
    }
  }

  const dstGrade = GRADE_SCALE[dstGradeIdx];
  return students.map((s) =>
    moveIds.has(s.id) ? { ...s, assignedGrade: dstGrade } : s,
  );
}

// ─── Drag state ───────────────────────────────────────────────────────────────
type DragState = {
  srcGradeIdx: number;
  circleIdxFromBottom: number;
  currentGradeIdx: number;
  previewStudents: Student[];
  originalStudents: Student[];
} | null;

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  students: Student[];
  buckets: GradeBucket[];
  mergeGroups: MergeGroup[];
  onStudentsChange: (students: Student[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function GradeVisualization({ students, buckets, mergeGroups, onStudentsChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Escape key cancels drag
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrag(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag]);

  const displayStudents = drag ? drag.previewStudents : students;
  const gradeScaleArr: string[] = Array.from(GRADE_SCALE);

  // Per-grade student lists (sorted rank asc → index 0 = best = TOP of column)
  const columnStudents: Student[][] = gradeScaleArr.map((grade) =>
    displayStudents
      .filter((s) => s.assignedGrade === grade)
      .sort((a, b) => a.rank - b.rank),
  );

  // Full constraints (indexed parallel to GRADE_SCALE)
  const N = students.length;
  const constraints = buildConstraints(buckets, N);

  // ── Effective max counts for merged groups ──────────────────────────────────
  // For a grade in a max merge group: effectiveMax = min(grade.maxCount, totalGroupMax - countInOtherGroupGrades)
  // Uses committed students (not drag preview) — updates as students move between columns.
  const effectiveMaxCounts: number[] = constraints.map((c) => {
    const group = mergeGroups.find(
      (g) => g.field === "max" && g.grades.includes(c.grade)
    );
    if (!group) return c.maxCount;
    const groupTotalCount = Math.floor((group.totalPct / 100) * N);
    const otherGroupCount = group.grades
      .filter((g) => g !== c.grade)
      .reduce(
        (sum, g) => sum + students.filter((s) => s.assignedGrade === g).length,
        0,
      );
    return Math.max(0, Math.min(c.maxCount, groupTotalCount - otherGroupCount));
  });

  // ── Visible columns: only grades with maxCount > 0 ─────────────────────────
  const visibleGradeIndices: number[] = constraints
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.maxCount > 0)
    .map(({ i }) => i);

  const numCols = visibleGradeIndices.length || 1;
  const COL_W = CHART_W / numCols;

  // grade-scale index → visual column index (-1 if not visible)
  const gradeToVisCol = new Map<number, number>();
  visibleGradeIndices.forEach((gradeIdx, visCol) => gradeToVisCol.set(gradeIdx, visCol));

  function colCenterX(visCol: number): number {
    return ML + (visCol + 0.5) * COL_W;
  }

  // SVG x → visual column index (clamped)
  function visColFromSVGX(svgX: number): number {
    return Math.max(0, Math.min(numCols - 1, Math.floor((svgX - ML) / COL_W)));
  }

  // ── Derive moving set ───────────────────────────────────────────────────────
  const movingIds = new Set<string>();
  if (drag) {
    const orig = new Map(drag.originalStudents.map((s) => [s.id, s.assignedGrade]));
    for (const s of drag.previewStudents) {
      if (s.assignedGrade !== orig.get(s.id)) movingIds.add(s.id);
    }
  }

  const delayMap = new Map<string, number>();
  if (drag && movingIds.size > 0) {
    const movingStudents = [...movingIds]
      .map((id) => displayStudents.find((s) => s.id === id))
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rank - b.rank);

    movingStudents.forEach((s, sortedIdx) => {
      const n = movingStudents.length;
      const delay = (n - 1 - sortedIdx) * STAGGER;
      delayMap.set(s.id, delay);
    });
  }

  // ── Pointer handlers ────────────────────────────────────────────────────────
  function handleCirclePointerDown(
    e: React.PointerEvent<SVGCircleElement>,
    gradeIdx: number,
    circleIdxFromBottom: number,
  ) {
    e.preventDefault();
    setHoveredId(null);
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      srcGradeIdx: gradeIdx,
      circleIdxFromBottom,
      currentGradeIdx: gradeIdx,
      previewStudents: students,
      originalStudents: students,
    });
  }

  function handleSVGPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag || !svgRef.current) return;
    const { x: svgX } = clientToSVG(svgRef.current, e.clientX, e.clientY);
    const dstGradeIdx = visibleGradeIndices[visColFromSVGX(svgX)];
    if (dstGradeIdx === drag.currentGradeIdx) return;

    const preview = applyDrag(
      drag.originalStudents,
      drag.srcGradeIdx,
      dstGradeIdx,
      drag.circleIdxFromBottom,
    );
    setDrag({ ...drag, currentGradeIdx: dstGradeIdx, previewStudents: preview });
  }

  function handleSVGPointerUp() {
    if (!drag) return;
    if (drag.currentGradeIdx !== drag.srcGradeIdx) {
      onStudentsChange(drag.previewStudents);
    }
    setDrag(null);
  }

  function handleSVGPointerCancel() {
    setDrag(null);
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (N === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Load students to see the grade distribution chart.
      </p>
    );
  }

  // ── Y-axis ticks ────────────────────────────────────────────────────────────
  const visibleMaxCounts = visibleGradeIndices.map((i) => constraints[i].maxCount);
  const maxCount = Math.max(...visibleMaxCounts, 5);
  const tickStep = maxCount <= 10 ? 2 : maxCount <= 20 ? 5 : 10;
  const ticks: number[] = [];
  for (let v = 0; v <= maxCount + tickStep; v += tickStep) ticks.push(v);

  const hasGrades = students.some((s) => s.assignedGrade);
  const hasMaxGroups = mergeGroups.some((g) => g.field === "max");

  return (
    <div>
      {/* Legend + drag hint */}
      <div className="flex items-center gap-5 px-1 py-1.5 border-b bg-muted/30 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" className="shrink-0">
            <rect x="1" y="1" width="11" height="11" fill="#d1d5db" />
          </svg>
          <span>Min %</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" className="shrink-0">
            <rect x="1" y="1" width="11" height="11" fill="none" stroke="#111827" strokeWidth="1.5" />
          </svg>
          <span>Max %</span>
        </div>
        {hasMaxGroups && (
          <div className="flex items-center gap-1.5">
            <svg width="13" height="13" className="shrink-0">
              <rect
                x="1" y="1" width="11" height="11"
                fill="rgba(59,130,246,0.08)"
                stroke="#3b82f6"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            </svg>
            <span>Shared pool</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" className="shrink-0">
            <circle cx="6.5" cy="6.5" r="5" fill="#3b82f6" />
          </svg>
          <span>Student</span>
        </div>
        <span className="ml-auto shrink-0">
          {hasGrades ? "Drag circles to reassign grades" : "Apply a preset to assign grades"}
        </span>
      </div>

      {/* Chart */}
      <div style={{ height: 320, overflow: "hidden" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMax meet"
          style={{
            userSelect: "none",
            touchAction: "none",
            cursor: drag ? "grabbing" : "default",
          }}
          onPointerMove={handleSVGPointerMove}
          onPointerUp={handleSVGPointerUp}
          onPointerCancel={handleSVGPointerCancel}
        >
          {/* ── Layer 1: Min bars (grey fill, no stroke) ── */}
          {visibleGradeIndices.map((gradeIdx, visCol) => {
            const c = constraints[gradeIdx];
            if (c.minCount === 0) return null;
            const h = barH(c.minCount);
            return (
              <rect
                key={`min-${c.grade}`}
                x={colCenterX(visCol) - COL_W * 0.38}
                y={CHART_BOTTOM - h}
                width={COL_W * 0.76}
                height={h}
                fill="#d1d5db"
                stroke="none"
                pointerEvents="none"
              />
            );
          })}

          {/* ── Layer 2: Max bars ──
              Non-merged: solid black outline at maxCount height.
              Merged: grey dashed outline (individual ceiling) + blue dashed rect (effective pool). */}
          {visibleGradeIndices.map((gradeIdx, visCol) => {
            const c = constraints[gradeIdx];
            const effMax = effectiveMaxCounts[gradeIdx];
            const isInMaxGroup = mergeGroups.some(
              (g) => g.field === "max" && g.grades.includes(c.grade)
            );

            const x = colCenterX(visCol) - COL_W * 0.38;
            const w = COL_W * 0.76;

            if (!isInMaxGroup) {
              return (
                <rect
                  key={`max-${c.grade}`}
                  x={x}
                  y={CHART_BOTTOM - barH(c.maxCount)}
                  width={w}
                  height={barH(c.maxCount)}
                  fill="none"
                  stroke="#111827"
                  strokeWidth={1}
                  pointerEvents="none"
                />
              );
            }

            // Merged grade: two overlapping shapes
            return (
              <g key={`max-${c.grade}`} pointerEvents="none">
                {/* Individual ceiling — light grey dashed */}
                {c.maxCount > 0 && (
                  <rect
                    x={x}
                    y={CHART_BOTTOM - barH(c.maxCount)}
                    width={w}
                    height={barH(c.maxCount)}
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                )}
                {/* Effective pool — blue dashed, shrinks as siblings fill */}
                {effMax > 0 && (
                  <rect
                    x={x}
                    y={CHART_BOTTOM - barH(effMax)}
                    width={w}
                    height={barH(effMax)}
                    fill="rgba(59,130,246,0.08)"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                  />
                )}
              </g>
            );
          })}

          {/* ── Layer 3: Column highlight during drag ── */}
          {drag && drag.currentGradeIdx !== drag.srcGradeIdx && (() => {
            const visCol = gradeToVisCol.get(drag.currentGradeIdx);
            if (visCol === undefined) return null;
            return (
              <rect
                x={colCenterX(visCol) - COL_W * 0.45}
                y={MT}
                width={COL_W * 0.9}
                height={CHART_H}
                fill="#dbeafe"
                opacity={0.4}
                pointerEvents="none"
              />
            );
          })()}

          {/* ── Layer 4: Student circles ──────────────────────────────────────
              Flat array sorted by rank — same key = same DOM node = CSS
              transitions on cx/cy fire reliably when a student changes columns.  */}
          {displayStudents
            .filter((s) => s.assignedGrade !== null)
            .sort((a, b) => a.rank - b.rank)
            .map((student) => {
              const gradeIdx = gradeScaleArr.indexOf(student.assignedGrade!);
              if (gradeIdx < 0) return null;
              const visCol = gradeToVisCol.get(gradeIdx);
              if (visCol === undefined) return null;

              const col = columnStudents[gradeIdx];
              const idxInCol = col.findIndex((s) => s.id === student.id);
              if (idxInCol < 0) return null;
              const idxFromBottom = col.length - 1 - idxInCol;

              const cx = colCenterX(visCol);
              const cy = circleY(idxFromBottom);

              const isMoving = movingIds.has(student.id);
              const isDragSrc =
                drag !== null && gradeIdx === drag.srcGradeIdx && !isMoving;
              const isHovered = hoveredId === student.id && !drag;

              const staggerDelay = isMoving ? (delayMap.get(student.id) ?? 0) : 0;

              const fillColor = isMoving ? "#60a5fa" : "#3b82f6";
              const strokeColor = isHovered ? "#1e40af" : isMoving ? "#3b82f6" : "none";
              const strokeW = isHovered ? 2 : isMoving ? 1 : 0;
              const radius = isHovered ? R_HOVER : R;
              const opacity = isDragSrc ? 0.25 : 1;

              return (
                <circle
                  key={student.id}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  opacity={opacity}
                  style={{
                    transition: [
                      `cx ${ANIM_DUR}ms ease-out ${staggerDelay}ms`,
                      `cy ${ANIM_DUR}ms ease-out ${staggerDelay}ms`,
                      `r 80ms ease-out`,
                      `opacity 120ms ease`,
                    ].join(", "),
                    cursor: drag ? "grabbing" : "grab",
                    willChange: "cx, cy",
                  }}
                  onPointerDown={(e) =>
                    handleCirclePointerDown(e, gradeIdx, idxFromBottom)
                  }
                  onMouseEnter={() => {
                    if (!drag) setHoveredId(student.id);
                  }}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Native hover tooltip; hidden mid-drag so it doesn't trail the cursor. */}
                  {!drag && <title>{`ID ${student.id} · Raw score ${student.rawScore}`}</title>}
                </circle>
              );
            })}

          {/* ── Layer 5: Y-axis ── */}
          <line
            x1={ML}
            y1={MT}
            x2={ML}
            y2={CHART_BOTTOM}
            stroke="#9ca3af"
            strokeWidth={1}
          />
          {ticks.map((count) => {
            const ty = CHART_BOTTOM - barH(count);
            if (ty < MT - 4) return null;
            return (
              <g key={count}>
                <line
                  x1={ML - 4}
                  y1={ty}
                  x2={ML}
                  y2={ty}
                  stroke="#9ca3af"
                  strokeWidth={1}
                />
                <text
                  x={ML - 6}
                  y={ty + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#6b7280"
                >
                  {count}
                </text>
              </g>
            );
          })}

          {/* ── Layer 6: X-axis grade labels (visible columns only) ── */}
          {visibleGradeIndices.map((gradeIdx, visCol) => {
            const grade = gradeScaleArr[gradeIdx];
            const active =
              drag &&
              (gradeIdx === drag.srcGradeIdx || gradeIdx === drag.currentGradeIdx);
            return (
              <text
                key={grade}
                x={colCenterX(visCol)}
                y={SVG_H - 8}
                textAnchor="middle"
                fontSize={11}
                fill={active ? "#3b82f6" : "#374151"}
                fontWeight={active ? "700" : "400"}
              >
                {grade}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
