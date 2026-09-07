import * as XLSX from "xlsx-js-style";

export interface StyledExcelColumn {
  header: string;
  headerColor?: string; // 6-char hex, e.g. "1E3A8A"
  headerTextColor?: string; // default "FFFFFF"
  colTint?: string; // soft pastel hex, e.g. "F8FAFC"
  width?: number; // character width
  align?: "left" | "center" | "right";
  isNumber?: boolean;
  isCurrency?: boolean;
}

export interface ExportStyledExcelOptions {
  sheetName?: string;
  filename: string;
  title?: string;
  subtitle?: string;
  columns: StyledExcelColumn[];
  rows: (string | number | null | undefined)[][];
  autoFilter?: boolean;
}

export interface ExportStyledTemplateOptions {
  filename: string;
  sheetName?: string;
  title?: string;
  instructions?: string[];
  columns: {
    header: string;
    description?: string;
    required?: boolean;
    sampleValue?: string | number;
    headerColor?: string;
    width?: number;
    align?: "left" | "center" | "right";
  }[];
  sampleRows?: (string | number | null | undefined)[][];
}

/** Pre-designed harmonious theme palettes for column groups */
export const EXCEL_PALETTES = {
  navy: { header: "1E3A8A", tint: "F1F5F9" },
  blue: { header: "0284C7", tint: "F0F9FF" },
  teal: { header: "0F766E", tint: "F0FDFA" },
  emerald: { header: "059669", tint: "ECFDF5" },
  green: { header: "166534", tint: "F0FDF4" },
  amber: { header: "B45309", tint: "FFFBEB" },
  orange: { header: "C2410C", tint: "FFF7ED" },
  rose: { header: "BE123C", tint: "FFF1F2" },
  purple: { header: "6B21A8", tint: "FAF5FF" },
  indigo: { header: "4338CA", tint: "EEF2FF" },
  slate: { header: "334155", tint: "F8FAFC" },
};

/**
 * Robustly sanitizes filenames by stripping illegal filesystem characters
 * (/ \ : * ? " < > |) to ensure error-free downloads across all operating systems and browsers.
 */
export function sanitizeExcelFilename(rawName: string): string {
  let clean = rawName
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();

  if (!clean) clean = "Export";
  if (!clean.toLowerCase().endsWith(".xlsx")) {
    clean += ".xlsx";
  }
  return clean;
}

/**
 * Downloads a styled Excel workbook with support for custom column colors,
 * fonts, borders, alignments, and auto-filters.
 */
export function exportStyledExcel(options: ExportStyledExcelOptions) {
  const {
    sheetName = "Sheet1",
    filename,
    title,
    subtitle,
    columns,
    rows,
    autoFilter = true,
  } = options;

  const aoa: (string | number | null | undefined)[][] = [];

  let headerRowIndex = 0;

  // Add optional banner
  if (title) {
    aoa.push([title]);
    if (subtitle) {
      aoa.push([subtitle]);
    } else {
      aoa.push([`Generated on: ${new Date().toLocaleString()}`]);
    }
    aoa.push([]); // blank row
    headerRowIndex = aoa.length;
  }

  // Header row
  const headers = columns.map((col) => col.header);
  aoa.push(headers);

  // Data rows
  for (const row of rows) {
    aoa.push(row.map((val) => (val === null || val === undefined ? "" : val)));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Calculate or assign column widths
  ws["!cols"] = columns.map((col, cIdx) => {
    if (col.width) return { wch: col.width };
    // Auto-fit estimation
    let maxLen = col.header.length;
    for (const r of rows) {
      const val = r[cIdx];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
  });

  // Style Title Banner if present
  if (title) {
    const titleCell = ws["A1"];
    if (titleCell) {
      titleCell.s = {
        font: { name: "Calibri", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0F172A" }, patternType: "solid" },
        alignment: { horizontal: "left", vertical: "center", indent: 1 },
      };
    }
    const subCell = ws["A2"];
    if (subCell) {
      subCell.s = {
        font: { name: "Calibri", sz: 9.5, italic: true, color: { rgb: "E2E8F0" } },
        fill: { fgColor: { rgb: "1E293B" }, patternType: "solid" },
        alignment: { horizontal: "left", vertical: "center", indent: 1 },
      };
    }
  }

  // Thin border definition
  const thinBorder = {
    top: { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left: { style: "thin", color: { rgb: "CBD5E1" } },
    right: { style: "thin", color: { rgb: "CBD5E1" } },
  };

  const headerBorder = {
    top: { style: "thin", color: { rgb: "475569" } },
    bottom: { style: "medium", color: { rgb: "0F172A" } },
    left: { style: "thin", color: { rgb: "475569" } },
    right: { style: "thin", color: { rgb: "475569" } },
  };

  // Style Header Row
  columns.forEach((col, cIdx) => {
    const addr = XLSX.utils.encode_cell({ r: headerRowIndex, c: cIdx });
    const cell = ws[addr];
    if (cell) {
      const headerBg = col.headerColor || "1E3A8A";
      const headerText = col.headerTextColor || "FFFFFF";
      cell.s = {
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: headerText } },
        fill: { fgColor: { rgb: headerBg }, patternType: "solid" },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: headerBorder,
      };
    }
  });

  // Style Data Rows
  const startDataRow = headerRowIndex + 1;
  const endDataRow = startDataRow + rows.length - 1;

  for (let r = startDataRow; r <= endDataRow; r++) {
    const isEven = (r - startDataRow) % 2 === 0;

    columns.forEach((col, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell) {
        let align: "left" | "center" | "right" = col.align || "left";
        if (col.isNumber || col.isCurrency) {
          align = "right";
        }

        // Column tint or alternating striping
        let bgColor = isEven ? "FFFFFF" : "F8FAFC";
        if (col.colTint) {
          bgColor = isEven ? col.colTint : lightenColor(col.colTint);
        }

        cell.s = {
          font: { name: "Calibri", sz: 10, color: { rgb: "0F172A" } },
          fill: { fgColor: { rgb: bgColor }, patternType: "solid" },
          alignment: { horizontal: align, vertical: "center", wrapText: false },
          border: thinBorder,
        };

        // Format currency
        if (col.isCurrency && typeof cell.v === "number") {
          cell.z = "₹#,##0.00";
        } else if (col.isNumber && typeof cell.v === "number") {
          cell.z = "#,##0";
        }
      }
    });
  }

  // Auto-filter
  if (autoFilter && rows.length > 0) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRowIndex, c: 0 },
        e: { r: endDataRow, c: columns.length - 1 },
      }),
    };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // Excel max sheet name is 31 chars

  saveWorkbookFile(wb, filename);
}

/**
 * Creates an attractive, color-coded Excel bulk template with distinct column colors,
 * clean typography, borders, and sample rows.
 * Headers are on Row 1 (index 0) so the uploaded file can be parsed directly by SheetJS.
 */
export function exportStyledTemplate(options: ExportStyledTemplateOptions) {
  const {
    filename,
    sheetName = "Template",
    columns,
    sampleRows,
  } = options;

  const aoa: (string | number | null | undefined)[][] = [];

  // Row 0: Headers (must be exact names so sheet_to_json parses them properly)
  const headers = columns.map((col) => col.header);
  aoa.push(headers);

  // Rows 1+: Sample data
  const dataRows =
    sampleRows && sampleRows.length > 0
      ? sampleRows
      : [columns.map((c) => c.sampleValue ?? "")];

  for (const row of dataRows) {
    aoa.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws["!cols"] = columns.map((col, idx) => {
    if (col.width) return { wch: col.width };
    let max = col.header.length + 4;
    for (const r of dataRows) {
      if (r[idx] !== undefined && r[idx] !== null) {
        max = Math.max(max, String(r[idx]).length + 4);
      }
    }
    return { wch: Math.min(Math.max(max, 18), 45) };
  });

  const templateHeaderBorder = {
    top: { style: "thin", color: { rgb: "0F172A" } },
    bottom: { style: "medium", color: { rgb: "0F172A" } },
    left: { style: "thin", color: { rgb: "475569" } },
    right: { style: "thin", color: { rgb: "475569" } },
  };

  const sampleBorders = {
    top: { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left: { style: "thin", color: { rgb: "CBD5E1" } },
    right: { style: "thin", color: { rgb: "CBD5E1" } },
  };

  // Distinct vibrant column palette for bulk templates
  const defaultColors = [
    "1E3A8A", // Deep Navy (Primary Key / Identifier)
    "0F766E", // Teal (Description / Details)
    "0284C7", // Ocean Blue (Classification / UoM)
    "B45309", // Amber (Code / HSN)
    "6B21A8", // Purple (Quantity / Allocation)
    "334155", // Slate (Location / Remarks)
    "166534", // Forest Green (Status / Category)
  ];

  // Style Header Row (row 0)
  columns.forEach((col, cIdx) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: cIdx });
    const cell = ws[addr];
    if (cell) {
      const color =
        col.headerColor ||
        (col.required ? "1E3A8A" : defaultColors[cIdx % defaultColors.length]);
      cell.s = {
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: color }, patternType: "solid" },
        alignment: { horizontal: col.align || "center", vertical: "center", wrapText: true },
        border: templateHeaderBorder,
      };
    }
  });

  // Sample data rows styling
  for (let r = 1; r <= dataRows.length; r++) {
    const isEven = (r - 1) % 2 === 0;
    columns.forEach((col, cIdx) => {
      const addr = XLSX.utils.encode_cell({ r, c: cIdx });
      const cell = ws[addr];
      if (cell) {
        cell.s = {
          font: { name: "Calibri", sz: 10.5, italic: true, color: { rgb: "334155" } },
          fill: { fgColor: { rgb: isEven ? "FFFFFF" : "F8FAFC" }, patternType: "solid" },
          alignment: { horizontal: col.align || "left", vertical: "center" },
          border: sampleBorders,
        };
      }
    });
  }

  // Auto-filter on header
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: dataRows.length, c: columns.length - 1 },
    }),
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  saveWorkbookFile(wb, filename);
}

/** Helper to download file safely */
function saveWorkbookFile(wb: XLSX.WorkBook, rawFilename: string) {
  const safeFilename = sanitizeExcelFilename(rawFilename);

  try {
    XLSX.writeFile(wb, safeFilename);
  } catch (err) {
    console.warn("XLSX.writeFile threw error, executing Blob fallback:", err);
    try {
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (fallbackErr) {
      console.error("Blob fallback also failed:", fallbackErr);
    }
  }
}

/** Slightly lightens a hex color for alternating table rows */
function lightenColor(hex: string): string {
  if (hex === "FFFFFF") return "F8FAFC";
  return hex;
}
