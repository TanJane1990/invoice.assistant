import React from "react";
import {
  Grid,
  Scissors,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileCheck,
  RotateCcw,
  FileText,
  Compass,
} from "lucide-react";
import { PaperType, PrintConfig } from "../types";

interface PrintLayoutToolbarProps {
  config: PrintConfig;
  onChangeConfig: (newConfig: Partial<PrintConfig>) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  totalInvoices: number;
  totalPages: number;
  totalAmount: number;
  onResetOrder: () => void;
}

export const PrintLayoutToolbar: React.FC<PrintLayoutToolbarProps> = ({
  config,
  onChangeConfig,
  zoom,
  setZoom,
  totalInvoices,
  totalPages,
  totalAmount,
  onResetOrder,
}) => {
  return (
    <div className="no-print bg-slate-900 text-slate-100 border-b border-slate-800 px-4 py-3 sticky top-16 z-30 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Layout Selectors (1/2/4张拼页) */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700/80">
            <button
              onClick={() => onChangeConfig({ gridMode: "1", orientation: "portrait" })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                config.gridMode === "1"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              1张/页 (单张原票 210×140mm)
            </button>
            <button
              onClick={() => onChangeConfig({ gridMode: "2", orientation: "portrait" })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                config.gridMode === "2"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              2张/页 (上下 纵向)
            </button>
            <button
              onClick={() => onChangeConfig({ gridMode: "4", orientation: "landscape" })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                config.gridMode === "4"
                  ? "bg-red-600 text-white shadow-xs ring-1 ring-red-400"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              4张/页 (2×2 横向)
            </button>
          </div>
        </div>

        {/* Paper Size & Orientation Section */}
        <div className="flex flex-wrap items-center space-x-2 text-xs">
          {/* Paper Type Select */}
          <div className="flex items-center space-x-1 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/60">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">纸张类型:</span>
            <select
              value={config.paperType || "A4"}
              onChange={(e) =>
                onChangeConfig({ paperType: e.target.value as PaperType })
              }
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-bold"
            >
              <option value="A4" className="bg-slate-900 text-slate-200">
                A4 标准纸 (210×297mm)
              </option>
              <option value="A5" className="bg-slate-900 text-slate-200">
                A5 便携纸 (148×210mm)
              </option>
              <option value="B5" className="bg-slate-900 text-slate-200">
                B5 常用纸 (176×250mm)
              </option>
              <option value="InvoiceSpecial240" className="bg-slate-900 text-slate-200">
                发票专用纸 (240×140mm 针式/套打)
              </option>
              <option value="InvoiceSpecial210" className="bg-slate-900 text-slate-200">
                发票专用纸 (210×140mm 二等分)
              </option>
            </select>
          </div>

          {/* Orientation Select */}
          <div className="flex items-center space-x-1 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/60">
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">纸张方向:</span>
            <select
              value={config.orientation || "portrait"}
              onChange={(e) =>
                onChangeConfig({
                  orientation: e.target.value as "portrait" | "landscape",
                })
              }
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-bold"
            >
              <option value="portrait" className="bg-slate-900 text-slate-200">
                纵向 (Portrait)
              </option>
              <option value="landscape" className="bg-slate-900 text-slate-200">
                横向 (Landscape)
              </option>
            </select>
          </div>
        </div>

        {/* Center: Layout Options (Crop line, Margins, Cover, Sort) */}
        <div className="flex flex-wrap items-center space-x-2 text-xs">
          {/* Show Crop Lines Toggle */}
          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1.5 rounded-md border border-slate-700/60">
            <input
              type="checkbox"
              checked={config.showCropLines}
              onChange={(e) =>
                onChangeConfig({ showCropLines: e.target.checked })
              }
              className="accent-red-500 rounded text-red-600 focus:ring-0 cursor-pointer"
            />
            <Scissors className="w-3.5 h-3.5 text-slate-400" />
            <span>剪裁线</span>
          </label>

          {/* Include Reimbursement Cover */}
          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1.5 rounded-md border border-slate-700/60">
            <input
              type="checkbox"
              checked={config.includeCoverPage}
              onChange={(e) =>
                onChangeConfig({ includeCoverPage: e.target.checked })
              }
              className="accent-red-500 rounded text-red-600 focus:ring-0 cursor-pointer"
            />
            <FileCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>带报销封面</span>
          </label>

          {/* Page Margins */}
          <div className="flex items-center space-x-1 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/60">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">页边距:</span>
            <select
              value={config.marginSize}
              onChange={(e) =>
                onChangeConfig({ marginSize: e.target.value as any })
              }
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="compact" className="bg-slate-900 text-slate-200">
                紧凑 (3mm)
              </option>
              <option value="normal" className="bg-slate-900 text-slate-200">
                适中 (5mm)
              </option>
              <option value="wide" className="bg-slate-900 text-slate-200">
                宽裕 (8mm)
              </option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center space-x-1 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/60">
            <span className="text-slate-400">排序:</span>
            <select
              value={config.sortBy}
              onChange={(e) =>
                onChangeConfig({ sortBy: e.target.value as any })
              }
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="date_asc" className="bg-slate-900 text-slate-200">
                按开票日期 (由旧到新)
              </option>
              <option value="date_desc" className="bg-slate-900 text-slate-200">
                按开票日期 (由新到旧)
              </option>
              <option
                value="amount_desc"
                className="bg-slate-900 text-slate-200"
              >
                按金额高低
              </option>
              <option value="category" className="bg-slate-900 text-slate-200">
                按费用类别
              </option>
              <option value="invoice_type" className="bg-slate-900 text-slate-200">
                按发票种类/票种
              </option>
            </select>
          </div>

          <button
            onClick={onResetOrder}
            title="恢复默认排序"
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-md hover:bg-slate-700 border border-slate-700/60 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Zoom Controls & Summary Stats */}
        <div className="flex items-center space-x-3">
          {/* Page Stats */}
          <div className="text-xs text-slate-300 border-r border-slate-700 pr-3 hidden lg:block">
            共 <span className="text-amber-400 font-bold">{totalInvoices}</span> 张发票 · 排 <span className="text-red-400 font-bold">{totalPages}</span> 页 {config.paperType || "A4"} · 合计: <span className="text-emerald-400 font-bold">¥{totalAmount.toFixed(2)}</span>
          </div>

          {/* Zoom Level */}
          <div className="flex items-center space-x-1 bg-slate-800 px-2 py-1 rounded-md border border-slate-700/60">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
              title="缩小预览"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono w-10 text-center text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
              title="放大预览"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
              title="复位100%"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
