import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import DescriptionIcon from "@mui/icons-material/Description";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { type ReceiptHeader, getDrcDisplayStatus } from "../services/receiptService";
import { useBranding } from "../contexts/BrandingContext";
import {
  type StrapFormat,
  type StrapPrintOptions,
  buildStrapPrintDocument,
  buildFullDrcDocumentHtml,
  executePrint,
  formatPrintDate,
  formatPrintDateTime,
  getPackagePrintSummary,
} from "../utils/drcPrintUtils";

interface DrcFileStrapDialogProps {
  open: boolean;
  receipt: ReceiptHeader | null;
  onClose: () => void;
  defaultTab?: "strap" | "full";
}

export function DrcFileStrapDialog({
  open,
  receipt,
  onClose,
  defaultTab = "strap",
}: DrcFileStrapDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const branding = useBranding();

  const [activeTab, setActiveTab] = useState<"strap" | "full">(defaultTab);
  const [strapFormat, setStrapFormat] = useState<StrapFormat>("horizontal_edge_strap");
  const stripCount = 1;
  const edgeFontSize = "large";
  const [includeBlankGrnLine, setIncludeBlankGrnLine] = useState(true);
  const [includeFilingVerification, setIncludeFilingVerification] = useState(true);

  // Synchronize when opening
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  if (!receipt) return null;

  const statusInfo = getDrcDisplayStatus(receipt);
  const packageSummary = getPackagePrintSummary(receipt);

  const printOptions: StrapPrintOptions = {
    format: strapFormat,
    includeBlankGrnLine,
    includeFilingVerification,
    stripCount,
    edgeFontSize,
    companyName: branding?.companyName || "ENGINEERING STORES DEPARTMENT",
    warehouseName: branding?.warehouseName || "",
  };

  function handlePrintNow() {
    if (!receipt) return;
    if (activeTab === "full") {
      const fullHtml = buildFullDrcDocumentHtml(receipt);
      executePrint(fullHtml, `DRC_${receipt.drc_number}`);
    } else {
      const strapHtml = buildStrapPrintDocument(receipt, printOptions);
      executePrint(strapHtml, `DRC_Strap_${receipt.drc_number}`);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 3,
            boxShadow: 24,
            maxHeight: "92vh",
          },
        },
      }}
    >
      {/* Dialog Header */}
      <DialogTitle
        sx={{
          p: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          backgroundColor: "background.paper",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              p: 0.75,
              borderRadius: 2,
              bgcolor: "primary.50",
              color: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ContentCutIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Print DRC File Strap & Document
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Generate cut-and-paste file identification straps for DRC register files
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            size="small"
            label={receipt.drc_number}
            sx={{
              fontFamily: "monospace",
              fontWeight: 800,
              bgcolor: "action.hover",
              fontSize: "0.85rem",
            }}
          />
          <Chip
            size="small"
            label={statusInfo.label}
            color={statusInfo.key === "on_hold" ? "error" : statusInfo.key === "cleared" ? "success" : "warning"}
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
          <IconButton size="small" onClick={onClose} aria-label="Close dialog">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: "grey.50" }}>
        {/* Navigation Tabs between Strap and Full Document */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2, bgcolor: "background.paper", borderRadius: 2, px: 1 }}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            variant="fullWidth"
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab
              value="strap"
              icon={<ContentCutIcon fontSize="small" />}
              iconPosition="start"
              label="DRC File Strap (Cut & Paste)"
              sx={{ fontWeight: 700, minHeight: 48 }}
            />
            <Tab
              value="full"
              icon={<DescriptionIcon fontSize="small" />}
              iconPosition="start"
              label="Full DRC Document (A4)"
              sx={{ fontWeight: 700, minHeight: 48 }}
            />
          </Tabs>
        </Box>

        {activeTab === "strap" ? (
          <Box>
            {/* Format selection toolbar */}
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                mb: 2,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                bgcolor: "background.paper",
              }}
            >
              {/* Format selection */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "text.secondary", mr: 0.5 }}>
                  Strap Format:
                </Typography>

                <Button
                  size="small"
                  variant={strapFormat === "horizontal_edge_strap" ? "contained" : "outlined"}
                  color="primary"
                  startIcon={<ContentCutIcon fontSize="small" />}
                  onClick={() => setStrapFormat("horizontal_edge_strap")}
                  sx={{ borderRadius: 2, fontWeight: 800, textTransform: "none" }}
                >
                  Horizontal Edge Strap (Line)
                </Button>

                <Button
                  size="small"
                  variant={strapFormat === "all_in_one" ? "contained" : "outlined"}
                  startIcon={<ViewAgendaOutlinedIcon fontSize="small" />}
                  onClick={() => setStrapFormat("all_in_one")}
                  sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}
                >
                  All-in-One Kit
                </Button>

                <Button
                  size="small"
                  variant={strapFormat === "cover_strap" ? "contained" : "outlined"}
                  startIcon={<DescriptionIcon fontSize="small" />}
                  onClick={() => setStrapFormat("cover_strap")}
                  sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}
                >
                  Front Cover
                </Button>

                <Button
                  size="small"
                  variant={strapFormat === "spine_strap" ? "contained" : "outlined"}
                  startIcon={<LabelOutlinedIcon fontSize="small" />}
                  onClick={() => setStrapFormat("spine_strap")}
                  sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}
                >
                  Binder Spine
                </Button>
              </Box>

              {/* Toggles & Options */}
              {strapFormat === "horizontal_edge_strap" ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                      px: 1.25,
                      py: 0.5,
                      bgcolor: "success.50",
                      border: "1px solid",
                      borderColor: "success.200",
                      borderRadius: 1.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, color: "success.dark" }}>
                      ✓ 1 Single Strap (Paper Saving Mode)
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Printed at the very top of A4 page with only scissor cut marks, saving remaining paper.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={includeBlankGrnLine}
                        onChange={(e) => setIncludeBlankGrnLine(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Write-in GRN Line
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={includeFilingVerification}
                        onChange={(e) => setIncludeFilingVerification(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Store Signatures Box
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                </Box>
              )}
            </Paper>

            {/* Visual Help Banner */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 1.5,
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: strapFormat === "horizontal_edge_strap" ? "primary.50" : "info.50",
                color: strapFormat === "horizontal_edge_strap" ? "primary.dark" : "info.dark",
                fontSize: "0.8rem",
              }}
            >
              <InfoOutlinedIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {strapFormat === "horizontal_edge_strap"
                  ? "Horizontal Edge Strap: Displays strictly DRC No. with Date, PO No., and Vendor Name arranged in a single line. Paste along the edge of your file folder to identify and retrieve files from a stack."
                  : "Print on standard A4 paper, then cut along the dashed scissor lines (✂) to paste onto your physical DRC register folder, box file, or docket."}
              </Typography>
            </Box>

            {/* Live Visual Preview of the Strap */}
            <Paper
              elevation={2}
              sx={{
                p: { xs: 1.5, sm: 2.5 },
                borderRadius: 2.5,
                bgcolor: "#ffffff",
                border: "1px solid #e2e8f0",
                overflowX: "auto",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "text.secondary",
                  mb: 1.5,
                }}
              >
                Live Print Preview ({strapFormat.replace(/_/g, " ").toUpperCase()})
              </Typography>

              {/* Horizontal Edge Line Strap Preview */}
              {strapFormat === "horizontal_edge_strap" && (
                <Box sx={{ width: "100%", my: 1.5 }}>
                  {/* Upper Cut Guide: Only scissor marks & dashed line */}
                  <Box sx={{ display: "flex", alignItems: "center", mb: 0.75 }}>
                    <Typography sx={{ fontSize: 17, color: "#000000", lineHeight: 1 }}>✂</Typography>
                    <Box sx={{ flex: 1, borderBottom: "2px dashed #000000", mx: 1 }} />
                    <Typography sx={{ fontSize: 17, color: "#000000", lineHeight: 1 }}>✂</Typography>
                  </Box>

                  {/* Single Horizontal Row Edge Strap with Optimized Proportional Sections */}
                  <Box
                    component="table"
                    sx={{
                      width: "100%",
                      borderCollapse: "collapse",
                      border: "2.5px solid #000000",
                      borderRadius: 1,
                      bgcolor: "#ffffff",
                      tableLayout: "auto",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    }}
                  >
                    <Box component="tbody">
                      <Box component="tr">
                        {/* 1. DRC Number with Date: Sized tightly to content length */}
                        <Box
                          component="td"
                          sx={{
                            whiteSpace: "nowrap",
                            width: "1%",
                            p: 1.25,
                            px: 1.75,
                            borderRight: "2.5px solid #000000",
                            verticalAlign: "middle",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                fontFamily: "monospace",
                                color: "#000000",
                                letterSpacing: 0.5,
                                fontSize: "1.05rem",
                              }}
                            >
                              {receipt.drc_number}
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 800,
                                color: "#000000",
                                fontSize: "0.85rem",
                              }}
                            >
                              (Dt: {formatPrintDate(receipt.receipt_datetime || receipt.created_at)})
                            </Typography>
                          </Box>
                        </Box>

                        {/* 2. PO Number: Sized tightly to content length */}
                        <Box
                          component="td"
                          sx={{
                            whiteSpace: "nowrap",
                            width: "1%",
                            p: 1.25,
                            px: 1.75,
                            borderRight: "2.5px solid #000000",
                            verticalAlign: "middle",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 900,
                                color: "#000000",
                                letterSpacing: 0.5,
                                fontSize: "0.75rem",
                              }}
                            >
                              PO:
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                fontFamily: "monospace",
                                color: "#000000",
                                fontSize: "0.95rem",
                              }}
                            >
                              {receipt.sap_po_number || receipt.po_number || (receipt.gem_order_number ? `GeM:${receipt.gem_order_number}` : "-")}
                            </Typography>
                          </Box>
                        </Box>

                        {/* 3. Vendor Name & Code: Full remaining width, left-aligned, never cut or overlapping */}
                        <Box
                          component="td"
                          sx={{
                            width: "98%",
                            p: 1.25,
                            px: 1.75,
                            verticalAlign: "middle",
                            textAlign: "left",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 900,
                                color: "#000000",
                                letterSpacing: 0.5,
                                flexShrink: 0,
                                fontSize: "0.75rem",
                              }}
                            >
                              VENDOR:
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                color: "#000000",
                                fontSize: "0.95rem",
                                lineHeight: 1.25,
                                wordBreak: "break-word",
                              }}
                              title={receipt.vendor_name}
                            >
                              {receipt.vendor_name}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* Lower Cut Guide: Only scissor marks & dashed line */}
                  <Box sx={{ display: "flex", alignItems: "center", mt: 0.75 }}>
                    <Typography sx={{ fontSize: 17, color: "#000000", lineHeight: 1 }}>✂</Typography>
                    <Box sx={{ flex: 1, borderBottom: "2px dashed #000000", mx: 1 }} />
                    <Typography sx={{ fontSize: 17, color: "#000000", lineHeight: 1 }}>✂</Typography>
                  </Box>
                </Box>
              )}

              {/* Scissor guideline top for other formats */}
              {strapFormat !== "horizontal_edge_strap" && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    color: "text.secondary",
                    mb: 0.5,
                  }}
                >
                  <span>✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂</span>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                    CUT LINE
                  </Typography>
                </Box>
              )}

              {/* Front File Strap Visual Representation */}
              {(strapFormat === "all_in_one" || strapFormat === "cover_strap" || strapFormat === "dual_cover") && (
                <Box
                  sx={{
                    border: "2.5px dashed #334155",
                    borderRadius: 2,
                    p: 2,
                    mb: strapFormat === "all_in_one" ? 2 : 0,
                    bgcolor: "#ffffff",
                    color: "#0f172a",
                  }}
                >
                  {/* Top Bar */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      borderBottom: "2px solid #0f172a",
                      pb: 1,
                      mb: 1.5,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          letterSpacing: 0.75,
                          textTransform: "uppercase",
                          color: "#475569",
                        }}
                      >
                        {branding?.companyName || "ENGINEERING STORES DEPARTMENT"} &bull; {branding?.warehouseName ? `${branding.warehouseName} - ` : ""}DRC REGISTER FILE
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mt: 0.25 }}>
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 900,
                            fontFamily: "monospace",
                            color: "#0f172a",
                            lineHeight: 1,
                          }}
                        >
                          {receipt.drc_number}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: "#475569" }}>
                          Receipt: <b>{formatPrintDateTime(receipt.receipt_datetime)}</b>
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ textAlign: "right" }}>
                      <Chip
                        size="small"
                        label={statusInfo.label}
                        color={statusInfo.key === "on_hold" ? "error" : statusInfo.key === "cleared" ? "success" : "warning"}
                        sx={{ fontWeight: 800 }}
                      />
                      <Typography variant="caption" sx={{ display: "block", color: "#64748b", mt: 0.5, fontWeight: 600 }}>
                        {receipt.msme_type ? `MSME: ${receipt.msme_type}` : "GENERAL"} {receipt.delivery_location ? ` • Loc: ${receipt.delivery_location}` : ""}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Grid fields */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 1,
                      fontSize: "0.85rem",
                      lineHeight: 1.4,
                    }}
                  >
                    <Box sx={{ p: 0.75, bgcolor: "#f8fafc", borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                        Vendor Name
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: "#0f172a" }}>
                        {receipt.vendor_name}
                      </Typography>
                    </Box>

                    <Box sx={{ p: 0.75, bgcolor: "#f8fafc", borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                        PO & GeM Details
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#0f172a" }}>
                        {receipt.sap_po_number ? `PO: ${receipt.sap_po_number}` : "No PO"}
                        {receipt.gem_order_number ? ` | GeM: ${receipt.gem_order_number}` : ""}
                      </Typography>
                    </Box>

                    <Box sx={{ p: 0.75, bgcolor: "#f8fafc", borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                        Invoice / Challan
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#0f172a" }}>
                        {receipt.invoice_number ? `Inv: ${receipt.invoice_number} (dt. ${formatPrintDate(receipt.invoice_date)})` : ""}
                        {receipt.tax_invoice_value ? ` • ₹${Number(receipt.tax_invoice_value).toLocaleString("en-IN")}` : ""}
                        {receipt.challan_number ? ` • Ch: ${receipt.challan_number}` : ""}
                      </Typography>
                    </Box>

                    <Box sx={{ p: 0.75, bgcolor: "#f8fafc", borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                        Packages & Dispatch
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#0f172a", fontWeight: 700 }}>
                        {packageSummary}
                        {receipt.receipt_mode ? ` (${receipt.receipt_mode} - ${receipt.vehicle_number || "Direct"})` : ""}
                      </Typography>
                    </Box>

                    <Box sx={{ p: 0.75, bgcolor: "#f8fafc", borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                        Purpose / Note
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#334155" }}>
                        {receipt.purpose ?? receipt.remarks ?? receipt.important_note ?? "-"}
                      </Typography>
                    </Box>

                    <Box sx={{ p: 0.75, bgcolor: "#f8fafc", borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                        SAP GRN Status
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#0f172a", fontWeight: 700 }}>
                        {receipt.grn_number ? (
                          `${receipt.grn_number} (dt. ${formatPrintDate(receipt.grn_date)})`
                        ) : includeBlankGrnLine ? (
                          <span style={{ borderBottom: "1.5px dashed #94a3b8", display: "inline-block", minWidth: 140 }}>
                            Pending (Fill on posting)
                          </span>
                        ) : (
                          "Pending"
                        )}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Inspection Strip */}
                  <Box sx={{ mt: 1, p: 0.75, bgcolor: "#f1f5f9", borderRadius: 1, fontSize: "0.8rem" }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569" }}>
                      Inspection:{" "}
                    </Typography>
                    <span>
                      <b>{statusInfo.label}</b> &bull; By: {receipt.inspection_by ?? "-"} &bull; Date: {receipt.inspection_date ? formatPrintDateTime(receipt.inspection_date) : "-"}
                    </span>
                    {receipt.inspection_remarks && (
                      <Typography variant="caption" sx={{ display: "block", color: "error.main", fontWeight: 700, mt: 0.25 }}>
                        Hold/Remarks: {receipt.inspection_remarks}
                      </Typography>
                    )}
                  </Box>

                  {/* Signatures & Filing */}
                  {includeFilingVerification && (
                    <Box
                      sx={{
                        mt: 1.5,
                        pt: 1,
                        borderTop: "1px solid #cbd5e1",
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 2,
                        fontSize: "0.75rem",
                        color: "#64748b",
                      }}
                    >
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <span>File / Rack: ________________</span>
                        <span>Dockets: _____</span>
                      </Box>
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <span>Store Receiver: ________________</span>
                        <span>Stores In-Charge: ________________</span>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* Spine Strap Visual Representation */}
              {(strapFormat === "all_in_one" || strapFormat === "spine_strap") && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.5 }}>
                    {strapFormat === "all_in_one" ? "Accompanying File Spine Slip (For Lever-Arch Binder Spine):" : "File Spine Slip:"}
                  </Typography>
                  <Box
                    sx={{
                      display: "inline-block",
                      border: "2.5px dashed #334155",
                      borderRadius: 2,
                      p: 1.5,
                      width: 175,
                      textAlign: "center",
                      bgcolor: "#ffffff",
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569", display: "block", borderBottom: "1px solid #0f172a", pb: 0.5 }}>
                      {branding?.companyName ? branding.companyName.slice(0, 14) : "ENGG STORES"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", display: "block", mt: 0.5, fontWeight: 700 }}>
                      DRC NO.
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, fontFamily: "monospace", color: "#0f172a", wordBreak: "break-all" }}>
                      {receipt.drc_number}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block", color: "#64748b" }}>
                      {formatPrintDate(receipt.receipt_datetime)}
                    </Typography>
                    <Box sx={{ my: 0.5 }}>
                      <Chip
                        size="small"
                        label={statusInfo.label}
                        color={statusInfo.key === "on_hold" ? "error" : statusInfo.key === "cleared" ? "success" : "warning"}
                        sx={{ fontSize: "0.65rem", height: 20 }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: "#0f172a", display: "block", mt: 0.5 }}>
                      {receipt.vendor_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", display: "block", fontSize: "0.7rem", mt: 0.5 }}>
                      PO: {receipt.sap_po_number || "-"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", display: "block", fontSize: "0.7rem" }}>
                      GRN: {receipt.grn_number || "_________"}
                    </Typography>
                    <Box sx={{ mt: 1, pt: 0.5, borderTop: "1px solid #cbd5e1" }}>
                      <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#94a3b8" }}>
                        FILE / RACK: _______
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Scissor guideline bottom */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  color: "text.secondary",
                  mt: 1.5,
                }}
              >
                <span>✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂</span>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                  CUT LINE
                </Typography>
              </Box>
            </Paper>
          </Box>
        ) : (
          /* Full Document Preview Tab */
          <Paper
            elevation={2}
            sx={{
              p: { xs: 1.5, sm: 3 },
              borderRadius: 2.5,
              bgcolor: "#ffffff",
              border: "1px solid #e2e8f0",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", borderBottom: 2, borderColor: "#0f172a", pb: 1, mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, textTransform: "uppercase" }}>
                  Delivery Receipt Challan (DRC)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Complete Material Inward & Inspection Record (A4 Full Sheet)
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: "monospace" }}>
                  {receipt.drc_number}
                </Typography>
                <Chip
                  size="small"
                  label={statusInfo.label}
                  color={statusInfo.key === "on_hold" ? "error" : statusInfo.key === "cleared" ? "success" : "warning"}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              </Box>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, fontSize: "0.85rem" }}>
              <div><b>Vendor:</b> {receipt.vendor_name}</div>
              <div><b>Receipt Date:</b> {formatPrintDateTime(receipt.receipt_datetime)}</div>
              <div><b>SAP PO Number:</b> {receipt.sap_po_number || "-"}</div>
              <div><b>SAP PO Date:</b> {formatPrintDate(receipt.sap_po_date)}</div>
              <div><b>Invoice Number:</b> {receipt.invoice_number || "-"}</div>
              <div><b>Invoice Date:</b> {formatPrintDate(receipt.invoice_date)}</div>
              <div><b>Challan Number:</b> {receipt.challan_number || "-"}</div>
              <div><b>Tax Invoice Value:</b> {receipt.tax_invoice_value ? `₹${Number(receipt.tax_invoice_value).toLocaleString("en-IN")}` : "-"}</div>
              <div><b>Package Details:</b> {packageSummary}</div>
              <div><b>Delivery Location:</b> {receipt.delivery_location || "-"}</div>
              <div><b>Inspection By:</b> {receipt.inspection_by || "-"}</div>
              <div><b>Inspection Date:</b> {formatPrintDateTime(receipt.inspection_date)}</div>
              <div><b>Inspection Remarks:</b> {receipt.inspection_remarks || "-"}</div>
              <div><b>SAP GRN Number:</b> {receipt.grn_number || "Pending"}</div>
            </Box>
          </Paper>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Button onClick={onClose} color="inherit" sx={{ borderRadius: 2 }}>
          Close
        </Button>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={handlePrintNow}
            sx={{
              minHeight: 44,
              borderRadius: 2,
              fontWeight: 800,
              px: 3,
            }}
          >
            {activeTab === "strap"
              ? strapFormat === "horizontal_edge_strap"
                ? "Print DRC Edge Strap (1 Strip)"
                : "Print DRC File Strap"
              : "Print Full DRC Document"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
