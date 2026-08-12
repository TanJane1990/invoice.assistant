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
    <div className="no-print bg-[#121824] border-b border-[#232d3f] px-4 py-2 flex items-center justify-between text-xs shrink-0 flex-wrap gap-y-2 sticky top-14 z-[60] shadow-lg">
      {/* 左侧排版模式 */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center bg-[#0b0e14] p-1 rounded border border-[#232d3f] space-x-1">
          <button
            onClick={() => onChangeConfig({ gridMode: "1", orientation: "portrait" })}
            className={`px-2.5 py-1 rounded transition cursor-pointer ${
              config.gridMode === "1"
                ? "bg-[#e60023] text-white font-medium shadow-xs"
                : "text-gray-400 hover:text-white"
            }`}
          >
            1张/页 (单张原票 210×140mm)
          </button>
          <button
            onClick={() => onChangeConfig({ gridMode: "2", orientation: "portrait" })}
            className={`px-2.5 py-1 rounded transition cursor-pointer ${
              config.gridMode === "2"
                ? "bg-[#e60023] text-white font-medium shadow-xs"
                : "text-gray-400 hover:text-white"
            }`}
          >
            2张/页 (上下 纵向)
          </button>
          <button
            onClick={() => onChangeConfig({ gridMode: "4", orientation: "landscape" })}
            className={`px-2.5 py-1 rounded transition cursor-pointer ${
              config.gridMode === "4"
                ? "bg-[#e60023] text-white font-medium shadow-xs"
                : "text-gray-400 hover:text-white"
            }`}
          >
            4张/页 (2x2 横向)
          </button>
        </div>

        <div className="h-4 w-[1px] bg-[#232d3f] mx-1"></div>

        {/* 选框配置 */}
        <label className="flex items-center space-x-1 cursor-pointer bg-[#1a2232] px-2.5 py-1 rounded border border-[#232d3f] hover:border-[#334155] transition">
          <input
            type="checkbox"
            checked={config.showCropLines}
            onChange={(e) => onChangeConfig({ showCropLines: e.target.checked })}
            className="accent-[#e60023] rounded cursor-pointer"
          />
          <Scissors className="w-3 h-3 text-red-400" />
          <span className="text-gray-200">剪裁线</span>
        </label>

        <label className="flex items-center space-x-1 cursor-pointer bg-[#1a2232] px-2.5 py-1 rounded border border-[#232d3f] hover:border-[#334155] transition">
          <input
            type="checkbox"
            checked={config.includeCoverPage}
            onChange={(e) => onChangeConfig({ includeCoverPage: e.target.checked })}
            className="accent-[#e60023] rounded cursor-pointer"
          />
          <File className="w-3 h-3 text-yellow-400" />
          <span className="text-gray-200">带报销封面</span>
        </label>

        {/* 下拉菜单：边距 & 排序 */}
        <div className="flex items-center space-x-1 bg-[#1a2232] px-2.5 py-1 rounded border border-[#232d3f]">
          <SlidersHorizontal className="w-3 h-3 text-gray-400" />
          <span className="text-gray-400">页边距:</span>
          <select
            value={config.margin || "normal"}
            onChange={(e) => onChangeConfig({ margin: e.target.value as any })}
            className="bg-transparent text-white outline-none cursor-pointer font-medium"
          >
            <option value="normal" className="bg-[#121824] text-white">适中 (5mm)</option>
            <option value="none" className="bg-[#121824] text-white">无边距 (0mm)</option>
            <option value="compact" className="bg-[#121824] text-white">紧凑 (3mm)</option>
            <option value="wide" className="bg-[#121824] text-white">宽边距 (10mm)</option>
          </select>
        </div>

        <div className="flex items-center space-x-1 bg-[#1a2232] px-2.5 py-1 rounded border border-[#232d3f]">
          <span className="text-gray-400">排序:</span>
          <select
            value={config.sortBy || "category"}
            onChange={(e) => onChangeConfig({ sortBy: e.target.value as any })}
            className="bg-transparent text-white outline-none cursor-pointer font-medium"
          >
            <option value="category" className="bg-[#121824] text-white">按发票种类/票种</option>
            <option value="date" className="bg-[#121824] text-white">按开票日期</option>
            <option value="amount" className="bg-[#121824] text-white">按发票金额</option>
          </select>
        </div>

        <button
          onClick={onResetOrder}
          className="bg-[#1a2232] p-1.5 rounded border border-[#232d3f] hover:bg-[#232d3f] text-gray-400 hover:text-white cursor-pointer transition"
          title="复位拖拽顺序"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* 右侧纸张与状态统计 */}
      <div className="flex items-center space-x-3 text-gray-300">
        <div className="flex items-center space-x-1 bg-[#1a2232] px-2.5 py-1 rounded border border-[#232d3f]">
          <FileCheck2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">纸张类型:</span>
          <select
            value={config.paperType || "A4"}
            onChange={(e) => onChangeConfig({ paperType: e.target.value as PaperType })}
            className="bg-transparent text-white font-medium outline-none cursor-pointer"
          >
            <option value="A4" className="bg-[#121824] text-white">A4 标准纸 (210×297mm)</option>
            <option value="A5" className="bg-[#121824] text-white">A5 便携纸 (148×210mm)</option>
            <option value="B5" className="bg-[#121824] text-white">B5 常用纸 (176×250mm)</option>
            <option value="InvoiceSpecial240" className="bg-[#121824] text-white">发票专用纸 (240×140mm)</option>
            <option value="InvoiceSpecial210" className="bg-[#121824] text-white">发票专用纸 (210×140mm)</option>
          </select>
        </div>

        <div className="flex items-center space-x-1 bg-[#1a2232] px-2.5 py-1 rounded border border-[#232d3f]">
          <Compass className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">纸张方向:</span>
          <select
            value={config.orientation || "portrait"}
            onChange={(e) => onChangeConfig({ orientation: e.target.value as "portrait" | "landscape" })}
            className="bg-transparent text-white font-medium outline-none cursor-pointer"
          >
            <option value="landscape" className="bg-[#121824] text-white">横向 (Landscape)</option>
            <option value="portrait" className="bg-[#121824] text-white">纵向 (Portrait)</option>
          </select>
        </div>

        {/* 数据统计 */}
        <div className="text-xs font-mono">
          共 <span className="text-yellow-400 font-bold">{totalInvoices}</span> 张发票 · 排 <span class="text-yellow-400 font-bold">{totalPages}</span> 页 A4 · 合计: <span className="text-[#00c875] font-bold">¥{totalAmount.toFixed(2)}</span>
        </div>

        {/* 缩放控制 */}
        <div className="flex items-center space-x-1 bg-[#1a2232] px-2 py-0.5 rounded border border-[#232d3f] text-gray-400">
          <button onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} className="hover:text-white cursor-pointer" title="放大预览">
            <ZoomIn className="w-3 h-3" />
          </button>
          <span className="text-[11px] font-mono px-1 font-semibold text-gray-200">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} className="hover:text-white cursor-pointer" title="缩小预览">
            <ZoomOut className="w-3 h-3" />
          </button>
          <button onClick={() => setZoom(1.0)} className="hover:text-white ml-1 cursor-pointer" title="重置100%">
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
