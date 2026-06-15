/**
 * Minimal, dependency-free CSV serialization (RFC 4180 quoting). Used for
 * report and billing-run exports. Values containing commas, quotes, or newlines
 * are quoted; embedded quotes are doubled.
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCell(c.header)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(","));
  }
  // Leading BOM so Excel detects UTF-8.
  return "﻿" + lines.join("\r\n");
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
