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
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 my-8 flex flex-col">
        {/* Header */}
        <div className="modal-dark-header flex items-center justify-between px-6 py-4 bg-[#0E172B] text-white border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-[#009966]" style={{ color: "#009966" }} />
            <h3 className="font-extrabold text-base tracking-wide text-white" style={{ color: "#ffffff !important" }}>
              导出 Excel 发票台账
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-slate-800">
          {/* Historical File Info Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>检测到您之前保存过的 Excel 文件：</span>
            </div>
            <div className="text-sm font-black text-slate-900 font-mono truncate px-1">
              📄 {lastExportInfo?.fileName || "发票台账明细表.xlsx"}
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pt-1 border-t border-slate-200/60">
              <span>上次导出时间：{lastExportInfo?.lastExportTime || "此前"}</span>
              <span>记录数：{lastExportInfo?.count || 0} 张</span>
            </div>
          </div>

          <p className="text-xs font-bold text-slate-600 leading-relaxed">
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
              className="w-full p-3.5 bg-[#009966] hover:bg-[#008055] text-white rounded-2xl font-extrabold text-xs flex items-center justify-between shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-center space-x-2.5">
                <RefreshCw className="w-4 h-4 text-white group-hover:rotate-180 transition-transform duration-500" />
                <div className="text-left">
                  <div className="font-extrabold">追加 / 更新至现有文件</div>
                  <div className="text-[10px] opacity-80 font-normal">直接拼接更新至 {lastExportInfo?.fileName}</div>
                </div>
              </div>
              <span className="text-xs font-black">➔</span>
            </button>

            {/* Option B: Save as New File */}
            <button
              onClick={() => {
                onSaveNewFile();
                onClose();
              }}
              className="w-full p-3.5 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-2xl font-extrabold text-xs flex items-center justify-between shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <FilePlus className="w-4 h-4 text-white" />
                <div className="text-left">
                  <div className="font-extrabold">保存为全新的 Excel 文件...</div>
                  <div className="text-[10px] opacity-80 font-normal">另存为带时间戳的新独立文件</div>
                </div>
              </div>
              <span className="text-xs font-black">➔</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};
