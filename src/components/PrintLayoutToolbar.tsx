import React from "react";
import {
  Scissors,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  FileText,
  Compass,
  ArrowUpDown,
  LayoutGrid,
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
    <div className="no-print bg-[#0B0F19] text-slate-100 border-b border-slate-800 px-4 py-2.5 sticky top-16 z-[60] shadow-xl overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Grid Layout Mode Buttons */}
        <div className="flex items-center space-x-1.5">
          <div className="flex bg-[#131B2E] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onChangeConfig({ gridMode: "1", orientation: "portrait" })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                config.gridMode === "1"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              1张/页 (单张原票 210×140mm)
            </button>
            <button
              onClick={() => onChangeConfig({ gridMode: "2", orientation: "portrait" })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                config.gridMode === "2"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              2张/页 (上下 纵向)
            </button>
            <button
              onClick={() => onChangeConfig({ gridMode: "4", orientation: "landscape" })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                config.gridMode === "4"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              4张/页 (2×2 横向)
            </button>
          </div>
        </div>

        {/* Paper Specs & Orientation */}
        <div className="flex items-center space-x-2 text-xs">
          {/* Paper Type Select */}
          <div className="flex items-center space-x-1.5 bg-[#131B2E] px-3 py-1.5 rounded-xl border border-slate-800">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">纸张类型:</span>
            <select
              value={config.paperType || "A4"}
              onChange={(e) => onChangeConfig({ paperType: e.target.value as PaperType })}
              className="bg-transparent text-slate-100 text-xs font-extrabold focus:outline-none cursor-pointer"
            >
              <option value="A4" className="bg-[#0B0F19] text-white">A4 标准纸 (210×297mm)</option>
              <option value="A5" className="bg-[#0B0F19] text-white">A5 便携纸 (148×210mm)</option>
              <option value="B5" className="bg-[#0B0F19] text-white">B5 常用纸 (176×250mm)</option>
              <option value="InvoiceSpecial240" className="bg-[#0B0F19] text-white">发票专用纸 (240×140mm)</option>
              <option value="InvoiceSpecial210" className="bg-[#0B0F19] text-white">发票专用纸 (210×140mm)</option>
            </select>
          </div>

          {/* Orientation Select */}
          <div className="flex items-center space-x-1.5 bg-[#131B2E] px-3 py-1.5 rounded-xl border border-slate-800">
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">纸张方向:</span>
            <select
              value={config.orientation || "portrait"}
              onChange={(e) => onChangeConfig({ orientation: e.target.value as "portrait" | "landscape" })}
              className="bg-transparent text-slate-100 text-xs font-extrabold focus:outline-none cursor-pointer"
            >
              <option value="portrait" className="bg-[#0B0F19] text-white">纵向 (Portrait)</option>
              <option value="landscape" className="bg-[#0B0F19] text-white">横向 (Landscape)</option>
            </select>
          </div>
        </div>

        {/* Options (Crop line, Margins, Sort, Cover) */}
        <div className="flex items-center space-x-2 text-xs">
          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-200 bg-[#131B2E] px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={config.showCropLines}
              onChange={(e) => onChangeConfig({ showCropLines: e.target.checked })}
              className="accent-red-600 rounded cursor-pointer"
            />
            <Scissors className="w-3.5 h-3.5 text-slate-400" />
            <span>剪裁线</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-200 bg-[#131B2E] px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={config.includeCoverPage}
              onChange={(e) => onChangeConfig({ includeCoverPage: e.target.checked })}
              className="accent-red-600 rounded cursor-pointer"
            />
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>带报销封面</span>
          </label>

          {/* Margin select */}
          <div className="flex items-center space-x-1 bg-[#131B2E] px-2.5 py-1.5 rounded-xl border border-slate-800">
            <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">页边距:</span>
            <select
              value={config.margin || "normal"}
              onChange={(e) => onChangeConfig({ margin: e.target.value as any })}
              className="bg-transparent text-slate-100 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="none" className="bg-[#0B0F19] text-white">无边距 (0mm)</option>
              <option value="compact" className="bg-[#0B0F19] text-white">紧凑 (3mm)</option>
              <option value="normal" className="bg-[#0B0F19] text-white">适中 (5mm)</option>
              <option value="wide" className="bg-[#0B0F19] text-white">宽大 (10mm)</option>
            </select>
          </div>

          {/* Sort order */}
          <div className="flex items-center space-x-1 bg-[#131B2E] px-2.5 py-1.5 rounded-xl border border-slate-800">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">排序:</span>
            <select
              value={config.sortBy || "category"}
              onChange={(e) => onChangeConfig({ sortBy: e.target.value as any })}
              className="bg-transparent text-slate-100 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="category" className="bg-[#0B0F19] text-white">按发票种类/票种</option>
              <option value="date" className="bg-[#0B0F19] text-white">按开票日期顺序</option>
              <option value="amount" className="bg-[#0B0F19] text-white">按金额从大到小</option>
              <option value="manual" className="bg-[#0B0F19] text-white">保持拖拽自定义顺序</option>
            </select>
          </div>

          <button
            onClick={onResetOrder}
            className="p-1.5 bg-[#131B2E] hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 cursor-pointer"
            title="复位拖拽顺序"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Stats Summary & Zoom */}
        <div className="flex items-center space-x-3 text-xs font-medium">
          <div className="text-slate-300">
            共 <span className="font-extrabold text-white">{totalInvoices}</span> 张发票 · 排{" "}
            <span className="font-extrabold text-white">{totalPages}</span> 页 A4 · 合计:{" "}
            <span className="font-extrabold text-emerald-400 font-mono text-sm">¥{totalAmount.toFixed(2)}</span>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-[#131B2E] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              title="缩小预览"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold px-1.5 text-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              title="放大预览"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              title="重置100%"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
