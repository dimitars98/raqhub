// Spreadsheet (CSV) files that open cleanly in Excel, Numbers and Google Sheets.

type Cell = string | number | null | undefined;

/**
 * One CSV cell. Text that starts with = + - @ is prefixed with ' so a
 * spreadsheet shows it as text instead of running it as a formula.
 */
function cell(value: Cell) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A whole CSV file. Starts with a byte-order mark so Excel reads Cyrillic and
 * accented letters correctly.
 */
export function toCsv(header: string[], rows: Cell[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
