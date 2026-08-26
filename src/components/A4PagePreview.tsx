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
  theme?: "light" | "dark";
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
  theme = "dark",
}) => {
  const isDark = theme === "dark";
  const paperKey = config.paperType || "A4";
  const paperSize = PAPER_SIZES[paperKey] || PAPER_SIZES.A4;
  const isLandscape = config.orientation === "landscape";
  const paddingValue = MARGIN_SIZES[config.marginSize || config.margin || "normal"] || "5mm";

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
      if (config.sortBy === "date_asc") {
        sorted.sort((a, b) => (a.issueDate || "").localeCompare(b.issueDate || ""));
      } else if (config.sortBy === "amount_desc") {
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
      <main className="flex-1 p-6 flex items-center justify-center overflow-auto relative min-h-[calc(100vh-7.5rem)] bg-[#0E172B]">
        <div className="p-12 text-center rounded-2xl border border-[#1E293B] bg-[#121827] shadow-xl max-w-xl w-full">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-950/60 text-[#E8000A] flex items-center justify-center shadow-xs">
            <FilePlus2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold !text-white">
            发票排版预览为空
          </h3>
          <p className="text-xs mt-1 mb-6 !text-[#94A3B8] max-w-md mx-auto leading-relaxed font-medium">
            您尚未勾选或导入任何发票。请批量上传电子发票 PDF/图片文件或选择本地 Excel 表格导入。
          </p>
          <button
            onClick={onOpenBatchImport}
            className="px-6 py-2.5 bg-[#E8000A] hover:bg-[#C80009] !text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center space-x-1.5"
          >
            <span>立即批量导入发票</span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <div
      className={`w-full flex flex-col items-center py-6 px-4 overflow-x-auto min-h-screen relative z-0 transition-colors ${
        isDark ? "bg-[#0E172B]" : "bg-[#F3F5F9]"
      }`}
    >
      {/* 动态物理打印方向控制：根据用户选择的纸张类型和方向生成 @page 规则 */}
      <style>{`
        @media print {
          @page {
            size: ${
              isGrid1SingleTicket
                ? "210mm 140mm"
                : (() => {
                    // 标准纸张使用 CSS 命名
                    const standardNames: Record<string, string> = { A4: "A4", A5: "A5", B5: "JIS-B5" };
                    const stdName = standardNames[paperKey];
                    if (stdName) {
                      return `${stdName} ${isLandscape ? "landscape" : "portrait"}`;
                    }
                    // 非标纸张使用精确物理尺寸 (宽 x 高)
                    const w = paperSize.width;
                    const h = paperSize.height;
                    return isLandscape ? `${h} ${w}` : `${w} ${h}`;
                  })()
            };
            margin: 0;
          }
        }
      `}</style>
      {/* Pages Container with Scaling Zoom */}
      <div
        className="transition-transform origin-top flex flex-col items-center space-y-10 relative z-0"
        style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
      >
        {pages.map((pageData, pageIdx) => {
          const pageInvoices = pageData.invoices;
          return (
            <div key={`page-${pageIdx}`} className="relative flex flex-col items-center z-0">
              {/* On-screen Page Badge (hidden in print) */}
              <div
                className={`no-print mb-2 flex items-center justify-between text-xs font-semibold px-2 py-1 rounded-md ${
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
                }`}
                style={{ width: pageWidth }}
              >
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  <span>
                    第 {pageIdx + 1} 页 / 共 {pages.length} 页 ({config.paperType || "A4"}
                    {isLandscape ? "横向" : "纵向"})
                  </span>
                  {pageData.groupTitle && (
                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 font-bold rounded text-[11px] border border-red-200 dark:border-red-800">
                      【按票种分类】{pageData.groupTitle}
                    </span>
                  )}
                </span>
                <span className="font-mono">
                  本页容纳 {pageInvoices.length} 张发票 ({config.gridMode}张/页排版)
                </span>
              </div>

              {/* Pixel-Accurate Printable Sheet */}
              <div
                className={`mx-auto bg-white transition-all print:shadow-none a4-print-page ${
                  isLandscape ? "page-landscape" : "page-portrait"
                } relative z-0 ${
                  isDark
                    ? "shadow-[0_10px_30px_rgba(0,0,0,0.6)] ring-1 ring-slate-800"
                    : "shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-200"
                }`}
                style={{
                  width: pageWidth,
                  height: pageHeight,
                  minHeight: pageHeight,
                  maxHeight: pageHeight,
                  padding: paddingValue,
                  boxSizing: "border-box",
                  pageBreakAfter: pageIdx === pages.length - 1 ? "auto" : "always",
                  breakAfter: pageIdx === pages.length - 1 ? "auto" : "page",
                  overflow: "hidden",
                }}
              >
                {/* 1:1 剪裁线：居中穿过页面中轴线的分割虚线 (1:1 匹配 media_1786901840126.png) */}
                {showCropLines && (
                  <>
                    {(config.gridMode === "2" || config.gridMode === "4") && (
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-b border-dashed border-sky-400/80 pointer-events-none z-20" />
                    )}
                    {config.gridMode === "4" && (
                      <>
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-r border-dashed border-sky-400/80 pointer-events-none z-20" />
                        <div className="no-print print:hidden absolute right-3 top-1/2 translate-y-1.5 text-[10px] text-slate-400 font-mono flex items-center space-x-1 pointer-events-none z-20">
                          <span>✂ 剪裁边线</span>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Grid Layout inside Page */}
                <div
                  className={`w-full h-full relative z-0 ${
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
