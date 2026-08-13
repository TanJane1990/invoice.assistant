import React from "react";
import {
  Printer,
  FileSpreadsheet,
  Upload,
  FileText,
  LayoutGrid,
  ClipboardList,
  Settings,
  Sun,
  Moon,
} from "lucide-react";

interface HeaderProps {
  activeTab: "layout" | "ledger" | "cover";
  setActiveTab: (tab: "layout" | "ledger" | "cover") => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenBatchImport: () => void;
  onOpenSettings: () => void;
  onLoadSamples: () => void;
  onPrint: () => void;
  onExportExcel: () => void;
  selectedCount: number;
  duplicateCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  theme,
  onToggleTheme,
  onOpenBatchImport,
  onOpenSettings,
  onPrint,
  onExportExcel,
}) => {
  const isDark = theme === "dark";

  return (
    <header className={`no-print border-b px-4 py-2 flex items-center justify-between shrink-0 sticky top-0 z-[70] shadow-md transition-colors ${
      isDark
        ? "bg-[#0E172B] border-[#1E293B] text-[#F8FAFC]"
        : "bg-white border-slate-200 text-slate-800"
    }`}>
      {/* 左侧 Logo 与应用名 */}
      <div className="flex items-center space-x-3">
        <div className="bg-[#E8000A] p-2 rounded-xl flex items-center justify-center shadow-md">
          <Printer className="w-5 h-5 text-white" />
        </div>
        <span className={`font-extrabold text-lg tracking-wide transition-colors ${
          isDark ? "text-[#F8FAFC]" : "text-slate-900"
        }`}>
          智能发票管理助手
        </span>
      </div>

      {/* 中间功能 Tab 切换 */}
      <div className={`hidden md:flex items-center p-1 rounded-xl border space-x-1 transition-colors ${
        isDark ? "bg-[#020617]/80 border-[#1E293B]" : "bg-[#F3F5F9] border-slate-200"
      }`}>
        <button
          onClick={() => setActiveTab("layout")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "layout"
              ? isDark
                ? "bg-[#E8000A] text-white shadow-sm"
                : "bg-white text-[#E8000A] border border-[#E8000A] shadow-xs"
              : isDark
              ? "text-[#93959F] hover:text-[#F8FAFC] hover:bg-[#1E293B]/60"
              : "text-slate-600 hover:text-[#E8000A] hover:bg-slate-200/50"
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>拼页打印排版预览</span>
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "ledger"
              ? isDark
                ? "bg-[#E8000A] text-white shadow-sm"
                : "bg-white text-[#E8000A] border border-[#E8000A] shadow-xs"
              : isDark
              ? "text-[#93959F] hover:text-[#F8FAFC] hover:bg-[#1E293B]/60"
              : "text-slate-600 hover:text-[#E8000A] hover:bg-slate-200/50"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>发票台账与查重</span>
        </button>

        <button
          onClick={() => setActiveTab("cover")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "cover"
              ? isDark
                ? "bg-[#E8000A] text-white shadow-sm"
                : "bg-white text-[#E8000A] border border-[#E8000A] shadow-xs"
              : isDark
              ? "text-[#93959F] hover:text-[#F8FAFC] hover:bg-[#1E293B]/60"
              : "text-slate-600 hover:text-[#E8000A] hover:bg-slate-200/50"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>报销汇总封面单</span>
        </button>
      </div>

      {/* 右侧快捷操作按钮区 */}
      <div className="flex items-center space-x-2 text-xs">
        {/* 模式切换按钮 */}
        <button
          onClick={onToggleTheme}
          title={isDark ? "切换为白天模式" : "切换为暗系模式"}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl border transition cursor-pointer font-bold ${
            isDark
              ? "bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border-[#334155]"
              : "bg-[#F3F5F9] hover:bg-slate-200 text-slate-700 border-slate-200"
          }`}
        >
          {isDark ? (
            <>
              <Moon className="w-3.5 h-3.5 text-yellow-400" />
              <span>暗系</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>白天</span>
            </>
          )}
        </button>

        {/* 批量导入发票 */}
        <button
          onClick={onOpenBatchImport}
          className="flex items-center space-x-1 bg-[#E8000A] hover:bg-[#C80009] px-3.5 py-1.5 rounded-xl font-bold text-white shadow-sm transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>批量导入发票</span>
        </button>

        {/* 导出台账Excel */}
        <button
          onClick={onExportExcel}
          className={`hidden lg:flex items-center space-x-1 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
            isDark
              ? "bg-[#0E172B] hover:bg-[#1E293B] text-[#009966] border-[#009966]/40"
              : "bg-[#F3F5F9] hover:bg-emerald-50 text-[#009966] border-emerald-300"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#009966]" />
          <span>导出台账Excel</span>
        </button>

        {/* 一键打印 */}
        <button
          onClick={onPrint}
          title="调出系统打印对话框或直接高清打印排版好的发票"
          className={`flex items-center space-x-1 px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
            isDark
              ? "bg-[#020617] hover:bg-[#1E293B] text-[#F8FAFC] border-[#1E293B]"
              : "bg-[#0E172B] hover:bg-[#1E293B] text-white border-[#0E172B]"
          }`}
        >
          <Printer className="w-3.5 h-3.5 text-[#E8000A]" />
          <span>一键打印</span>
        </button>

        {/* 设置 */}
        <button
          onClick={onOpenSettings}
          title="设置（AI API Key、企业抬头与数据保存）"
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
            isDark
              ? "bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border-[#334155]"
              : "bg-[#F3F5F9] hover:bg-slate-200 text-slate-800 border-slate-200"
          }`}
        >
          <Settings className={`w-3.5 h-3.5 ${isDark ? "text-[#93959F]" : "text-slate-600"}`} />
          <span>设置</span>
        </button>
      </div>
    </header>
  );
};
