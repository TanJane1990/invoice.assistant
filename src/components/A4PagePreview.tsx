import React from "react";
import { InvoiceData, PaperType, PrintConfig } from "../types";
import { InvoiceCard } from "./InvoiceCard";
import { FilePlus2, ChevronLeft, ChevronRight, FileCheck } from "lucide-react";

interface A4PagePreviewProps {
  invoices: InvoiceData[];
  config: PrintConfig;
  zoom: number;
  onEditInvoice: (invoice: InvoiceData) => void;
  onDeleteInvoice: (id: string) => void;
  onOpenBatchImport: () => void;
}

export const A4PagePreview: React.FC<A4PagePreviewProps> = ({
  invoices,
  config,
  zoom,
  onEditInvoice,
  onDeleteInvoice,
  onOpenBatchImport,
}) => {
  // Calculate items per page based on gridMode
  const itemsPerPage = parseInt(config.gridMode, 10);

  interface PageData {
    invoices: InvoiceData[];
    groupTitle?: string;
  }

  const pages: PageData[] = [];

  // 分类识别函数：1.电子发票(电票)  2.火车票(铁路客票)  3.行程单及其他凭证(置于最后)
  const classifyInvoice = (inv: InvoiceData) => {
    const typeText = `${inv.invoiceType || ""} ${inv.category || ""} ${inv.remarks || ""}`;

    // 1. 火车票 / 铁路客票
    if (/火车票|铁路|高铁|动车/.test(typeText) || /火车|铁路/.test(inv.invoiceType || "")) {
      return {
        rank: 2,
        groupKey: "train",
        groupTitle: "火车票（铁路客票）",
        isSmallTicket: true,
      };
    }

    // 2. 行程单、机票行程单、出租车票、定额发票、其它非标准电票
    if (/行程单|机票|航空|出租车|定额|公交|客运/.test(typeText) && !/电子发票|增值税/.test(inv.invoiceType || "")) {
      return {
        rank: 3,
        groupKey: "itinerary_other",
        groupTitle: "行程单及其他凭证",
        isSmallTicket: false,
      };
    }

    // 3. 电子发票（电票）- 默认
    return {
      rank: 1,
      groupKey: "elec",
      groupTitle: "电子发票（电票）",
      isSmallTicket: false,
    };
  };

  if (config.sortBy === "invoice_type") {
    // 按照【按发票种类/票种】排序逻辑：分类并独立拼页排版（1:电票 -> 2:火车票 -> 3:行程单置于最后）
    const categoryBuckets: { [key: string]: { meta: ReturnType<typeof classifyInvoice>; invoices: InvoiceData[] } } = {
      elec: {
        meta: { rank: 1, groupKey: "elec", groupTitle: "电子发票（电票）", isSmallTicket: false },
        invoices: [],
      },
      train: {
        meta: { rank: 2, groupKey: "train", groupTitle: "火车票（铁路客票）", isSmallTicket: true },
        invoices: [],
      },
      itinerary_other: {
        meta: { rank: 3, groupKey: "itinerary_other", groupTitle: "行程单及其他凭证", isSmallTicket: false },
        invoices: [],
      },
    };

    invoices.forEach((inv) => {
      const catMeta = classifyInvoice(inv);
      categoryBuckets[catMeta.groupKey].invoices.push(inv);
    });

    // 依次按 rank (电票 -> 火车票 -> 行程单及其他) 处理拼页
    const orderedKeys = ["elec", "train", "itinerary_other"];

    orderedKeys.forEach((key) => {
      const bucket = categoryBuckets[key];
      if (bucket.invoices.length === 0) return;

      const groupItemsPerPage = bucket.meta.isSmallTicket ? Math.max(itemsPerPage, 6) : itemsPerPage;

      // 组内按日期旧到新排序
      const sortedGroup = [...bucket.invoices].sort((a, b) => a.issueDate.localeCompare(b.issueDate));

      for (let i = 0; i < sortedGroup.length; i += groupItemsPerPage) {
        pages.push({
          invoices: sortedGroup.slice(i, i + groupItemsPerPage),
          groupTitle: bucket.meta.isSmallTicket
            ? `${bucket.meta.groupTitle} (小票专用6张/页排版)`
            : key === "itinerary_other"
            ? `${bucket.meta.groupTitle} (已置于最后)`
            : bucket.meta.groupTitle,
        });
      }
    });
  } else {
    // 其他通用排序：全局连续拼页
    const sortedInvoices = [...invoices].sort((a, b) => {
      if (config.sortBy === "date_asc") return a.issueDate.localeCompare(b.issueDate);
      if (config.sortBy === "date_desc") return b.issueDate.localeCompare(a.issueDate);
      if (config.sortBy === "amount_desc") return b.totalAmountWithTax - a.totalAmountWithTax;
      if (config.sortBy === "category") return a.category.localeCompare(b.category);
      return 0;
    });

    for (let i = 0; i < sortedInvoices.length; i += itemsPerPage) {
      pages.push({
        invoices: sortedInvoices.slice(i, i + itemsPerPage),
      });
    }
  }

  // Margin CSS variable lookup
  const marginMap = {
    compact: "3mm",
    normal: "5mm",
    wide: "8mm",
  };
  const paddingValue = marginMap[config.marginSize] || "5mm";

  // Paper Dimensions setup
  const paperDimensions: Record<PaperType, { width: string; height: string; label: string }> = {
    A4: { width: "210mm", height: "297mm", label: "A4 标准纸" },
    A5: { width: "148mm", height: "210mm", label: "A5 便携纸" },
    B5: { width: "176mm", height: "250mm", label: "B5 常用纸" },
    InvoiceSpecial240: { width: "240mm", height: "140mm", label: "发票专用纸(240×140mm)" },
    InvoiceSpecial210: { width: "210mm", height: "140mm", label: "发票专用纸(210×140mm)" },
  };

  const isGrid1SingleTicket = config.gridMode === "1";
  const paperInfo = paperDimensions[config.paperType || "A4"] || paperDimensions.A4;
  const paperSize = { width: paperInfo.width, height: paperInfo.height };
  const isLandscape = config.orientation === "landscape";
  
  // When gridMode is "1" (单张发票原规), size precisely to 210x140mm (standard e-invoice ticket size)
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-slate-100/60 rounded-2xl border-2 border-dashed border-slate-300 my-8">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-4 shadow-sm">
          <FilePlus2 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">
          发票排版预览为空
        </h3>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          您尚未勾选或导入任何发票。请批量上传电子发票PDF/图片文件或选择本地Excel表格导入。
        </p>
        <button
          onClick={onOpenBatchImport}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-xl shadow-md transition-all cursor-pointer"
        >
          立即批量导入发票
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center py-8 px-4 overflow-x-auto min-h-screen">
      {/* Pages Container with Scaling Zoom */}
      <div
        className="transition-transform origin-top flex flex-col items-center space-y-12"
        style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
      >
        {pages.map((pageData, pageIdx) => {
          const pageInvoices = pageData.invoices;
          return (
            <div key={`page-${pageIdx}`} className="relative flex flex-col items-center">
              {/* On-screen Page Badge (hidden in print) */}
              <div
                className="no-print mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 px-2"
                style={{ width: pageWidth }}
              >
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  <span>
                    第 {pageIdx + 1} 页 / 共 {pages.length} 页 ({config.paperType || "A4"}{isLandscape ? "横向" : "纵向"})
                  </span>
                  {pageData.groupTitle && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded-md text-[11px] border border-red-200">
                      【按票种分类】{pageData.groupTitle}
                    </span>
                  )}
                </span>
                <span className="font-mono text-slate-400">
                  本页容纳 {pageInvoices.length} 张发票 ({config.gridMode}张/页排版)
                </span>
              </div>

            {/* Pixel-Accurate Printable Sheet */}
            <div
              className="a4-print-page bg-white shadow-xl hover:shadow-2xl border border-slate-200 transition-shadow relative"
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
                }}
              >
                {pageInvoices.map((inv, idx) => (
                  <div
                    key={inv.id}
                    className="w-full h-full flex flex-col flex-1"
                  >
                    <InvoiceCard
                      invoice={inv}
                      gridMode={pageInvoices.length > 4 ? "4" : config.gridMode}
                      showCropLines={config.showCropLines}
                      onEdit={onEditInvoice}
                      onDelete={onDeleteInvoice}
                      index={pageIdx * itemsPerPage + idx}
                    />
                  </div>
                ))}

                {/* Grid-Level Page Cut Guidelines */}
                {config.showCropLines && config.gridMode === "2" && (
                  <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 border-b-2 border-dashed border-slate-400 pointer-events-none flex items-center justify-end pr-2 z-10">
                    <span className="no-print print:hidden text-[9px] text-slate-500 bg-white/90 px-1 font-mono">
                      ✂ 剪裁边线
                    </span>
                  </div>
                )}

                {config.showCropLines && config.gridMode === "4" && (
                  <>
                    {/* Center Horizontal Line */}
                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 border-b-2 border-dashed border-slate-400 pointer-events-none flex items-center justify-end pr-2 z-10">
                      <span className="no-print print:hidden text-[9px] text-slate-500 bg-white/90 px-1 font-mono">
                        ✂ 剪裁边线
                      </span>
                    </div>
                    {/* Center Vertical Line */}
                    <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 border-r-2 border-dashed border-slate-400 pointer-events-none flex items-end justify-center pb-1 z-10">
                      <span className="no-print print:hidden text-[9px] text-slate-500 bg-white/90 px-0.5 font-mono">
                        ✂
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Page Footer Mark for Reference */}
              <div className="absolute bottom-2 right-4 text-[8px] text-slate-300 font-mono no-print">
                智能发票管理助手 · 页码 {pageIdx + 1}/{pages.length}
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};
