import { supabase } from "../config/supabase";
import { applyStockMovement } from "./inventoryTransactionService";
import type { PackageDetailRow, ReceiptHeader } from "./receiptService";

export interface SapMatchedLineItem {
  material_code: string;
  material_description: string;
  item_no: string;
  quantity_103: number;
  quantity_105: number;
  unit_of_entry: string;
  sap_103_doc: string | null;
  sap_103_date: string | null;
  sap_105_doc: string | null;
  sap_105_date: string | null;
  storage_location: string;
  vendor: string | null;
  invoice_number: string | null;
  purchase_order: string | null;
  status: "103_ONLY" | "105_POSTED" | "PARTIAL_105";
}

export interface DrcSapLookupResult {
  hasMatches: boolean;
  has103: boolean;
  has105: boolean;
  poNumber: string | null;
  invoiceNumber: string | null;
  vendorName: string | null;
  doc103List: string[];
  doc105List: string[];
  primary103Doc: string | null;
  primary103Date: string | null;
  primary105Doc: string | null;
  primary105Date: string | null;
  items: SapMatchedLineItem[];
  rawMovementCount: number;
}

export interface ExistingBinAllocation {
  material_code: string;
  location_code: string;
  quantity: number;
}

export interface MaterialBinAllocationInput {
  material_code: string;
  material_description: string;
  quantity: number;
  uom: string;
  location_code: string;
  item_no?: string;
  sap_103_doc?: string;
  sap_105_doc?: string;
}

export interface AllocateDrcMaterialsParams {
  receiptId: number;
  drcNumber: string;
  poNumber: string;
  invoiceNumber: string;
  vendorName: string;
  doc103?: string | null;
  doc105?: string | null;
  doc105Date?: string | null;
  operatorName: string;
  allocations: MaterialBinAllocationInput[];
  closeDrc?: boolean;
}

export interface AllocateDrcMaterialsResult {
  success: boolean;
  allocatedCount: number;
  totalQuantity: number;
  drcClosed: boolean;
  errors: string[];
  updatedReceipt: ReceiptHeader | null;
}

/**
 * Normalizes strings by trimming and stripping leading zeroes for comparison.
 */
function normalizeDocCode(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  // Strip leading zeroes for digits-only strings (e.g. "0357" -> "357")
  if (/^\d+$/.test(trimmed)) {
    return trimmed.replace(/^0+/, "") || "0";
  }
  return trimmed;
}

/**
 * Queries `sap_material_documents` (MB51 history) by PO Number and/or Invoice Number.
 * Matches 103 (GR into blocked stock) and 105 (GR release from blocked stock) records.
 */
export async function findSapDocumentsForDrc(
  poNumber?: string | null,
  invoiceNumber?: string | null
): Promise<DrcSapLookupResult> {
  const cleanPo = poNumber ? poNumber.trim() : "";
  const cleanInv = invoiceNumber ? invoiceNumber.trim() : "";

  const emptyResult: DrcSapLookupResult = {
    hasMatches: false,
    has103: false,
    has105: false,
    poNumber: cleanPo || null,
    invoiceNumber: cleanInv || null,
    vendorName: null,
    doc103List: [],
    doc105List: [],
    primary103Doc: null,
    primary103Date: null,
    primary105Doc: null,
    primary105Date: null,
    items: [],
    rawMovementCount: 0,
  };

  if (!cleanPo && !cleanInv) {
    return emptyResult;
  }

  try {
    let query = supabase.from("sap_material_documents").select("*");

    const poNorm = normalizeDocCode(cleanPo);
    const invNorm = normalizeDocCode(cleanInv);

    // Filter by relevant receipt movement types in SAP:
    // 103 (GR Blocked), 104 (103 Reversal), 105 (GR Release), 106 (105 Reversal),
    // 101 (Direct GR), 102 (101 Reversal)
    const validReceiptMovements = new Set(["103", "104", "105", "106", "101", "102"]);

    // Build targeted query conditions
    // CRITICAL FIX: If PO is provided, query by PO ONLY so we NEVER pull in
    // unrelated POs that coincidentally share a simple invoice number like "0357".
    if (cleanPo) {
      const poFilters = [`purchase_order.eq.${cleanPo}`];
      if (poNorm && poNorm !== cleanPo) {
        poFilters.push(`purchase_order.eq.${poNorm}`);
      }
      if (/^\d+$/.test(cleanPo) && cleanPo.length < 10) {
        poFilters.push(`purchase_order.eq.${cleanPo.padStart(10, "0")}`);
      }
      query = query.or(poFilters.join(","));
    } else if (cleanInv) {
      // Only when PO is not provided, query by invoice
      const invFilters = [`invoice_number.eq.${cleanInv}`];
      if (invNorm && invNorm !== cleanInv) {
        invFilters.push(`invoice_number.eq.${invNorm}`);
      }
      query = query.or(invFilters.join(","));
    }

    const { data: rawRows, error } = await query
      .order("posting_date", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.warn("Could not query sap_material_documents:", error.message);
      return emptyResult;
    }

    let rows = (rawRows ?? []).filter((r) => {
      const mvt = String(r.movement_type || "").trim();
      return validReceiptMovements.has(mvt);
    });

    if (rows.length === 0) {
      return emptyResult;
    }

    // If both PO and Invoice were provided, narrow down within the PO's records
    if (cleanPo && cleanInv && rows.length > 0) {
      const invLower = cleanInv.toLowerCase();
      const invNormLower = invNorm.toLowerCase();

      const matchingInvRows = rows.filter((r) => {
        const rowInv = String(r.invoice_number || "").trim().toLowerCase();
        const rowDocText = String(r.document_header_text || "").trim().toLowerCase();
        const rowInvNorm = normalizeDocCode(r.invoice_number).toLowerCase();
        return (
          rowInv === invLower ||
          rowInv === invNormLower ||
          rowInvNorm === invNormLower ||
          rowDocText.includes(invLower) ||
          (invNormLower.length >= 3 && rowInv.includes(invNormLower))
        );
      });

      // Only narrow down if matching invoice rows actually exist under this PO
      if (matchingInvRows.length > 0) {
        rows = matchingInvRows;
      }
    }

    // Categorize documents and movements
    // 103: GR into blocked stock
    // 104: Reversal of 103
    // 105: Release from blocked stock into unrestricted (GRN)
    // 106: Reversal of 105
    const doc103Set = new Set<string>();
    const doc105Set = new Set<string>();
    let latest103Date: string | null = null;
    let latest105Date: string | null = null;
    let foundVendor: string | null = null;

    // Group items by material_code and item number
    const itemMap = new Map<
      string,
      {
        material_code: string;
        material_description: string;
        item_no: string;
        qty103: number;
        qty105: number;
        uom: string;
        doc103: string | null;
        date103: string | null;
        doc105: string | null;
        date105: string | null;
        storage_location: string;
        vendor: string | null;
        invoice_number: string | null;
        purchase_order: string | null;
      }
    >();

    for (const r of rows) {
      const mvt = String(r.movement_type || "").trim();
      const doc = String(r.material_document || "").trim();
      const date = r.posting_date ? String(r.posting_date).slice(0, 10) : null;
      const matCode = String(r.material_code || "").trim();
      const itemNo = String(r.item || r.material_doc_item || "1").trim();
      const qty = Number(r.quantity) || 0;
      const uom = String(r.unit_of_entry || "EA").trim();
      const desc = String(r.material_description || "").trim();
      const sloc = String(r.storage_location || "").trim();
      const vendor = r.vendor ? String(r.vendor).trim() : null;
      const inv = r.invoice_number ? String(r.invoice_number).trim() : null;
      const po = r.purchase_order ? String(r.purchase_order).trim() : null;

      if (vendor && !foundVendor) {
        foundVendor = vendor;
      }

      if (mvt === "103") {
        if (doc) doc103Set.add(doc);
        if (date && (!latest103Date || date > latest103Date)) {
          latest103Date = date;
        }
      } else if (mvt === "105" || mvt === "101") {
        if (doc) doc105Set.add(doc);
        if (date && (!latest105Date || date > latest105Date)) {
          latest105Date = date;
        }
      }

      const key = `${matCode}__${itemNo}`;
      let item = itemMap.get(key);
      if (!item) {
        item = {
          material_code: matCode,
          material_description: desc,
          item_no: itemNo,
          qty103: 0,
          qty105: 0,
          uom,
          doc103: null,
          date103: null,
          doc105: null,
          date105: null,
          storage_location: sloc,
          vendor,
          invoice_number: inv,
          purchase_order: po,
        };
        itemMap.set(key, item);
      }

      if (desc && !item.material_description) {
        item.material_description = desc;
      }

      if (mvt === "103") {
        item.qty103 += qty;
        item.doc103 = doc || item.doc103;
        item.date103 = date || item.date103;
      } else if (mvt === "104") {
        // Reversal of 103
        item.qty103 -= Math.abs(qty);
      } else if (mvt === "105" || mvt === "101") {
        item.qty105 += qty;
        item.doc105 = doc || item.doc105;
        item.date105 = date || item.date105;
      } else if (mvt === "106" || mvt === "102") {
        // Reversal of 105 or 101
        item.qty105 -= Math.abs(qty);
      }
    }

    const items: SapMatchedLineItem[] = [];
    for (const item of itemMap.values()) {
      const q103 = Math.max(0, item.qty103);
      const q105 = Math.max(0, item.qty105);

      // CRITICAL FIX: Exclude line items with zero received quantity
      // (prevents cancelled movements or unrelated rows from showing as 0-quantity items)
      if (q103 === 0 && q105 === 0) {
        continue;
      }

      let status: SapMatchedLineItem["status"] = "103_ONLY";
      if (q105 > 0 && q105 >= q103) {
        status = "105_POSTED";
      } else if (q105 > 0) {
        status = "PARTIAL_105";
      }

      items.push({
        material_code: item.material_code,
        material_description: item.material_description,
        item_no: item.item_no,
        quantity_103: q103,
        quantity_105: q105,
        unit_of_entry: item.uom,
        sap_103_doc: item.doc103,
        sap_103_date: item.date103,
        sap_105_doc: item.doc105,
        sap_105_date: item.date105,
        storage_location: item.storage_location,
        vendor: item.vendor,
        invoice_number: item.invoice_number,
        purchase_order: item.purchase_order,
        status,
      });
    }

    const doc103List = Array.from(doc103Set);
    const doc105List = Array.from(doc105Set);

    return {
      hasMatches: items.length > 0,
      has103: doc103List.length > 0,
      has105: doc105List.length > 0,
      poNumber: cleanPo || null,
      invoiceNumber: cleanInv || null,
      vendorName: foundVendor,
      doc103List,
      doc105List,
      primary103Doc: doc103List[0] || null,
      primary103Date: latest103Date,
      primary105Doc: doc105List[0] || null,
      primary105Date: latest105Date,
      items,
      rawMovementCount: rows.length,
    };
  } catch (err) {
    console.error("findSapDocumentsForDrc error:", err);
    return emptyResult;
  }
}

/**
 * Fetches existing physical bin locations and current quantities for a list of material codes.
 * Helps warehouse staff see where materials are already stored when assigning bins.
 */
export async function fetchExistingAllocationsForMaterials(
  materialCodes: string[]
): Promise<ExistingBinAllocation[]> {
  if (materialCodes.length === 0) return [];

  const uniqueCodes = Array.from(new Set(materialCodes.filter((c) => !!c.trim())));
  if (uniqueCodes.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from("material_allocation")
      .select("material_code, location_code, quantity")
      .in("material_code", uniqueCodes)
      .gt("quantity", 0);

    if (error) {
      console.warn("fetchExistingAllocationsForMaterials failed:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      material_code: row.material_code,
      location_code: row.location_code,
      quantity: Number(row.quantity),
    }));
  } catch (err) {
    console.warn("fetchExistingAllocationsForMaterials exception:", err);
    return [];
  }
}

/**
 * Ensures that all materials exist in `material_master` before allocating stock.
 * Auto-creates active records if any material code is new.
 */
async function ensureMaterialsExist(
  items: { material_code: string; material_description: string; uom: string }[]
): Promise<void> {
  const codes = Array.from(new Set(items.map((i) => i.material_code.trim()))).filter(Boolean);
  if (codes.length === 0) return;

  const { data: existing, error } = await supabase
    .from("material_master")
    .select("material_code")
    .in("material_code", codes);

  if (error) {
    console.warn("Could not check material_master:", error.message);
    return;
  }

  const existingSet = new Set((existing ?? []).map((m) => m.material_code));
  const missing = items.filter((i) => !existingSet.has(i.material_code.trim()));

  if (missing.length === 0) return;

  const toInsert = missing.map((item) => ({
    material_code: item.material_code.trim(),
    short_description: item.material_description.trim() || item.material_code.trim(),
    uom: item.uom.trim() || "NOS",
    hsn_code: "",
    material_group: item.material_code.trim().slice(0, 2),
    is_active: true,
  }));

  try {
    const { error: insertErr } = await supabase.from("material_master").insert(toInsert);
    if (insertErr) {
      console.warn("ensureMaterialsExist insert error:", insertErr.message);
    }
  } catch (err) {
    console.warn("ensureMaterialsExist exception:", err);
  }
}

/**
 * Allocates received materials directly into physical bin locations from the DRC interface.
 * Updates `material_allocation`, creates audit trail in `inventory_transactions`,
 * updates DRC package_details with allocated bins, and closes the DRC if requested.
 */
export async function allocateDrcMaterialsToBins(
  params: AllocateDrcMaterialsParams
): Promise<AllocateDrcMaterialsResult> {
  const {
    receiptId,
    drcNumber,
    poNumber,
    invoiceNumber,
    vendorName,
    doc103,
    doc105,
    doc105Date,
    operatorName,
    allocations,
    closeDrc = true,
  } = params;

  const result: AllocateDrcMaterialsResult = {
    success: false,
    allocatedCount: 0,
    totalQuantity: 0,
    drcClosed: false,
    errors: [],
    updatedReceipt: null,
  };

  const validAllocations = allocations.filter(
    (a) => a.material_code.trim() && a.location_code.trim() && a.quantity > 0
  );

  if (validAllocations.length === 0) {
    result.errors.push("No valid materials and bin locations provided for allocation.");
    return result;
  }

  // 1. Ensure all materials exist in material_master
  await ensureMaterialsExist(validAllocations);

  // 2. Fetch current allocations for target locations
  const targetCodes = validAllocations.map((a) => a.material_code.trim());
  const targetLocations = validAllocations.map((a) => a.location_code.trim());

  const { data: existingAllocs, error: fetchAllocsError } = await supabase
    .from("material_allocation")
    .select("id, material_code, location_code, quantity")
    .in("material_code", targetCodes)
    .in("location_code", targetLocations);

  if (fetchAllocsError) {
    console.warn("Could not fetch target material_allocation:", fetchAllocsError.message);
  }

  const allocMap = new Map<string, { id: number; quantity: number }>();
  for (const row of existingAllocs ?? []) {
    allocMap.set(`${row.material_code}__${row.location_code}`, {
      id: row.id,
      quantity: Number(row.quantity),
    });
  }

  // 3. Apply stock movement for each item
  const allocatedDetailsMap = new Map<
    string,
    { location_code: string; allocated_qty: number }
  >();

  for (const item of validAllocations) {
    const matCode = item.material_code.trim();
    const locCode = item.location_code.trim();
    const qty = Number(item.quantity);

    try {
      const existing = allocMap.get(`${matCode}__${locCode}`);
      const prevQty = existing ? existing.quantity : 0;
      const newQty = prevQty + qty;

      const remarks = `DRC: ${drcNumber} | PO: ${poNumber || "-"} | Inv: ${
        invoiceNumber || "-"
      } | 103 Doc: ${doc103 || "-"} | 105 GRN: ${doc105 || "-"} | Vendor: ${
        vendorName || "-"
      }`;

      await applyStockMovement({
        materialCode: matCode,
        locationCode: locCode,
        prevQuantity: prevQty,
        newQuantity: newQty,
        allocationId: existing?.id,
        transactionType: "MATERIAL_RECEIPT",
        referenceType: "DRC_105_ALLOCATION",
        referenceNumber: drcNumber,
        reason: "105 Goods Receipt & Bin Allocation",
        remarks,
        createdBy: operatorName,
      });

      // Update local map in case same material is allocated again
      allocMap.set(`${matCode}__${locCode}`, {
        id: existing?.id ?? -1,
        quantity: newQty,
      });

      allocatedDetailsMap.set(matCode, {
        location_code: locCode,
        allocated_qty: qty,
      });

      result.allocatedCount += 1;
      result.totalQuantity += qty;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed allocating ${matCode} to ${locCode}: ${errMsg}`);
    }
  }

  if (result.allocatedCount === 0) {
    return result;
  }

  // 4. Fetch the existing DRC header to update package_details and status
  const { data: currentReceipt, error: fetchDrcError } = await supabase
    .from("receipt_header")
    .select("*")
    .eq("id", receiptId)
    .single();

  if (fetchDrcError || !currentReceipt) {
    result.errors.push("Failed to reload DRC record after allocation.");
    return result;
  }

  const nowIso = new Date().toISOString();
  const currentPackageDetails: PackageDetailRow[] =
    currentReceipt.package_details || [];

  // Update or append allocated lines in package_details
  const updatedPackageDetails: PackageDetailRow[] = currentPackageDetails.map(
    (pkg) => {
      const matCode = pkg.material_code?.trim() || "";
      const allocInfo = matCode ? allocatedDetailsMap.get(matCode) : undefined;
      if (allocInfo) {
        return {
          ...pkg,
          bin_location: allocInfo.location_code,
          bin_allocated: true,
          allocated_qty: allocInfo.allocated_qty,
          allocated_at: nowIso,
          allocated_by: operatorName,
          sap_103_doc: doc103 || pkg.sap_103_doc,
          sap_105_doc: doc105 || pkg.sap_105_doc,
        };
      }
      return pkg;
    }
  );

  // If there are valid allocations that weren't already represented in package_details, add them
  for (const item of validAllocations) {
    const exists = updatedPackageDetails.some(
      (p) => p.material_code?.trim() === item.material_code.trim()
    );
    if (!exists) {
      updatedPackageDetails.push({
        quantity: String(item.quantity),
        package_type: item.uom || "NOS",
        description: item.material_description || item.material_code,
        material_code: item.material_code.trim(),
        uom: item.uom || "NOS",
        item_no: item.item_no || "1",
        sap_103_doc: doc103 || undefined,
        sap_105_doc: doc105 || undefined,
        bin_location: item.location_code.trim(),
        bin_allocated: true,
        allocated_qty: item.quantity,
        allocated_at: nowIso,
        allocated_by: operatorName,
      });
    }
  }

  // 5. Update DRC header
  const updatePayload: Record<string, unknown> = {
    package_details: updatedPackageDetails,
    updated_at: nowIso,
  };

  if (doc105) {
    updatePayload.grn_number = doc105;
  }
  if (doc105Date) {
    updatePayload.grn_date = doc105Date;
  }

  if (closeDrc) {
    updatePayload.status = "Closed";
    updatePayload.closed_date = nowIso;
    updatePayload.closed_by = operatorName;
    result.drcClosed = true;
  }

  // Attempt to save to receipt_header including migration 0024 columns if available
  const extendedPayload: Record<string, unknown> = {
    ...updatePayload,
    sap_103_doc: doc103 || null,
    sap_105_doc: doc105 || null,
    sap_105_date: doc105Date || null,
    sap_items: updatedPackageDetails,
  };

  let updateRes = await supabase
    .from("receipt_header")
    .update(extendedPayload)
    .eq("id", receiptId)
    .select()
    .single();

  if (updateRes.error) {
    // Fallback: If 0024 migration columns are not yet applied, update without them
    console.warn(
      "Extended DRC update failed, falling back to core columns:",
      updateRes.error.message
    );
    updateRes = await supabase
      .from("receipt_header")
      .update(updatePayload)
      .eq("id", receiptId)
      .select()
      .single();
  }

  if (updateRes.error) {
    result.errors.push(`Could not update DRC header: ${updateRes.error.message}`);
  } else {
    result.updatedReceipt = updateRes.data as ReceiptHeader;
  }

  result.success = result.allocatedCount > 0;
  return result;
}

/**
 * Converts SAP 103 matched line items into PackageDetailRow[] format for DRC creation/editing.
 */
export function convertSapItemsToPackageDetails(
  items: SapMatchedLineItem[]
): PackageDetailRow[] {
  return items.map((item) => ({
    quantity: String(item.quantity_103 || item.quantity_105 || 1),
    package_type: item.unit_of_entry || "NOS",
    description: item.material_description || `Material ${item.material_code}`,
    material_code: item.material_code,
    uom: item.unit_of_entry || "NOS",
    item_no: item.item_no,
    sap_103_doc: item.sap_103_doc || undefined,
    sap_103_date: item.sap_103_date || undefined,
    sap_105_doc: item.sap_105_doc || undefined,
    sap_105_date: item.sap_105_date || undefined,
    storage_location: item.storage_location || undefined,
    bin_allocated: false,
  }));
}
