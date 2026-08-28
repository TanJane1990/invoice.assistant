import React from "react";
import { FileSpreadsheet, X, FilePlus, RefreshCw, Clock, FolderOpen } from "lucide-react";
import { getBackendApiUrl } from "../utils/exportExcel";

interface LastExportInfo {
  fileName: string;
  lastExportTime: string;
  count: number;
}

interface ExcelExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lastExportInfo: LastExportInfo | null;
  currentCount?: number;
  unexportedCount?: number;
  onAppendToExisting: () => void;
  onSaveNewFile: () => void;
}

export const ExcelExportDialog: React.FC<ExcelExportDialogProps> = ({
  isOpen,
  onClose,
  lastExportInfo,
  currentCount = 0,
  unexportedCount = 0,
  onAppendToExisting,
  onSaveNewFile,
}) => {
  if (!isOpen) return null;

  const appendBatchCount = unexportedCount > 0 ? unexportedCount : currentCount;

  const handleOpenFileFolder = async () => {
    if (!lastExportInfo?.fileName) return;
    if (typeof window !== "undefined" && (window as any).electronAPI?.openFileFolder) {
      try {
        const res = await (window as any).electronAPI.openFileFolder({ fileName: lastExportInfo.fileName });
        if (res && res.success) return;
      } catch (e) {}
    }
    try {
      const res = await fetch(getBackendApiUrl("/api/open-file-folder"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: lastExportInfo.fileName }),
      });
      const data = await res.json();
      if (!data || !data.success) {
        // 磁盘上找不到该文件（已被用户删除/拔出U盘/移动位置），自动清除记忆并触发【另存为新文件】
        try {
          localStorage.removeItem("smart_invoice_last_export_info");
        } catch (e) {}
        alert("未能在磁盘中找到该 Excel 文件（可能已被删除或移走），系统已为您自动重置并切换为【另存为新文件】！");
        onSaveNewFile();
        onClose();
      }
    } catch (e) {
      onSaveNewFile();
      onClose();
    }
  };

  return (
    <div className="no-print print:hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 my-8 flex flex-col" style={{ backgroundColor: "#ffffff" }}>
        {/* Header */}
        <div className="modal-dark-header flex items-center justify-between px-6 py-4 bg-[#0E172B] text-white border-b border-slate-800" style={{ backgroundColor: "#0E172B" }}>
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5" style={{ color: "#009966" }} />
            <h3 className="font-extrabold text-base tracking-wide text-white" style={{ color: "#ffffff !important" }}>
              导出 Excel 发票台账
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            style={{ color: "#94a3b8" }}
          >
            <X className="w-5 h-5" style={{ color: "#ffffff" }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
          {/* Historical File Info Box */}
          <div className="p-4 rounded-2xl border border-slate-200 space-y-2.5" style={{ backgroundColor: "#f8fafc" }}>
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: "#475569" }}>
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4" style={{ color: "#64748b" }} />
                <span style={{ color: "#475569" }}>检测到您之前保存过的 Excel 文件：</span>
              </div>
            </div>

            {/* Clickable File Name Link Button */}
            <button
              onClick={handleOpenFileFolder}
              title="点击在 Mac Finder / 资源管理器中打开并直接选中该文件"
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#009966] hover:bg-emerald-50/60 transition-all text-left group cursor-pointer shadow-xs"
            >
              <div className="text-xs font-black font-mono truncate flex items-center space-x-1.5 pr-2" style={{ color: "#0f172a" }}>
                <span>📄</span>
                <span className="truncate group-hover:text-[#009966] group-hover:underline">
                  {lastExportInfo?.fileName || "发票台账明细表.xlsx"}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 shrink-0 flex items-center space-x-1 group-hover:bg-[#009966] group-hover:text-white transition-colors">
                <FolderOpen className="w-3.5 h-3.5 inline mr-0.5" />
                <span>打开目录</span>
              </span>
            </button>

            <div className="flex items-center justify-between text-[11px] font-semibold pt-1 border-t border-slate-200" style={{ color: "#64748b" }}>
              <span style={{ color: "#64748b" }}>该文件内已有：<strong className="text-slate-800">{lastExportInfo?.count || 0}</strong> 张</span>
              <span style={{ color: "#009966" }}>本次待追加新批次：<strong>{appendBatchCount}</strong> 张</span>
            </div>
          </div>

          <p className="text-xs font-bold leading-relaxed" style={{ color: "#334155" }}>
            请选择您希望的导出与保存方式：
          </p>

          {/* Decision Buttons */}
          <div className="space-y-3 pt-1">
            {/* Option A: Append / Update to Existing File */}
            <button
              onClick={() => {
                onAppendToExisting();
                onClose();
              }}
              style={{ backgroundColor: "#009966", color: "#ffffff" }}
              className="w-full p-3.5 hover:bg-[#008055] text-white rounded-2xl font-extrabold text-xs flex items-center justify-between shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-center space-x-2.5">
                <RefreshCw className="w-4 h-4 text-white group-hover:rotate-180 transition-transform duration-500" style={{ color: "#ffffff" }} />
                <div className="text-left">
                  <div className="font-extrabold" style={{ color: "#ffffff" }}>追加新批次至现有文件（{appendBatchCount}张新发票）</div>
                  <div className="text-[10px] opacity-80 font-normal" style={{ color: "#ffffff" }}>
                    将本次 {appendBatchCount} 张发票作为新批次追加（独立编号与统计，全表智能跨批次查重）
                  </div>
                </div>
              </div>
              <span className="text-xs font-black" style={{ color: "#ffffff" }}>➔</span>
            </button>

            {/* Option B: Save as New File / Custom Location */}
            <button
              onClick={() => {
                onSaveNewFile();
                onClose();
              }}
              style={{ backgroundColor: "#0284C7", color: "#ffffff" }}
              className="w-full p-3.5 hover:bg-[#0369A1] text-white rounded-2xl font-extrabold text-xs flex items-center justify-between shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <FilePlus className="w-4 h-4 text-white" style={{ color: "#ffffff" }} />
                <div className="text-left">
                  <div className="font-extrabold" style={{ color: "#ffffff" }}>保存为全新的 Excel 文件 / 另存为...</div>
                  <div className="text-[10px] opacity-80 font-normal" style={{ color: "#ffffff" }}>
                    弹出文件选择窗口，将台账中全量 {currentCount} 张发票独立另存到新位置
                  </div>
                </div>
              </div>
              <span className="text-xs font-black" style={{ color: "#ffffff" }}>➔</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#f8fafc" }}>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("smart_invoice_last_export_info");
              } catch (e) {}
              onSaveNewFile();
              onClose();
            }}
            className="text-[11px] font-bold text-slate-500 hover:text-red-600 underline transition-colors cursor-pointer"
            style={{ color: "#64748b" }}
          >
            重置记忆 / 每次直接存新文件
          </button>
          <button
            onClick={onClose}
            style={{ backgroundColor: "#ffffff", color: "#1e293b", borderColor: "#cbd5e1" }}
            className="px-4 py-2 hover:bg-slate-100 border rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <span style={{ color: "#1e293b" }}>取消</span>
          </button>
        </div>
      </div>
    </div>
  );
};
