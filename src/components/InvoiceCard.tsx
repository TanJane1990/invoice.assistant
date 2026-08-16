import React, { useState, useEffect } from "react";
import { InvoiceData, GridMode } from "../types";
import { Trash2 } from "lucide-react";
import { convertPdfToImageDataUrl } from "../utils/pdfToImage";

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
        invoice.fileUrl.startsWith("data:image/") ||
        invoice.fileUrl.startsWith("blob:") ||
        invoice.fileUrl.startsWith("http")
      ) {
        setRenderedImgUrl(invoice.fileUrl);
      } else if (
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
      {/* Delete Action (Screen only, strictly hidden in print) */}
      {onDelete && (
        <div className="no-print print:hidden absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(invoice.id);
            }}
            className="p-1 bg-red-600 hover:bg-red-700 text-white rounded shadow-sm cursor-pointer"
            title="删除发票"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* RENDER REAL ORIGINAL INVOICE FILE IF AVAILABLE */}
      {renderedImgUrl ? (
        <div className="w-full h-full flex items-center justify-center overflow-hidden bg-white p-0">
          <img
            src={renderedImgUrl}
            alt={invoice.fileName || "发票原票件"}
            className={`w-full h-full pointer-events-none ${
              gridMode === "4" ? "object-fill" : "object-contain"
            }`}
          />
        </div>
      ) : (
        /* CLEAN MINIMALIST INVOICE DOCUMENT REPRESENTATION (When no file image attached) */
        <div className="w-full h-full border border-slate-300 bg-white p-3 flex flex-col justify-between text-xs leading-tight">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-1.5">
            <div>
              <span className="font-bold text-slate-900 block text-sm">
                {invoice.invoiceType || "电子发票"}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {invoice.invoiceCode ? `代码: ${invoice.invoiceCode}` : ""}
              </span>
            </div>
            <div className="text-right font-mono text-[11px]">
              <div><span className="text-slate-400">号码: </span><span className="font-bold">{invoice.invoiceNumber}</span></div>
              <div><span className="text-slate-400">日期: </span><span>{invoice.issueDate}</span></div>
            </div>
          </div>

          {/* Buyer & Seller */}
          <div className="grid grid-cols-2 gap-2 my-1 text-[11px]">
            <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
              <span className="text-slate-400 block text-[9px]">购买方:</span>
              <span className="font-bold text-slate-800 truncate block">{invoice.buyerName}</span>
              <span className="text-[9px] font-mono text-slate-500 block truncate">{invoice.buyerTaxId || "-"}</span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
              <span className="text-slate-400 block text-[9px]">销售方:</span>
              <span className="font-bold text-slate-800 truncate block">{invoice.sellerName}</span>
              <span className="text-[9px] font-mono text-slate-500 block truncate">{invoice.sellerTaxId || "-"}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200 mt-auto">
            <span className="text-slate-600 font-semibold text-[11px]">价税合计:</span>
            <span className="font-extrabold text-red-700 text-sm font-mono">
              ¥{invoice.totalAmountWithTax.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
