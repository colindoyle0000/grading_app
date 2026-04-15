"use client";

import { useRef, useState } from "react";
import { Student } from "@/types";
import { parseExcelFile, rankStudents } from "@/lib/excelParser";
import { Button } from "@/components/ui/button";

interface Props {
  onStudentsChange: (students: Student[]) => void;
}

type InputMode = "upload" | "manual";

interface ManualRow {
  id: string;
  score: string;
}

function makeRow(): ManualRow {
  return { id: "", score: "" };
}

export function StudentInput({ onStudentsChange }: Props) {
  const [mode, setMode] = useState<InputMode>("upload");
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ManualRow[]>([makeRow(), makeRow(), makeRow()]);

  async function handleFile(file: File) {
    setUploadError(null);
    try {
      const students = await parseExcelFile(file);
      if (students.length === 0) {
        setUploadError("No valid rows found. Ensure the file has ID and score columns.");
        return;
      }
      setUploadName(`${file.name} (${students.length} students)`);
      onStudentsChange(students);
    } catch {
      setUploadError("Could not parse file. Please use .xlsx, .xls, or .csv.");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleManualApply() {
    const valid = rows
      .filter((r) => r.id.trim() && !isNaN(parseFloat(r.score)))
      .map((r) => ({
        id: r.id.trim(),
        rawScore: parseFloat(r.score),
        rank: 0,
        assignedGrade: null,
      }));
    if (valid.length === 0) return;
    onStudentsChange(rankStudents(valid));
  }

  function updateRow(i: number, field: keyof ManualRow, val: string) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: val } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex rounded-md border overflow-hidden text-sm">
        {(["upload", "manual"] as InputMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 px-3 py-1.5 capitalize transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {m === "upload" ? "Upload File" : "Manual Entry"}
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-muted-foreground text-center">
            {uploadName ?? "Drag & drop .xlsx / .xls / .csv\nor click to browse"}
          </p>
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div className="flex flex-col gap-2">
          <div className="overflow-auto max-h-60">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="py-1 text-left font-medium">#</th>
                  <th className="py-1 text-left font-medium">Student ID</th>
                  <th className="py-1 text-left font-medium">Score</th>
                  <th className="py-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-muted/30">
                    <td className="py-0.5 text-muted-foreground text-xs pr-1">{i + 1}</td>
                    <td className="py-0.5 pr-1">
                      <input
                        value={row.id}
                        onChange={(e) => updateRow(i, "id", e.target.value)}
                        placeholder="ID or name"
                        className="w-full border border-input rounded px-1.5 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="py-0.5 pr-1">
                      <input
                        type="number"
                        value={row.score}
                        onChange={(e) => updateRow(i, "score", e.target.value)}
                        placeholder="0–100"
                        className="w-full border border-input rounded px-1.5 py-0.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="py-0.5">
                      <button
                        onClick={() => removeRow(i)}
                        className="text-muted-foreground hover:text-destructive text-xs px-1"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow} className="text-xs">
              + Add Row
            </Button>
            <Button size="sm" onClick={handleManualApply} className="text-xs">
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
