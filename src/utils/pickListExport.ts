import XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { BulkMaterialSearchRow } from "../services/bulkMaterialSearchService";

export interface PickListExportRow {
  material_code: string;
  short_description: string;
  uom: string;
  location_code: string;
  quantity: number;
}

/** Location sentinel for "no stock anywhere". */
const NO_STOCK_LOCATION = "\u2014";

/**
 * Flattens bulk results into one row per material+location pair so the
 * storekeeper can collect material by walking locations. Materials with no
 * stock at all get a single row with quantity 0. Rows are sorted by
 * location, then material code, with the no-stock rows at the end.
 */
export function buildPickListRows(
  rows: BulkMaterialSearchRow[]
): PickListExportRow[] {
  const out: PickListExportRow[] = [];

  for (const row of rows) {
    const entries = [
      ...row.locations.map((l) => ({
        location_code: l.location_code,
        quantity: l.quantity,
      })),
      ...(row.unallocatedQty > 0
        ? [{ location_code: "UNALLOCATED", quantity: row.unallocatedQty }]
        : []),
    ];

    if (entries.length === 0) {
      out.push({
        material_code: row.material_code,
        short_description: row.short_description,
        uom: row.uom,
        location_code: NO_STOCK_LOCATION,
        quantity: 0,
      });
    } else {
      for (const entry of entries) {
        out.push({
          material_code: row.material_code,
          short_description: row.short_description,
          uom: row.uom,
          location_code: entry.location_code,
          quantity: entry.quantity,
        });
      }
    }
  }

  out.sort(
    (a, b) =>
      (a.location_code === NO_STOCK_LOCATION ? 1 : 0) -
        (b.location_code === NO_STOCK_LOCATION ? 1 : 0) ||
      a.location_code.localeCompare(b.location_code) ||
      a.material_code.localeCompare(b.material_code)
  );

  return out;
}

const PICK_LIST_HEADERS = [
  "Material Code",
  "Short Description",
  "UoM",
  "Location Code",
  "Quantity",
];

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace("T", "_")
    .replace(/:/g, "-")
    .slice(0, 19);
}

export function pickListFilename(prefix: string): string {
  return `${prefix}_${timestamp()}`;
}

export function exportPickListExcel(
  rows: BulkMaterialSearchRow[],
  notFound: string[],
  filename: string
): void {
  const pickRows = buildPickListRows(rows);
  const workbook = XLSX.utils.book_new();

  const pickColStyles = [
    { header: "Material Code", color: "1E3A8A", wch: 18, align: "left" },
    { header: "Short Description", color: "0F766E", wch: 45, align: "left" },
    { header: "UoM", color: "0284C7", wch: 10, align: "center" },
    { header: "Location Code", color: "4338CA", wch: 20, align: "left" },
    { header: "Quantity", color: "166534", wch: 14, align: "right" },
  ];

  const pickBody = pickRows.map((r) => [
    r.material_code,
    r.short_description,
    r.uom,
    r.location_code,
    r.quantity,
  ]);

  const pickSheet = XLSX.utils.aoa_to_sheet([
    pickColStyles.map((c) => c.header),
    ...pickBody,
  ]);

  pickSheet["!cols"] = pickColStyles.map((c) => ({ wch: c.wch }));

  // Style Pick List header row
  pickColStyles.forEach((c, idx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: idx });
    if (pickSheet[cellAddr]) {
      pickSheet[cellAddr].s = {
        fill: { fgColor: { rgb: c.color } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        alignment: { horizontal: c.align === "right" ? "right" : c.align === "center" ? "center" : "left", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "medium", color: { rgb: "475569" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      };
    }
  });

  // Style Pick List data rows
  pickBody.forEach((row, rIdx) => {
    const isEven = rIdx % 2 === 0;
    row.forEach((_, cIdx) => {
      const cellAddr = XLSX.utils.encode_cell({ r: rIdx + 1, c: cIdx });
      if (pickSheet[cellAddr]) {
        pickSheet[cellAddr].s = {
          fill: { fgColor: { rgb: isEven ? "FFFFFF" : "F8FAFC" } },
          alignment: {
            horizontal: pickColStyles[cIdx].align,
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

  // Auto filter
  pickSheet["!autofilter"] = {
    ref: `A1:${XLSX.utils.encode_cell({ r: pickBody.length, c: pickColStyles.length - 1 })}`,
  };

  XLSX.utils.book_append_sheet(workbook, pickSheet, "Pick List");

  if (notFound.length > 0) {
    const notFoundSheet = XLSX.utils.aoa_to_sheet([
      ["Material Code"],
      ...notFound.map((code) => [code]),
    ]);
    notFoundSheet["!cols"] = [{ wch: 22 }];
    const headerCell = notFoundSheet["A1"];
    if (headerCell) {
      headerCell.s = {
        fill: { fgColor: { rgb: "991B1B" } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        alignment: { horizontal: "left", vertical: "center" },
      };
    }
    notFound.forEach((_, rIdx) => {
      const cellAddr = XLSX.utils.encode_cell({ r: rIdx + 1, c: 0 });
      if (notFoundSheet[cellAddr]) {
        notFoundSheet[cellAddr].s = {
          fill: { fgColor: { rgb: "FEF2F2" } },
          border: {
            top: { style: "thin", color: { rgb: "FECACA" } },
            bottom: { style: "thin", color: { rgb: "FECACA" } },
            left: { style: "thin", color: { rgb: "FECACA" } },
            right: { style: "thin", color: { rgb: "FECACA" } },
          },
        };
      }
    });
    XLSX.utils.book_append_sheet(workbook, notFoundSheet, "Not Found");
  }

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportPickListPdf(
  rows: BulkMaterialSearchRow[],
  notFound: string[],
  filename: string
): void {
  const pickRows = buildPickListRows(rows);

  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Bulk Material Search - Pick List", 14, 15);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);

  autoTable(doc, {
    head: [PICK_LIST_HEADERS],
    body: pickRows.map((r) => [
      r.material_code,
      r.short_description,
      r.uom,
      r.location_code,
      String(r.quantity),
    ]),
    startY: 26,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [91, 33, 182], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 243, 255] },
  });

  if (notFound.length > 0) {
    const finalY =
      (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY ?? 250;
    doc.setFontSize(9);
    doc.text(
      `Not found (${notFound.length}): ${notFound.join(", ")}`,
      14,
      finalY + 8
    );
  }

  doc.save(`${filename}.pdf`);
}
