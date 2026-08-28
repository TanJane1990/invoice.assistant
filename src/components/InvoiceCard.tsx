import React, { useState, useEffect } from "react";
import { InvoiceData, GridMode } from "../types";
import { Trash2 } from "lucide-react";
import { convertPdfToImageDataUrl, cropWhitespaceFromCanvas } from "../utils/pdfToImage";

interface InvoiceCardProps {
  invoice: InvoiceData;
  gridMode: GridMode;
  showCropLines: boolean;
  onEdit?: (invoice: InvoiceData) => void;
  onDelete?: (id: string) => void;
  index: number;
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({
  invoice,
  gridMode,
  showCropLines,
  onEdit,
  onDelete,
  index,
}) => {
  const [renderedImgUrl, setRenderedImgUrl] = useState<string | null>(null);

  const isSingle = gridMode === "1";
  const isMini = gridMode === "4";
  const isCompact = gridMode === "2";

  useEffect(() => {
    let isMounted = true;
    if (invoice.fileUrl) {
      if (
        invoice.fileUrl.startsWith("data:application/pdf") ||
        invoice.fileUrl.includes("pdf")
      ) {
        convertPdfToImageDataUrl(invoice.fileUrl)
          .then((imgUrl) => {
            if (isMounted) setRenderedImgUrl(imgUrl);
          })
          .catch((err) => {
            console.warn("Failed to render PDF to image:", err);
            if (isMounted) setRenderedImgUrl(invoice.fileUrl);
          });
      } else if (
        invoice.fileUrl.startsWith("data:image/") ||
        invoice.fileUrl.startsWith("blob:") ||
        invoice.fileUrl.startsWith("http")
      ) {
        // 对图片发票进行智能检测并裁切四周多余空白边
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const cropped = cropWhitespaceFromCanvas(canvas);
              if (isMounted) setRenderedImgUrl(cropped);
              return;
            }
          } catch {}
          if (isMounted) setRenderedImgUrl(invoice.fileUrl);
        };
        img.onerror = () => {
          if (isMounted) setRenderedImgUrl(invoice.fileUrl);
        };
        img.src = invoice.fileUrl;
      } else {
        setRenderedImgUrl(invoice.fileUrl);
      }
    } else {
      setRenderedImgUrl(null);
    }
    return () => {
      isMounted = false;
    };
  }, [invoice.fileUrl]);

  return (
    <div
      className="relative bg-white text-slate-800 transition-all duration-150 group overflow-hidden w-full h-full flex flex-col justify-between"
      style={{
        boxSizing: "border-box",
        height: "100%",
        width: "100%",
      }}
    >
      {/* Delete Action (Screen only, strictly hidden in print - Always clear & visible on hover/screen) */}
      {onDelete && (
        <div className="no-print print:hidden absolute top-1.5 right-1.5 z-30 transition-all opacity-85 hover:opacity-100 scale-95 hover:scale-105">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(invoice.id);
            }}
            className="p-1.5 bg-[#E8000A] hover:bg-[#C80009] text-white rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center border border-white/40"
            title="从当前排版中删除此发票"
          >
            <Trash2 className="w-3.5 h-3.5 text-white" style={{ color: "#ffffff" }} />
          </button>
        </div>
      )}

      {/* RENDER REAL ORIGINAL INVOICE FILE IF AVAILABLE */}
      {renderedImgUrl ? (
        <div
          className={`w-full h-full flex items-center justify-center overflow-hidden bg-white ${
            gridMode === "4" ? "p-1" : "px-2 py-3"
          }`}
        >
          <img
            src={renderedImgUrl}
            alt={invoice.fileName || "发票原票件"}
            className="w-full h-full object-contain pointer-events-none"
            style={{
              maxHeight: gridMode === "4" ? "calc(100% - 4px)" : "calc(100% - 8px)",
              maxWidth: "calc(100% - 4px)",
              transform: "none",
            }}
          />
        </div>
      ) : (
        /* CLEAN MINIMALIST INVOICE DOCUMENT REPRESENTATION (When no file image attached) */
        <div className="invoice-card-content invoice-card-container w-full h-full border border-slate-300 bg-white p-3 flex flex-col justify-between text-xs leading-tight" style={{ backgroundColor: "#ffffff", color: "#0f172a" }}>
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-1.5" style={{ borderColor: "#e2e8f0" }}>
            <div>
              <span className="font-bold block text-sm" style={{ color: "#0284C7" }}>
                {invoice.invoiceType || "电子发票"}
              </span>
              <span className="text-[10px] font-mono" style={{ color: "#64748b" }}>
                {invoice.invoiceCode ? `代码: ${invoice.invoiceCode}` : "电子票据"}
              </span>
            </div>
            <div className="text-right font-mono text-[11px]">
              <div><span style={{ color: "#64748b" }}>号码: </span><span className="font-bold" style={{ color: "#0f172a" }}>{invoice.invoiceNumber}</span></div>
              <div><span style={{ color: "#64748b" }}>日期: </span><span style={{ color: "#334155" }}>{invoice.issueDate}</span></div>
            </div>
          </div>

          {/* Buyer & Seller */}
          <div className="grid grid-cols-2 gap-2 my-1 text-[11px]">
            <div className="p-1.5 rounded border" style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
              <span className="block text-[9px] font-bold" style={{ color: "#64748b" }}>购买方:</span>
              <span className="font-bold truncate block" style={{ color: "#0f172a" }}>{invoice.buyerName}</span>
              <span className="text-[9px] font-mono block truncate" style={{ color: "#94a3b8" }}>{invoice.buyerTaxId || "-"}</span>
            </div>
            <div className="p-1.5 rounded border" style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
              <span className="block text-[9px] font-bold" style={{ color: "#64748b" }}>销售方:</span>
              <span className="font-bold truncate block" style={{ color: "#0f172a" }}>{invoice.sellerName}</span>
              <span className="text-[9px] font-mono block truncate" style={{ color: "#94a3b8" }}>{invoice.sellerTaxId || "-"}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="flex justify-between items-center p-2 rounded border mt-auto" style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
            <span className="font-bold text-[11px]" style={{ color: "#0284C7" }}>价税合计:</span>
            <span className="font-black text-sm font-mono" style={{ color: "#E8000A" }}>
              ¥{invoice.totalAmountWithTax.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
