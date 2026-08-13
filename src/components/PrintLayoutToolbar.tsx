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
  theme = "dark",
}) => {
  const isDark = theme === "dark";

  const gridModes = [
    { id: "1", label: "1张/页 (单张原票 210×140mm)" },
    { id: "2", label: "2张/页 (上下 纵向)" },
    { id: "4", label: "4张/页 (2x2 横向)" },
  ];

  return (
    <div
      className={`no-print border-b sticky top-14 z-[60] px-4 py-2 flex items-center justify-between text-xs shrink-0 flex-wrap gap-y-2 transition-colors shadow-lg ${
        isDark
          ? "bg-[#121824] border-[#232d3f] text-slate-100"
          : "bg-white border-slate-200/90 shadow-2xs text-slate-900"
      }`}
    >
      {/* 左侧排版模式 */}
      <div className="flex items-center space-x-2">
        <div
          className={`p-1 rounded-xl flex items-center border space-x-1 ${
            isDark ? "bg-[#0b0e14] border-[#232d3f]" : "bg-slate-100 border-slate-200/80"
          }`}
        >
          {gridModes.map((mode) => {
            const active = config.gridMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() =>
                  onChangeConfig({
                    gridMode: mode.id as any,
                    orientation: mode.id === "4" ? "landscape" : "portrait",
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-[#e60023] text-white shadow-xs font-bold"
                    : isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        <div className={`h-4 w-[1px] mx-1 ${isDark ? "bg-[#232d3f]" : "bg-slate-200"}`}></div>

        {/* 选框配置 */}
        <label
          className={`flex items-center space-x-1 cursor-pointer px-2.5 py-1.5 rounded-lg border transition-all ${
            isDark
              ? "bg-[#1a2232] border-[#232d3f] text-gray-200 hover:border-slate-700"
              : "bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300"
          }`}
        >
          <input
            type="checkbox"
            checked={config.showCropLines}
            onChange={(e) => onChangeConfig({ showCropLines: e.target.checked })}
            className="accent-[#e60023] rounded cursor-pointer"
          />
          <Scissors className="w-3.5 h-3.5 text-red-400" />
          <span>剪裁线</span>
        </label>

        <label
          className={`flex items-center space-x-1 cursor-pointer px-2.5 py-1.5 rounded-lg border transition-all ${
            isDark
              ? "bg-[#1a2232] border-[#232d3f] text-gray-200 hover:border-slate-700"
              : "bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300"
          }`}
        >
          <input
            type="checkbox"
            checked={config.includeCoverPage}
            onChange={(e) => onChangeConfig({ includeCoverPage: e.target.checked })}
            className="accent-[#e60023] rounded cursor-pointer"
          />
          <File className="w-3.5 h-3.5 text-yellow-400" />
          <span>带报销封面</span>
        </label>

        {/* 下拉菜单：页边距 & 排序 */}
        <div
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition-all ${
            isDark
              ? "bg-[#1a2232] border-[#232d3f] text-slate-200 focus-within:border-[#e60023]"
              : "bg-slate-50 border-slate-200 text-slate-800 focus-within:border-[#e60023]"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">页边距:</span>
          <select
            value={config.marginSize || "normal"}
            onChange={(e) => onChangeConfig({ marginSize: e.target.value as any })}
            className="bg-transparent outline-none cursor-pointer text-xs font-medium"
          >
            <option value="normal" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              适中 (5mm)
            </option>
            <option value="none" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              无边距 (0mm)
            </option>
            <option value="compact" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              紧凑 (3mm)
            </option>
            <option value="wide" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              宽边距 (10mm)
            </option>
          </select>
        </div>

        <div
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition-all ${
            isDark
              ? "bg-[#1a2232] border-[#232d3f] text-slate-200 focus-within:border-[#e60023]"
              : "bg-slate-50 border-slate-200 text-slate-800 focus-within:border-[#e60023]"
          }`}
        >
          <span className="text-gray-400">排序:</span>
          <select
            value={config.sortBy || "category"}
            onChange={(e) => onChangeConfig({ sortBy: e.target.value as any })}
            className="bg-transparent outline-none cursor-pointer text-xs font-medium"
          >
            <option value="category" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              按发票种类/票种
            </option>
            <option value="date_asc" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              按开票日期
            </option>
            <option value="amount_desc" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              按发票金额
            </option>
          </select>
        </div>

        <button
          onClick={onResetOrder}
          className={`p-1.5 rounded-lg border cursor-pointer transition ${
            isDark
              ? "bg-[#1a2232] border-[#232d3f] text-gray-400 hover:text-white hover:bg-slate-800"
              : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
          title="复位拖拽顺序"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 右侧纸张与状态统计 */}
      <div className="flex items-center space-x-3 text-gray-300">
        <div
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition-all ${
            isDark ? "bg-[#1a2232] border-[#232d3f] text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">纸张类型:</span>
          <select
            value={config.paperType || "A4"}
            onChange={(e) => onChangeConfig({ paperType: e.target.value as PaperType })}
            className="bg-transparent outline-none cursor-pointer text-xs font-medium"
          >
            <option value="A4" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              A4 标准纸 (210×297mm)
            </option>
            <option value="A5" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              A5 便携纸 (148×210mm)
            </option>
            <option value="B5" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              B5 常用纸 (176×250mm)
            </option>
            <option value="InvoiceSpecial240" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              发票专用纸 (240×140mm)
            </option>
            <option value="InvoiceSpecial210" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              发票专用纸 (210×140mm)
            </option>
          </select>
        </div>

        <div
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition-all ${
            isDark ? "bg-[#1a2232] border-[#232d3f] text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">纸张方向:</span>
          <select
            value={config.orientation || "portrait"}
            onChange={(e) => onChangeConfig({ orientation: e.target.value as "portrait" | "landscape" })}
            className="bg-transparent outline-none cursor-pointer text-xs font-medium"
          >
            <option value="landscape" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              横向 (Landscape)
            </option>
            <option value="portrait" className={isDark ? "bg-[#121824] text-white" : "bg-white text-slate-900"}>
              纵向 (Portrait)
            </option>
          </select>
        </div>

        {/* 数据统计 */}
        <div className="text-xs font-mono">
          共 <span className="text-yellow-400 font-bold">{totalInvoices}</span> 张发票 · 排{" "}
          <span className="text-yellow-400 font-bold">{totalPages}</span> 页 A4 · 合计:{" "}
          <span className="text-[#00c875] font-bold font-mono">¥{totalAmount.toFixed(2)}</span>
        </div>

        {/* 缩放控制 */}
        <div
          className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg border ${
            isDark ? "bg-[#1a2232] border-[#232d3f] text-gray-400" : "bg-slate-50 border-slate-200 text-slate-600"
          }`}
        >
          <button
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
            className="hover:text-white cursor-pointer"
            title="放大预览"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono px-1 font-semibold">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            className="hover:text-white cursor-pointer"
            title="缩小预览"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(1.0)} className="hover:text-white ml-1 cursor-pointer" title="重置100%">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
