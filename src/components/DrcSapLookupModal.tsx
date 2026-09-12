import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Checkbox,
  Chip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import SyncIcon from "@mui/icons-material/Sync";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import {
  findSapDocumentsForDrc,
  type DrcSapLookupResult,
  type SapMatchedLineItem,
} from "../services/drcSapSyncService";
import type { ReceiptHeader } from "../services/receiptService";

interface DrcSapLookupModalProps {
  open: boolean;
  onClose: () => void;
  initialPo: string;
  initialInvoice: string;
  targetReceipt?: ReceiptHeader | null;
  onApplyToForm?: (
    items: SapMatchedLineItem[],
    meta: {
      vendor?: string;
      poDate?: string;
      po?: string;
      invoice?: string;
      doc103?: string;
      doc105?: string;
    }
  ) => void;
  onApplyToReceipt?: (
    receipt: ReceiptHeader,
    items: SapMatchedLineItem[],
    lookupResult: DrcSapLookupResult
  ) => Promise<void>;
}

export const DrcSapLookupModal: React.FC<DrcSapLookupModalProps> = ({
  open,
  onClose,
  initialPo,
  initialInvoice,
  targetReceipt,
  onApplyToForm,
  onApplyToReceipt,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [poQuery, setPoQuery] = useState(initialPo || "");
  const [invoiceQuery, setInvoiceQuery] = useState(initialInvoice || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DrcSapLookupResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync inputs when modal opens or initial values change
  useEffect(() => {
    if (open) {
      const po = initialPo || targetReceipt?.sap_po_number || "";
      const inv = initialInvoice || targetReceipt?.invoice_number || "";
      setPoQuery(po);
      setInvoiceQuery(inv);
      setErrorMessage(null);
      if (po || inv) {
        performSearch(po, inv);
      } else {
        setResult(null);
      }
    }
  }, [open, initialPo, initialInvoice, targetReceipt]);

  const getItemKey = (item: SapMatchedLineItem) =>
    `${item.material_code}__${item.item_no}__${item.sap_103_doc || item.sap_105_doc || item.invoice_number || ""}`;

  async function performSearch(po: string, inv: string) {
    if (!po.trim() && !inv.trim()) {
      setErrorMessage("Please enter a PO Number or Invoice Number to search.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await findSapDocumentsForDrc(po, inv);
      setResult(res);

      // Pre-select all items by default
      const initialSelection: Record<string, boolean> = {};
      res.items.forEach((item) => {
        initialSelection[getItemKey(item)] = true;
      });
      setSelectedItems(initialSelection);
    } catch (err) {
      console.error("SAP search error:", err);
      setErrorMessage("Failed to query SAP MB51 history. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (!result) return;
    const nextSelection: Record<string, boolean> = {};
    result.items.forEach((item) => {
      nextSelection[getItemKey(item)] = checked;
    });
    setSelectedItems(nextSelection);
  };

  const toggleItem = (key: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectedCount = useMemo(() => {
    return Object.values(selectedItems).filter(Boolean).length;
  }, [selectedItems]);

  const handleApply = async () => {
    if (!result) return;

    const chosenItems = result.items.filter(
      (item) => selectedItems[getItemKey(item)]
    );

    if (chosenItems.length === 0) {
      setErrorMessage("Please select at least one material to import.");
      return;
    }

    setApplying(true);
    try {
      if (targetReceipt && onApplyToReceipt) {
        await onApplyToReceipt(targetReceipt, chosenItems, result);
      } else if (onApplyToForm) {
        onApplyToForm(chosenItems, {
          vendor: result.vendorName || undefined,
          poDate: result.primary103Date || undefined,
          po: result.poNumber || poQuery || undefined,
          invoice: result.invoiceNumber || invoiceQuery || undefined,
          doc103: result.primary103Doc || undefined,
          doc105: result.primary105Doc || undefined,
        });
      }
      onClose();
    } catch (err) {
      console.error("Apply error:", err);
      setErrorMessage("Failed to apply materials to DRC. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
          pb: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SyncIcon color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
              Fetch from SAP MB51 History
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Match 103 (GR Blocked Stock) & 105 (GR Release) movements by PO & Invoice
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        {/* Search Bar */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            bgcolor: "grey.50",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr auto" },
              gap: 1.5,
              alignItems: "center",
            }}
          >
            <TextField
              label="SAP PO Number"
              size="small"
              placeholder="e.g. 72446540"
              value={poQuery}
              onChange={(e) => setPoQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") performSearch(poQuery, invoiceQuery);
              }}
              sx={{ bgcolor: "background.paper" }}
            />
            <TextField
              label="Invoice Number"
              size="small"
              placeholder="e.g. 0357"
              value={invoiceQuery}
              onChange={(e) => setInvoiceQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") performSearch(poQuery, invoiceQuery);
              }}
              sx={{ bgcolor: "background.paper" }}
            />
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              disabled={loading || (!poQuery.trim() && !invoiceQuery.trim())}
              onClick={() => performSearch(poQuery, invoiceQuery)}
              sx={{ minHeight: 40, px: 2.5, fontWeight: 700, textTransform: "none" }}
            >
              {loading ? "Searching..." : "Search MB51"}
            </Button>
          </Box>
        </Paper>

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* Loading Spinner */}
        {loading && (
          <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              Searching SAP material documents in MB51 history...
            </Typography>
          </Box>
        )}

        {/* Search Results */}
        {!loading && result && (
          <Box>
            {result.hasMatches ? (
              <Box>
                {/* Match Summary Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "primary.light",
                    bgcolor: "primary.50",
                  }}
                >
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "space-between", mb: 1 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Matched in SAP MB51 History
                      </Typography>
                      {result.vendorName && (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Vendor: {result.vendorName}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {result.invoiceMatched && result.invoiceNumber && (
                        <Chip
                          size="small"
                          color="primary"
                          label={`Invoice: ${result.invoiceNumber}`}
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                      {result.has103 && (
                        <Chip
                          size="small"
                          color="info"
                          icon={<Inventory2Icon fontSize="small" />}
                          label={`103 Doc: ${result.primary103Doc || "Found"} (${result.primary103Date || "No Date"})`}
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                      {result.has105 ? (
                        <Chip
                          size="small"
                          color="success"
                          icon={<TaskAltIcon fontSize="small" />}
                          label={`105 GRN: ${result.primary105Doc} (${result.primary105Date || "No Date"})`}
                          sx={{ fontWeight: 600 }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          variant="outlined"
                          label="105 Movement Pending"
                          sx={{ fontWeight: 500 }}
                        />
                      )}
                    </Box>
                  </Box>

                  {result.searchedInvoice && !result.invoiceMatched && (
                    <Alert severity="warning" sx={{ mb: 1, py: 0.5, fontSize: "0.8rem" }}>
                      No movements matched Invoice &quot;{result.searchedInvoice}&quot; under PO {result.poNumber}.
                      Showing individual consignments/deliveries on this PO below:
                    </Alert>
                  )}

                  <Typography variant="caption" color="text.secondary">
                    {result.items.length} line item(s) found across {result.rawMovementCount} raw movement document(s).
                    Select the materials below to map them against this DRC.
                  </Typography>
                </Paper>

                {/* Items Table */}
                <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: "grey.100" }}>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            indeterminate={
                              selectedCount > 0 &&
                              selectedCount < result.items.length
                            }
                            checked={
                              result.items.length > 0 &&
                              selectedCount === result.items.length
                            }
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Item #</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Material Code</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Invoice / Ref</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>SAP Doc</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>UoM</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>SAP Movement Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.items.map((item) => {
                        const key = getItemKey(item);
                        const isSelected = !!selectedItems[key];
                        return (
                          <TableRow
                            key={key}
                            hover
                            onClick={() => toggleItem(key)}
                            sx={{ cursor: "pointer", bgcolor: isSelected ? "action.hover" : "inherit" }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={isSelected} />
                            </TableCell>
                            <TableCell>{item.item_no}</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontFamily: "monospace" }}>
                              {item.material_code}
                            </TableCell>
                            <TableCell>{item.material_description || "-"}</TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {item.invoice_number || "-"}
                              </Typography>
                              {item.purchase_order && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                  PO: {item.purchase_order}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block" }}>
                                {item.sap_103_doc ? `103: ${item.sap_103_doc}` : item.sap_105_doc ? `105: ${item.sap_105_doc}` : "-"}
                              </Typography>
                              {item.sap_103_date && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                  {item.sap_103_date}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {item.quantity_103 || item.quantity_105}
                            </TableCell>
                            <TableCell>{item.unit_of_entry}</TableCell>
                            <TableCell>
                              {item.status === "105_POSTED" ? (
                                <Chip
                                  size="small"
                                  color="success"
                                  label={`105 Cleared (${item.quantity_105})`}
                                  sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600 }}
                                />
                              ) : item.status === "PARTIAL_105" ? (
                                <Chip
                                  size="small"
                                  color="warning"
                                  label={`Partial 105 (${item.quantity_105}/${item.quantity_103})`}
                                  sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600 }}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                  label="103 GR Blocked Stock"
                                  sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600 }}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ) : (
              /* No Matches Found in MB51 */
              <Box sx={{ py: 3, px: 2, textAlign: "center" }}>
                <InfoOutlinedIcon sx={{ fontSize: 48, color: "warning.main", mb: 1 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                  No SAP Material Documents Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mx: "auto", mb: 2 }}>
                  We could not find any 103 or 105 movements in SAP MB51 history matching PO:{" "}
                  <strong>{poQuery || "None"}</strong> or Invoice:{" "}
                  <strong>{invoiceQuery || "None"}</strong>.
                </Typography>

                <Alert severity="info" sx={{ textAlign: "left", maxWidth: 540, mx: "auto", borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                    Periodic MB51 Update Schedule
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Since MB51 is updated manually at the start and end of the day, you can:
                    <br />
                    1. <strong>Proceed with DRC creation now</strong> (manual entry or package count).
                    <br />
                    2. Once the SAP 103 movement is posted and MB51 is uploaded in <em>Stock Update</em>, click <strong>"Fetch from SAP MB51"</strong> directly from the DRC register or view dialog to map the material codes.
                  </Typography>
                </Alert>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        {result?.hasMatches && (
          <Button
            variant="contained"
            disabled={selectedCount === 0 || applying}
            onClick={handleApply}
            startIcon={applying ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            sx={{ fontWeight: 700, textTransform: "none" }}
          >
            {applying
              ? "Mapping..."
              : `Import ${selectedCount} Material${selectedCount > 1 ? "s" : ""} to DRC`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
