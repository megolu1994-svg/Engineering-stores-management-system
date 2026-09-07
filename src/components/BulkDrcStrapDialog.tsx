import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";

import { type ReceiptHeader } from "../services/receiptService";
import {
  buildBulkEdgeStrapPrintDocument,
  executePrint,
  formatPrintDate,
} from "../utils/drcPrintUtils";

interface BulkDrcStrapDialogProps {
  open: boolean;
  onClose: () => void;
  receipts: ReceiptHeader[];
  onRemoveReceipt?: (id: number) => void;
  onClearAll?: () => void;
}

export const BulkDrcStrapDialog: React.FC<BulkDrcStrapDialogProps> = ({
  open,
  onClose,
  receipts,
  onRemoveReceipt,
  onClearAll,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  if (!receipts || receipts.length === 0) {
    return null;
  }

  const estimatedPages = Math.ceil(receipts.length / 6);

  const handlePrint = () => {
    const html = buildBulkEdgeStrapPrintDocument(receipts);
    executePrint(html, `DRC_Bulk_Edge_Straps_${receipts.length}_items`);
  };

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
            maxHeight: "92vh",
          },
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <ContentCutIcon color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Bulk DRC Edge Strap Print
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Print multiple horizontal edge straps stacked on single page to cut with scissors
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        {/* Summary Info Alert */}
        <Alert
          severity="info"
          icon={<DescriptionIcon fontSize="inherit" />}
          sx={{
            mb: 2,
            borderRadius: 2,
            alignItems: "center",
            "& .MuiAlert-message": { width: "100%" },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {receipts.length} Edge Straps Selected
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Approximately {estimatedPages} A4 sheet{estimatedPages > 1 ? "s" : ""} required. Up to 6 straps fit per page with scissor cut lines.
              </Typography>
            </Box>
            {onClearAll && (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={onClearAll}
                sx={{ textTransform: "none", fontSize: "0.75rem", py: 0.25 }}
              >
                Clear All
              </Button>
            )}
          </Box>
        </Alert>

        {/* Print Preview Container */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
          <span>Page Print Preview</span>
          <Chip label="Uniform Big & Bold Fonts" size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
        </Typography>

        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            p: { xs: 1, sm: 2 },
            bgcolor: "#f8fafc",
            maxHeight: "56vh",
            overflowY: "auto",
          }}
        >
          {/* Top scissor mark */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5, color: "#000000" }}>
            <Typography sx={{ fontSize: 16, lineHeight: 1 }}>✂</Typography>
            <Box sx={{ flex: 1, borderBottom: "2px dashed #000000", mx: 1 }} />
            <Typography sx={{ fontSize: 16, lineHeight: 1 }}>✂</Typography>
          </Box>

          {/* Stacked Straps */}
          {receipts.map((receipt) => {
            const drcDate = formatPrintDate(receipt.receipt_datetime || receipt.created_at);
            const poNumber =
              receipt.sap_po_number ||
              receipt.po_number ||
              (receipt.gem_order_number ? `GeM:${receipt.gem_order_number}` : "-");

            return (
              <Box key={receipt.id} sx={{ mb: 0.75 }}>
                <Box sx={{ position: "relative" }}>
                  {/* Strap Item Table */}
                  <Box
                    component="table"
                    sx={{
                      width: "100%",
                      borderCollapse: "collapse",
                      border: "2.5px solid #000000",
                      borderRadius: 1,
                      bgcolor: "#ffffff",
                      tableLayout: "auto",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <Box component="tbody">
                      <Box component="tr">
                        {/* 1. DRC Number & Date */}
                        <Box
                          component="td"
                          sx={{
                            whiteSpace: "nowrap",
                            width: "1%",
                            p: 1,
                            px: 1.5,
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
                                fontSize: "0.95rem",
                              }}
                            >
                              {receipt.drc_number}
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 800,
                                color: "#000000",
                                fontSize: "0.8rem",
                              }}
                            >
                              (Dt: {drcDate})
                            </Typography>
                          </Box>
                        </Box>

                        {/* 2. PO Number */}
                        <Box
                          component="td"
                          sx={{
                            whiteSpace: "nowrap",
                            width: "1%",
                            p: 1,
                            px: 1.5,
                            borderRight: "2.5px solid #000000",
                            verticalAlign: "middle",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 900,
                                color: "#000000",
                                letterSpacing: 0.5,
                                fontSize: "0.72rem",
                              }}
                            >
                              PO:
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                fontFamily: "monospace",
                                color: "#000000",
                                fontSize: "0.88rem",
                              }}
                            >
                              {poNumber}
                            </Typography>
                          </Box>
                        </Box>

                        {/* 3. Vendor Name & Code */}
                        <Box
                          component="td"
                          sx={{
                            width: "98%",
                            p: 1,
                            px: 1.5,
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
                                fontSize: "0.72rem",
                              }}
                            >
                              VENDOR:
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                color: "#000000",
                                fontSize: "0.88rem",
                                lineHeight: 1.25,
                                wordBreak: "break-word",
                              }}
                            >
                              {receipt.vendor_name}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Delete action cell if removable */}
                        {onRemoveReceipt && (
                          <Box
                            component="td"
                            sx={{
                              width: "1%",
                              whiteSpace: "nowrap",
                              p: 0.5,
                              px: 0.75,
                              borderLeft: "1px dashed #cbd5e1",
                              verticalAlign: "middle",
                              textAlign: "center",
                            }}
                          >
                            <Tooltip title="Remove this strap from batch">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => onRemoveReceipt(receipt.id)}
                                sx={{ p: 0.5 }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* Scissor Cut Line Guide below each strap */}
                  <Box sx={{ display: "flex", alignItems: "center", my: 0.5, color: "#000000" }}>
                    <Typography sx={{ fontSize: 16, lineHeight: 1 }}>✂</Typography>
                    <Box sx={{ flex: 1, borderBottom: "2px dashed #000000", mx: 1 }} />
                    <Typography sx={{ fontSize: 16, lineHeight: 1 }}>✂</Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          p: 2,
          px: 2.5,
          borderTop: "1px solid",
          borderColor: "divider",
          justifyContent: "space-between",
        }}
      >
        <Button onClick={onClose} color="inherit" sx={{ fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          sx={{
            fontWeight: 700,
            borderRadius: 2,
            px: 3,
            minHeight: 44,
          }}
        >
          Print All {receipts.length} Straps
        </Button>
      </DialogActions>
    </Dialog>
  );
};
