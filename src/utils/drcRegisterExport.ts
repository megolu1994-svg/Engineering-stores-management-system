import { exportStyledExcel, type StyledExcelColumn } from "./styledExcelExport";

export interface PackageDetailItem {
  package_type?: string;
  quantity?: number | string;
  description?: string;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "-";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

function formatDateTime(val: string | null | undefined): string {
  if (!val) return "-";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(val);
  }
}

function parseNumber(val: unknown): number | string {
  if (val === null || val === undefined || val === "") return "-";
  const num = Number(val);
  return isNaN(num) ? String(val) : num;
}

const DRC_REGISTER_COLUMNS: StyledExcelColumn[] = [
  // Group 1: DRC Identification (Deep Navy #1E3A8A, tint #F1F5F9)
  { header: "S.No", headerColor: "1E3A8A", colTint: "F1F5F9", align: "center", width: 8 },
  { header: "DRC Number", headerColor: "1E3A8A", colTint: "F1F5F9", align: "center", width: 16 },
  { header: "DRC Date & Time", headerColor: "1E3A8A", colTint: "F1F5F9", align: "center", width: 20 },
  { header: "DRC Status", headerColor: "1E3A8A", colTint: "F1F5F9", align: "center", width: 18 },

  // Group 2: Vendor Details (Dark Teal #0F766E, tint #F0FDFA)
  { header: "Vendor Name", headerColor: "0F766E", colTint: "F0FDFA", align: "left", width: 34 },
  { header: "MSME Category", headerColor: "0F766E", colTint: "F0FDFA", align: "center", width: 16 },

  // Group 3: Purchase & Contract Orders (Indigo #4338CA, tint #EEF2FF)
  { header: "SAP PO No.", headerColor: "4338CA", colTint: "EEF2FF", align: "center", width: 16 },
  { header: "SAP PO Date", headerColor: "4338CA", colTint: "EEF2FF", align: "center", width: 14 },
  { header: "GeM Order No.", headerColor: "4338CA", colTint: "EEF2FF", align: "center", width: 24 },
  { header: "GeM Order Date", headerColor: "4338CA", colTint: "EEF2FF", align: "center", width: 14 },

  // Group 4: Package & Material Description (Amber #B45309, tint #FFFBEB)
  { header: "Material Description / Items", headerColor: "B45309", colTint: "FFFBEB", align: "left", width: 36 },
  { header: "Package Type", headerColor: "B45309", colTint: "FFFBEB", align: "left", width: 18 },
  { header: "Package Quantity", headerColor: "B45309", colTint: "FFFBEB", align: "right", isNumber: true, width: 16 },

  // Group 5: Dispatch & Transport (Ocean Blue #0284C7, tint #F0F9FF)
  { header: "Mode of Dispatch", headerColor: "0284C7", colTint: "F0F9FF", align: "center", width: 16 },
  { header: "Vehicle Number", headerColor: "0284C7", colTint: "F0F9FF", align: "center", width: 18 },
  { header: "Driver Name", headerColor: "0284C7", colTint: "F0F9FF", align: "left", width: 20 },
  { header: "Delivery Location", headerColor: "0284C7", colTint: "F0F9FF", align: "left", width: 22 },
  { header: "Gate Purpose", headerColor: "0284C7", colTint: "F0F9FF", align: "left", width: 24 },

  // Group 6: Commercial & Invoicing (Rose / Crimson #BE123C, tint #FFF1F2)
  { header: "Tax Invoice No.", headerColor: "BE123C", colTint: "FFF1F2", align: "left", width: 18 },
  { header: "Tax Invoice Date", headerColor: "BE123C", colTint: "FFF1F2", align: "center", width: 15 },
  { header: "Tax Invoice Value (₹)", headerColor: "BE123C", colTint: "FFF1F2", align: "right", isCurrency: true, width: 18 },
  { header: "Delivery Challan No.", headerColor: "BE123C", colTint: "FFF1F2", align: "left", width: 20 },
  { header: "Challan Date", headerColor: "BE123C", colTint: "FFF1F2", align: "center", width: 15 },
  { header: "Lorry Receipt (LR) No.", headerColor: "BE123C", colTint: "FFF1F2", align: "left", width: 20 },
  { header: "LR Date", headerColor: "BE123C", colTint: "FFF1F2", align: "center", width: 15 },
  { header: "E-Way Bill No.", headerColor: "BE123C", colTint: "FFF1F2", align: "left", width: 22 },
  { header: "E-Way Bill Date", headerColor: "BE123C", colTint: "FFF1F2", align: "center", width: 15 },

  // Group 7: Weighment & Consignment Weight (Burnt Orange #C2410C, tint #FFF7ED)
  { header: "Weighment Slip No.", headerColor: "C2410C", colTint: "FFF7ED", align: "center", width: 18 },
  { header: "Gross Weight (Kg)", headerColor: "C2410C", colTint: "FFF7ED", align: "right", isNumber: true, width: 16 },
  { header: "Tare Weight (Kg)", headerColor: "C2410C", colTint: "FFF7ED", align: "right", isNumber: true, width: 16 },
  { header: "Net Weight (Kg)", headerColor: "C2410C", colTint: "FFF7ED", align: "right", isNumber: true, width: 16 },

  // Group 8: Stores Inspection & Verification (Deep Purple #6B21A8, tint #FAF5FF)
  { header: "1st Mail for Inspection", headerColor: "6B21A8", colTint: "FAF5FF", align: "center", width: 18 },
  { header: "Inspection Status", headerColor: "6B21A8", colTint: "FAF5FF", align: "center", width: 18 },
  { header: "Inspection Date", headerColor: "6B21A8", colTint: "FAF5FF", align: "center", width: 15 },
  { header: "Inspected By", headerColor: "6B21A8", colTint: "FAF5FF", align: "left", width: 20 },
  { header: "Discrepancy / Remarks", headerColor: "6B21A8", colTint: "FAF5FF", align: "left", width: 28 },
  { header: "VIM Approval", headerColor: "6B21A8", colTint: "FAF5FF", align: "center", width: 16 },

  // Group 9: GRN & Warehouse Closeout (Forest Green #166534, tint #F0FDF4)
  { header: "SAP GRN No.", headerColor: "166534", colTint: "F0FDF4", align: "center", width: 16 },
  { header: "GRN Date", headerColor: "166534", colTint: "F0FDF4", align: "center", width: 15 },
  { header: "Important Note", headerColor: "334155", colTint: "F8FAFC", align: "left", width: 28 },
  { header: "General Remarks", headerColor: "334155", colTint: "F8FAFC", align: "left", width: 28 },
];

export function exportDrcRegisterExcel(
  records: Record<string, unknown>[],
  fyLabel: string
) {
  const rows = records.map((r, index) => {
    // Packages
    const pd = (r.package_details as PackageDetailItem[] | null) ?? [];
    const matDescriptions = pd
      .map((p) => p.description || p.package_type)
      .filter(Boolean)
      .join("; ") || "-";
    const packageTypes = pd
      .map((p) => p.package_type)
      .filter(Boolean)
      .join(", ") || (r.package_type as string) || "-";
    const totalPkgQty = pd.reduce((sum, p) => {
      const q = Number(p.quantity);
      return sum + (isNaN(q) ? 0 : q);
    }, 0);

    const s = (k: string) => ((r[k] as string) ?? "").trim() || "-";

    const invoiceVal = r.tax_invoice_value !== null && r.tax_invoice_value !== undefined && r.tax_invoice_value !== ""
      ? Number(r.tax_invoice_value)
      : "-";

    const grossW = parseNumber(r.gross_weight);
    const tareW = parseNumber(r.tare_weight);
    const netW = parseNumber(r.net_weight);

    return [
      index + 1, // S.No
      s("drc_number"),
      formatDateTime(r.receipt_datetime as string || r.created_at as string),
      s("status"),

      s("vendor_name"),
      s("msme_type"),

      s("sap_po_number") !== "-" ? s("sap_po_number") : s("po_number"),
      formatDate(r.sap_po_date as string || r.po_date as string),
      s("gem_order_number"),
      formatDate(r.gem_order_date as string),

      matDescriptions,
      packageTypes,
      totalPkgQty > 0 ? totalPkgQty : parseNumber(r.package_count),

      r.receipt_mode === "Hand" ? "BY HAND" : s("receipt_mode"),
      s("vehicle_number"),
      s("driver_name"),
      s("delivery_location"),
      s("purpose"),

      s("invoice_number"),
      formatDate(r.invoice_date as string),
      invoiceVal,
      s("challan_number"),
      formatDate(r.challan_date as string),
      s("lorry_receipt_number"),
      formatDate(r.lorry_receipt_date as string),
      s("eway_bill_number"),
      formatDate(r.eway_bill_date as string),

      s("weightment_slip_number"),
      grossW,
      tareW,
      netW,

      formatDate(r.receipt_datetime as string),
      s("inspection_status"),
      formatDate(r.inspection_date as string),
      s("inspection_by"),
      s("inspection_remarks"),
      s("vim_approval"),

      s("grn_number"),
      formatDate(r.grn_date as string),
      s("important_note"),
      s("remarks"),
    ];
  });

  // Clean filename: DRC_Register_FY_2026-27.xlsx
  const safeFy = fyLabel.split("(")[0].trim().replace(/\s+/g, "_");
  const filename = `DRC_Register_${safeFy}`;

  exportStyledExcel({
    filename,
    sheetName: "DRC Register",
    title: "ENGINEERING STORES MANAGEMENT SYSTEM — DRC REGISTER",
    subtitle: `Period: ${fyLabel}  |  Total Records: ${records.length}  |  Exported: ${new Date().toLocaleString("en-IN")}`,
    columns: DRC_REGISTER_COLUMNS,
    rows,
    autoFilter: true,
  });
}
