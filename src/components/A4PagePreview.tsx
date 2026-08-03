import React from "react";
import { InvoiceData, PrintConfig } from "../types";
import { InvoiceCard } from "./InvoiceCard";
import { FilePlus2 } from "lucide-react";

interface A4PagePreviewProps {
  invoices: InvoiceData[];
  config: PrintConfig;
  showCropLines: boolean;
  onEditInvoice?: (invoice: InvoiceData) => void;
  onDeleteInvoice?: (id: string) => void;
  onOpenBatchImport?: () => void;
  zoom?: number;
}

// Paper Sizes in Millimeters (mm)
const PAPER_SIZES: Record<string, { width: string; height: string }> = {
  A4: { width: "210mm", height: "297mm" },
  A5: { width: "148mm", height: "210mm" },
  B5: { width: "176mm", height: "250mm" },
  InvoiceSpecial240: { width: "240mm", height: "140mm" },
  InvoiceSpecial210: { width: "210mm", height: "140mm" },
};

// Margins in Millimeters
const MARGIN_SIZES: Record<string, string> = {
  none: "0mm",
  compact: "3mm",
  normal: "5mm",
  wide: "10mm",
};

export const A4PagePreview: React.FC<A4PagePreviewProps> = ({
  invoices,
  config,
  showCropLines,
  onEditInvoice,
  onDeleteInvoice,
  onOpenBatchImport,
  zoom = 1.0,
}) => {
  const paperKey = config.paperType || "A4";
  const paperSize = PAPER_SIZES[paperKey] || PAPER_SIZES.A4;
  const isLandscape = config.orientation === "landscape";
  const paddingValue = MARGIN_SIZES[config.margin || "normal"] || "5mm";

  const isGrid1SingleTicket = config.gridMode === "1";

  // Calculate pages based on gridMode
  const itemsPerPage =
    config.gridMode === "1"
      ? 1
      : config.gridMode === "2"
      ? 2
      : config.gridMode === "4"
      ? 4
      : 2;

  // Group invoices if sortBy is category
  const pages = React.useMemo(() => {
    if (config.sortBy === "category") {
      const grouped: Record<string, InvoiceData[]> = {};
      invoices.forEach((inv) => {
        const cat = inv.category || "其他";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(inv);
      });

      const pageList: Array<{ groupTitle?: string; invoices: InvoiceData[] }> = [];
      Object.entries(grouped).forEach(([catTitle, catInvoices]) => {
        for (let i = 0; i < catInvoices.length; i += itemsPerPage) {
          pageList.push({
            groupTitle: catTitle,
            invoices: catInvoices.slice(i, i + itemsPerPage),
          });
        }
      });
      return pageList;
    } else {
      const sorted = [...invoices];
      if (config.sortBy === "date") {
        sorted.sort((a, b) => (a.issueDate || "").localeCompare(b.issueDate || ""));
      } else if (config.sortBy === "amount") {
        sorted.sort((a, b) => b.totalAmountWithTax - a.totalAmountWithTax);
      }

      const pageList: Array<{ groupTitle?: string; invoices: InvoiceData[] }> = [];
      for (let i = 0; i < sorted.length; i += itemsPerPage) {
        pageList.push({
          invoices: sorted.slice(i, i + itemsPerPage),
        });
      }
      return pageList;
    }
  }, [invoices, config.sortBy, itemsPerPage]);

  const pageWidth = isGrid1SingleTicket
    ? "210mm"
    : isLandscape
    ? paperSize.height
    : paperSize.width;
  const pageHeight = isGrid1SingleTicket
    ? "140mm"
    : isLandscape
    ? paperSize.width
    : paperSize.height;

  if (invoices.length === 0) {
    return (
      <div className="w-full flex justify-center py-16 px-4">
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-[#0E1422] rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800 max-w-xl w-full shadow-2xs">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400 mb-4 shadow-2xs">
            <FilePlus2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
            发票排版预览为空
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
            您尚未勾选或导入任何发票。请批量上传电子发票PDF/图片文件或选择本地Excel表格导入。
          </p>
          <button
            onClick={onOpenBatchImport}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-200 dark:shadow-none transition-all cursor-pointer"
          >
            立即批量导入发票
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center py-6 px-4 overflow-x-auto min-h-screen">
      {/* Pages Container with Scaling Zoom */}
      <div
        className="transition-transform origin-top flex flex-col items-center space-y-10"
        style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
      >
        {pages.map((pageData, pageIdx) => {
          const pageInvoices = pageData.invoices;
          return (
            <div key={`page-${pageIdx}`} className="relative flex flex-col items-center">
              {/* On-screen Page Badge (hidden in print) */}
              <div
                className="no-print mb-2 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 px-1"
                style={{ width: pageWidth }}
              >
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  <span>
                    第 {pageIdx + 1} 页 / 共 {pages.length} 页 ({config.paperType || "A4"}{isLandscape ? "横向" : "纵向"})
                  </span>
                  {pageData.groupTitle && (
                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 font-bold rounded-md text-[11px] border border-red-200 dark:border-red-800">
                      【按票种分类】{pageData.groupTitle}
                    </span>
                  )}
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  本页容纳 {pageInvoices.length} 张发票 ({config.gridMode}张/页排版)
                </span>
              </div>

              {/* Pixel-Accurate Printable Sheet */}
              <div
                className="a4-print-page bg-white text-slate-900 shadow-xl hover:shadow-2xl border border-slate-200 dark:border-slate-700 transition-shadow relative"
                style={{
                  width: pageWidth,
                  minHeight: pageHeight,
                  padding: paddingValue,
                  boxSizing: "border-box",
                  pageBreakAfter: "always",
                  breakAfter: "page",
                }}
              >
                {/* Grid Layout inside Page */}
                <div
                  className={`w-full h-full relative ${
                    pageInvoices.length > 4
                      ? "grid grid-cols-2 grid-rows-3 gap-3"
                      : config.gridMode === "1"
                      ? "flex flex-col items-stretch justify-stretch w-full h-full"
                      : config.gridMode === "2"
                      ? "grid grid-cols-1 grid-rows-2 gap-4"
                      : "grid grid-cols-2 grid-rows-2 gap-4"
                  }`}
                  style={{
                    minHeight: `calc(${pageHeight} - (${paddingValue} * 2))`,
                    height: `calc(${pageHeight} - (${paddingValue} * 2))`,
                  }}
                >
                  {pageInvoices.map((invoice, idx) => (
                    <InvoiceCard
                      key={invoice.id}
                      invoice={invoice}
                      gridMode={config.gridMode}
                      showCropLines={showCropLines}
                      onEdit={onEditInvoice}
                      onDelete={onDeleteInvoice}
                      index={pageIdx * itemsPerPage + idx}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
