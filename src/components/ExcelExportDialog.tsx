import React from "react";
import { FileSpreadsheet, X, FilePlus, RefreshCw, Clock } from "lucide-react";

interface LastExportInfo {
  fileName: string;
  lastExportTime: string;
  count: number;
}

interface ExcelExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lastExportInfo: LastExportInfo | null;
  onAppendToExisting: () => void;
  onSaveNewFile: () => void;
}

export const ExcelExportDialog: React.FC<ExcelExportDialogProps> = ({
  isOpen,
  onClose,
  lastExportInfo,
  onAppendToExisting,
  onSaveNewFile,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
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
          <div className="p-4 rounded-2xl border border-slate-200 space-y-2" style={{ backgroundColor: "#f8fafc" }}>
            <div className="flex items-center space-x-2 text-xs font-bold" style={{ color: "#475569" }}>
              <Clock className="w-4 h-4" style={{ color: "#64748b" }} />
              <span style={{ color: "#475569" }}>检测到您之前保存过的 Excel 文件：</span>
            </div>
            <div className="text-sm font-black font-mono truncate px-1" style={{ color: "#0f172a" }}>
              📄 {lastExportInfo?.fileName || "发票台账明细表.xlsx"}
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold pt-1 border-t border-slate-200" style={{ color: "#64748b" }}>
              <span style={{ color: "#64748b" }}>上次导出时间：{lastExportInfo?.lastExportTime || "此前"}</span>
              <span style={{ color: "#64748b" }}>记录数：{lastExportInfo?.count || 0} 张</span>
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
                  <div className="font-extrabold" style={{ color: "#ffffff" }}>追加 / 更新至现有文件</div>
                  <div className="text-[10px] opacity-80 font-normal" style={{ color: "#ffffff" }}>直接拼接更新至 {lastExportInfo?.fileName}</div>
                </div>
              </div>
              <span className="text-xs font-black" style={{ color: "#ffffff" }}>➔</span>
            </button>

            {/* Option B: Save as New File */}
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
                  <div className="font-extrabold" style={{ color: "#ffffff" }}>保存为全新的 Excel 文件...</div>
                  <div className="text-[10px] opacity-80 font-normal" style={{ color: "#ffffff" }}>另存为带时间戳的新独立文件</div>
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
