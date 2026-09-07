import XLSX from "xlsx-js-style";

/** Outcome of a single row after a bulk import ran. "Rejected" is for rows
 *  that never reached the database (failed file/lookup validation);
 *  "Failed" is for rows that were sent for import but the write itself
 *  failed; "Partial" is for rows where only part of the request could be
 *  applied (e.g. bulk allocate running out of unallocated balance). */
export type BulkImportRowStatus =
  | "Imported"
  | "Updated"
  | "Applied"
  | "Partial"
  | "Rejected"
  | "Failed";

export interface BulkImportReportRow {
  rowNumber: number;
  status: BulkImportRowStatus;
  reason?: string;
  data: Record<string, string | number>;
}

export interface BulkImportReportColumn {
  header: string;
  key: string;
}

export interface BulkImportSummaryStat {
  label: string;
  value: string | number;
}

export interface BulkImportReportOptions {
  /** Used as the downloaded file's name prefix, e.g. "Material_Import". */
  fileNamePrefix: string;
  /** Per-row data columns, in display order. `key` must match a key in
   *  each row's `data` object. */
  columns: BulkImportReportColumn[];
  rows: BulkImportReportRow[];
  summary: BulkImportSummaryStat[];
}

/**
 * Builds and immediately downloads a two-sheet Excel workbook reporting the
 * outcome of a bulk import: a "Summary" sheet with aggregate counts, and an
 * "Import Result" sheet listing every row that was submitted along with its
 * outcome (Imported/Updated/Applied/Partial/Rejected/Failed) and, for
 * anything other than a clean success, the reason. Every bulk import
 * feature in the app calls this right after the import finishes so the
 * user always ends up with a downloadable record of exactly what happened
 * to each row - including rows rejected before the import even ran.
 */
export function downloadBulkImportReport(options: BulkImportReportOptions): void {
  const { fileNamePrefix, columns, rows, summary } = options;

  const workbook = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Metric", "Value"],
    ...summary.map((stat) => [stat.label, stat.value]),
  ]);
  summarySheet["!cols"] = [{ wch: 32 }, { wch: 20 }];
  
  // Style summary header
  ["A1", "B1"].forEach((cellAddr) => {
    if (summarySheet[cellAddr]) {
      summarySheet[cellAddr].s = {
        fill: { fgColor: { rgb: "1E3A8A" } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        alignment: { horizontal: "left", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "medium", color: { rgb: "475569" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      };
    }
  });

  // Style summary data
  summary.forEach((_, rIdx) => {
    ["A", "B"].forEach((col) => {
      const cellAddr = `${col}${rIdx + 2}`;
      if (summarySheet[cellAddr]) {
        summarySheet[cellAddr].s = {
          fill: { fgColor: { rgb: rIdx % 2 === 0 ? "FFFFFF" : "F8FAFC" } },
          font: col === "B" ? { bold: true, sz: 10 } : { sz: 10 },
          alignment: { horizontal: col === "B" ? "right" : "left", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } },
          },
        };
      }
    });
  });

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // 2. Import Result Sheet
  const headers = [
    "Row Number",
    ...columns.map((c) => c.header),
    "Status",
    "Reason",
  ];

  const headerColors = [
    "1E3A8A", // Row Number
    ...columns.map((_, i) => ["0F766E", "0284C7", "B45309", "4338CA"][i % 4]),
    "166534", // Status
    "991B1B", // Reason
  ];

  const sortedRows = [...rows].sort((a, b) => a.rowNumber - b.rowNumber);

  const resultBody = sortedRows.map((row) => [
    row.rowNumber,
    ...columns.map((c) => row.data[c.key] ?? ""),
    row.status,
    row.reason ?? "",
  ]);

  const resultSheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...resultBody,
  ]);

  resultSheet["!cols"] = [
    { wch: 14 },
    ...columns.map(() => ({ wch: 22 })),
    { wch: 16 },
    { wch: 35 },
  ];

  // Style Result header row
  headers.forEach((_, idx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: idx });
    if (resultSheet[cellAddr]) {
      resultSheet[cellAddr].s = {
        fill: { fgColor: { rgb: headerColors[idx] || "1E3A8A" } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        alignment: { horizontal: idx === 0 ? "center" : "left", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "medium", color: { rgb: "475569" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      };
    }
  });

  // Style Result data rows
  const statusColIdx = headers.indexOf("Status");
  resultBody.forEach((row, rIdx) => {
    const isEven = rIdx % 2 === 0;
    const status = String(row[statusColIdx]);
    const isError = status === "Rejected" || status === "Failed";
    const isPartial = status === "Partial";

    row.forEach((_, cIdx) => {
      const cellAddr = XLSX.utils.encode_cell({ r: rIdx + 1, c: cIdx });
      if (resultSheet[cellAddr]) {
        let cellBg = isEven ? "FFFFFF" : "F8FAFC";
        if (cIdx === statusColIdx) {
          cellBg = isError ? "FEE2E2" : isPartial ? "FEF3C7" : "DCFCE7";
        }
        resultSheet[cellAddr].s = {
          fill: { fgColor: { rgb: cellBg } },
          font: cIdx === statusColIdx ? {
            bold: true,
            color: { rgb: isError ? "991B1B" : isPartial ? "92400E" : "166534" },
            sz: 10,
          } : { sz: 10 },
          alignment: {
            horizontal: cIdx === 0 ? "center" : cIdx === statusColIdx ? "center" : "left",
            vertical: "center",
          },
          border: {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } },
          },
        };
      }
    });
  });

  resultSheet["!autofilter"] = {
    ref: `A1:${XLSX.utils.encode_cell({ r: resultBody.length, c: headers.length - 1 })}`,
  };

  XLSX.utils.book_append_sheet(workbook, resultSheet, "Import Result");

  const timestamp = new Date()
    .toISOString()
    .replace("T", "_")
    .replace(/:/g, "-")
    .slice(0, 19);

  XLSX.writeFile(workbook, `${fileNamePrefix}_Result_${timestamp}.xlsx`);
}
