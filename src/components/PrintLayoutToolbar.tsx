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
    { id: "4", label: "4张/页 (2×2 横向)" },
  ];

  return (
    <div
      className={`no-print border-b sticky top-14 z-[60] px-4 py-2 flex items-center justify-between text-xs shrink-0 transition-colors shadow-md ${
        isDark
          ? "border-[#1E293B] bg-[#0B0F19] text-white"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      {/* 左侧控制区块 (对应红框 1：拼页模式 + 剪裁线/封面/边距/排序) */}
      <div className="flex flex-col space-y-2">
        {/* 左侧行 1: 拼页模式胶囊 */}
        <div
          className={`p-1 rounded-xl flex items-center border w-fit ${
            isDark ? "bg-[#121827] border-[#1E293B]" : "bg-[#F3F5F9] border-slate-200"
          }`}
        >
          {gridModes.map((mode) => {
            const active = config.gridMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  const newOrientation = mode.id === "2" ? "portrait" : "landscape";
                  onChangeConfig({ gridMode: mode.id as any, orientation: newOrientation });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-[#E8000A] text-white shadow-xs font-bold"
                    : isDark
                    ? "text-[#94A3B8] hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* 左侧行 2: 剪裁线 / 带报销封面 / 页边距 / 排序 / 重置 */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <button
            onClick={() => onChangeConfig({ showCropLines: !config.showCropLines })}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              config.showCropLines
                ? isDark
                  ? "bg-[#121827] border-[#334155] text-white"
                  : "bg-white border-[#E8000A] text-[#E8000A]"
                : isDark
                ? "bg-[#121827]/60 border-[#1E293B] text-[#94A3B8]"
                : "bg-[#F3F5F9] border-slate-200 text-slate-600"
            }`}
          >
            <input
              type="checkbox"
              checked={config.showCropLines}
              onChange={() => {}}
              className="accent-[#E8000A] rounded cursor-pointer"
            />
            <Scissors className="w-3.5 h-3.5 text-red-500" />
            <span>剪裁线</span>
          </button>

          <button
            onClick={() => onChangeConfig({ includeCoverPage: !config.includeCoverPage })}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              config.includeCoverPage
                ? isDark
                  ? "bg-[#121827] border-[#334155] text-white"
                  : "bg-white border-[#E8000A] text-[#E8000A]"
                : isDark
                ? "bg-[#121827]/60 border-[#1E293B] text-[#94A3B8]"
                : "bg-[#F3F5F9] border-slate-200 text-slate-600"
            }`}
          >
            <input
              type="checkbox"
              checked={config.includeCoverPage}
              onChange={() => {}}
              className="accent-[#E8000A] rounded cursor-pointer"
            />
            <FileCheck2 className="w-3.5 h-3.5 text-amber-500" />
            <span>带报销封面</span>
          </button>

          <div
            className={`flex items-center space-x-1 rounded-lg px-2.5 py-1.5 font-semibold border ${
              isDark
                ? "bg-[#121827] border-[#1E293B] text-[#94A3B8]"
                : "bg-[#F3F5F9] border-slate-200 text-slate-600"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span>页边距:</span>
            <select
              value={config.marginSize || config.margin || "normal"}
              onChange={(e) => onChangeConfig({ marginSize: e.target.value as any })}
              className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              <option value="none" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>无边距 (0mm)</option>
              <option value="compact" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>紧凑 (3mm)</option>
              <option value="normal" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>适中 (5mm)</option>
              <option value="wide" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>宽距 (10mm)</option>
            </select>
          </div>

          <div
            className={`flex items-center space-x-1 rounded-lg px-2.5 py-1.5 font-semibold border ${
              isDark
                ? "bg-[#121827] border-[#1E293B] text-[#94A3B8]"
                : "bg-[#F3F5F9] border-slate-200 text-slate-600"
            }`}
          >
            <span>排序:</span>
            <select
              value={config.sortBy}
              onChange={(e) => onChangeConfig({ sortBy: e.target.value as any })}
              className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              <option value="category" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>按发票种类/票种</option>
              <option value="date_asc" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>按开票时间 (升序)</option>
              <option value="amount_desc" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>按金额大小 (降序)</option>
            </select>
          </div>

          <button
            onClick={onResetOrder}
            title="重置默认排序"
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isDark
                ? "bg-[#121827] hover:bg-[#1E293B] border-[#1E293B] text-[#94A3B8] hover:text-white"
                : "bg-[#F3F5F9] hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 右侧控制区块 (对应红框 2：纸张规格/方向 + 汇总统计与缩放) */}
      <div className="flex flex-col space-y-2 items-end">
        {/* 右侧行 1: 纸张规格 & 纸张方向 */}
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-1 rounded-lg px-2.5 py-1.5 font-semibold border ${
              isDark
                ? "bg-[#121827] border-[#1E293B] text-[#94A3B8]"
                : "bg-[#F3F5F9] border-slate-200 text-slate-600"
            }`}
          >
            <File className="w-3.5 h-3.5 text-slate-400" />
            <span>纸张类型:</span>
            <select
              value={config.paperType || "A4"}
              onChange={(e) => onChangeConfig({ paperType: e.target.value as PaperType })}
              className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              <option value="A4" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>A4 标准纸 (210×297mm)</option>
              <option value="A5" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>A5 纸张 (148×210mm)</option>
              <option value="B5" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>B5 纸张 (176×250mm)</option>
              <option value="InvoiceSpecial240" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>发票专用平铺纸 (240×140mm)</option>
            </select>
          </div>

          <div
            className={`flex items-center space-x-1 rounded-lg px-2.5 py-1.5 font-semibold border ${
              isDark
                ? "bg-[#121827] border-[#1E293B] text-[#94A3B8]"
                : "bg-[#F3F5F9] border-slate-200 text-slate-600"
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            <span>纸张方向:</span>
            <select
              value={config.orientation}
              onChange={(e) => onChangeConfig({ orientation: e.target.value as any })}
              className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              <option value="landscape" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>横向 (Landscape)</option>
              <option value="portrait" className={isDark ? "bg-[#0B0F19]" : "bg-white"}>纵向 (Portrait)</option>
            </select>
          </div>
        </div>

        {/* 右侧行 2: 统计数据 + 缩放控制 */}
        <div className="flex items-center space-x-3">
          <div className={`font-mono font-semibold ${isDark ? "text-[#94A3B8]" : "text-slate-600"}`}>
            共 <span className="font-bold text-amber-500">{totalInvoices}</span> 张发票 · 排{" "}
            <span className="font-bold text-amber-500">{totalPages}</span> 页 {config.paperType || "A4"} · 合计:{" "}
            <span className="font-bold font-mono text-[#009966]">
              ¥{totalAmount.toFixed(2)}
            </span>
          </div>

          <div
            className={`flex items-center space-x-1 rounded-lg px-2 py-1 border ${
              isDark
                ? "bg-[#121827] border-[#1E293B] text-[#94A3B8]"
                : "bg-[#F3F5F9] border-slate-200 text-slate-600"
            }`}
          >
            <button
              onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
              className="p-1 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className={`font-mono text-xs px-1 font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
              className="p-1 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="p-1 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              title="重置100%"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
