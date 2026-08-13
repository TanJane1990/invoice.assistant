import React from "react";
import {
  Scissors,
  File,
  SlidersHorizontal,
  RotateCcw,
  FileCheck2,
  Compass,
  ZoomIn,
  ZoomOut,
  Maximize2,
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
  theme?: "light" | "dark";
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
  const gridModes = [
    { id: "1", label: "1张/页 (单张原票 210×140mm)" },
    { id: "2", label: "2张/页 (上下 纵向)" },
    { id: "4", label: "4张/页 (2x2 横向)" },
  ];

  return (
    <div className="no-print border-b border-slate-800 bg-[#0B0F19] text-white sticky top-14 z-[60] px-4 py-2 flex items-center justify-between text-xs shrink-0 flex-wrap gap-y-2 transition-colors shadow-md">
      {/* 1. 拼页模式切换胶囊组 */}
      <div className="flex items-center space-x-2">
        <div className="p-1 rounded-xl flex items-center border bg-slate-900/90 border-slate-800">
          {gridModes.map((mode) => {
            const active = config.gridMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onChangeConfig({ gridMode: mode.id as any })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-[#e60023] text-white shadow-xs font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* 2. 剪裁线与带报销封面控制 */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onChangeConfig({ showCropLines: !config.showCropLines })}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              config.showCropLines
                ? "bg-slate-800 border-slate-700 text-white"
                : "bg-slate-950/60 border-slate-800 text-slate-400"
            }`}
          >
            <input
              type="checkbox"
              checked={config.showCropLines}
              onChange={() => {}}
              className="accent-[#e60023] rounded cursor-pointer"
            />
            <Scissors className="w-3.5 h-3.5 text-red-500" />
            <span>剪裁线</span>
          </button>

          <button
            onClick={() => onChangeConfig({ includeCoverPage: !config.includeCoverPage })}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              config.includeCoverPage
                ? "bg-slate-800 border-slate-700 text-white"
                : "bg-slate-950/60 border-slate-800 text-slate-400"
            }`}
          >
            <input
              type="checkbox"
              checked={config.includeCoverPage}
              onChange={() => {}}
              className="accent-[#e60023] rounded cursor-pointer"
            />
            <FileCheck2 className="w-3.5 h-3.5 text-amber-500" />
            <span>带报销封面</span>
          </button>
        </div>

        {/* 3. 页边距选择 */}
        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 font-semibold">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <span>页边距:</span>
          <select
            value={config.marginSize || config.margin || "normal"}
            onChange={(e) => onChangeConfig({ marginSize: e.target.value as any })}
            className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
          >
            <option value="none" className="bg-slate-900">无边距 (0mm)</option>
            <option value="compact" className="bg-slate-900">紧凑 (3mm)</option>
            <option value="normal" className="bg-slate-900">适中 (5mm)</option>
            <option value="wide" className="bg-slate-900">宽距 (10mm)</option>
          </select>
        </div>

        {/* 4. 排序方式选择 */}
        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 font-semibold">
          <span>排序:</span>
          <select
            value={config.sortBy}
            onChange={(e) => onChangeConfig({ sortBy: e.target.value as any })}
            className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
          >
            <option value="category" className="bg-slate-900">按发票种类/票种</option>
            <option value="date_asc" className="bg-slate-900">按开票时间 (升序)</option>
            <option value="amount_desc" className="bg-slate-900">按金额大小 (降序)</option>
          </select>
        </div>

        <button
          onClick={onResetOrder}
          title="重置默认排序"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 5. 纸张类型/方向与视图缩放统计 */}
      <div className="flex items-center space-x-3">
        {/* 纸张规格 */}
        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 font-semibold">
          <File className="w-3.5 h-3.5 text-slate-400" />
          <span>纸张类型:</span>
          <select
            value={config.paperType || "A4"}
            onChange={(e) => onChangeConfig({ paperType: e.target.value as PaperType })}
            className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
          >
            <option value="A4" className="bg-slate-900">A4 标准纸 (210×297mm)</option>
            <option value="A5" className="bg-slate-900">A5 纸张 (148×210mm)</option>
            <option value="B5" className="bg-slate-900">B5 纸张 (176×250mm)</option>
            <option value="InvoiceSpecial240" className="bg-slate-900">发票专用平铺纸 (240×140mm)</option>
          </select>
        </div>

        {/* 纸张方向 */}
        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 font-semibold">
          <Compass className="w-3.5 h-3.5 text-slate-400" />
          <span>纸张方向:</span>
          <select
            value={config.orientation}
            onChange={(e) => onChangeConfig({ orientation: e.target.value as any })}
            className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
          >
            <option value="landscape" className="bg-slate-900">横向 (Landscape)</option>
            <option value="portrait" className="bg-slate-900">纵向 (Portrait)</option>
          </select>
        </div>

        {/* 统计数字 */}
        <div className="font-mono text-slate-400 font-semibold">
          共 <span className="text-white font-bold">{totalInvoices}</span> 张发票 · 排{" "}
          <span className="text-white font-bold">{totalPages}</span> 页 {config.paperType || "A4"} · 合计:{" "}
          <span className="text-emerald-400 font-bold font-mono">
            ¥{totalAmount.toFixed(2)}
          </span>
        </div>

        {/* 视图缩放 */}
        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300">
          <button
            onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
            className="p-1 hover:text-white cursor-pointer"
            title="缩小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs px-1 font-bold">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
            className="p-1 hover:text-white cursor-pointer"
            title="放大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="p-1 hover:text-white cursor-pointer"
            title="重置100%"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
