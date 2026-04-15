import { Student } from "@/types";

/**
 * Parse an Excel (.xlsx/.xls) or CSV file into Student[].
 * Looks for columns named id/ID/student and score/grade/Score/Grade.
 * Falls back to treating col 0 as id and col 1 as score.
 */
export async function parseExcelFile(file: File): Promise<Student[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 2) return [];

  const header = (rows[0] as unknown[]).map((h) => String(h ?? "").toLowerCase().trim());

  const idCol =
    header.findIndex((h) => ["id", "student", "studentid", "student_id", "name"].includes(h));
  const scoreCol =
    header.findIndex((h) => ["score", "grade", "points", "raw", "rawscore"].includes(h));

  // Fallback: use first two columns
  const colId = idCol >= 0 ? idCol : 0;
  const colScore = scoreCol >= 0 ? scoreCol : 1;

  const students: Student[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const id = String(row[colId] ?? "").trim();
    const raw = parseFloat(String(row[colScore] ?? ""));
    if (!id || isNaN(raw)) continue;
    students.push({ id, rawScore: raw, rank: 0, assignedGrade: null });
  }

  return rankStudents(students);
}

/** Sort by score descending and assign ranks (1 = highest). Ties get same rank. */
export function rankStudents(students: Student[]): Student[] {
  const sorted = [...students].sort((a, b) => b.rawScore - a.rawScore);
  let rank = 1;
  return sorted.map((s, i) => {
    if (i > 0 && sorted[i].rawScore < sorted[i - 1].rawScore) rank = i + 1;
    return { ...s, rank };
  });
}
