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
    <header
      className={`no-print border-b px-4 py-2 flex items-center justify-between shrink-0 sticky top-0 z-[70] transition-colors ${
        isDark
          ? "bg-[#121824] border-[#232d3f] text-white"
          : "bg-white border-slate-200 text-slate-900 shadow-xs"
      }`}
    >
      {/* 左侧 Logo 与应用名 */}
      <div className="flex items-center space-x-3">
        <div className="bg-[#e60023] p-1.5 rounded-lg flex items-center justify-center shadow-lg">
          <Printer className="w-5 h-5 text-white" />
        </div>
        <span className={`font-bold text-lg tracking-wide ${isDark ? "text-white" : "text-slate-900"}`}>
          智能发票管理助手
        </span>
      </div>

      {/* 中间功能 Tab 切换 */}
      <div className={`hidden md:flex items-center p-1 rounded-lg border space-x-1 ${
        isDark ? "bg-[#0b0e14] border-[#232d3f]" : "bg-slate-100 border-slate-200"
      }`}>
        <button
          onClick={() => setActiveTab("layout")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
            activeTab === "layout"
              ? isDark
                ? "bg-[#1a2232] text-white border border-[#334155]"
                : "bg-white text-red-600 border border-slate-300 shadow-xs"
              : isDark
              ? "text-gray-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5 text-red-500" />
          <span>拼页打印排版预览</span>
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
            activeTab === "ledger"
              ? isDark
                ? "bg-[#1a2232] text-white border border-[#334155]"
                : "bg-white text-red-600 border border-slate-300 shadow-xs"
              : isDark
              ? "text-gray-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>发票台账与查重</span>
        </button>

        <button
          onClick={() => setActiveTab("cover")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
            activeTab === "cover"
              ? isDark
                ? "bg-[#1a2232] text-white border border-[#334155]"
                : "bg-white text-red-600 border border-slate-300 shadow-xs"
              : isDark
              ? "text-gray-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>报销汇总封面单</span>
        </button>
      </div>

      {/* 右侧快捷操作按钮区 */}
      <div className="flex items-center space-x-2 text-xs">
        {/* 模式切换 */}
        <button
          onClick={onToggleTheme}
          title={isDark ? "切换为白天模式" : "切换为暗系模式"}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded border transition cursor-pointer ${
            isDark
              ? "bg-[#1a2232] hover:bg-[#232d3f] text-gray-200 border-[#232d3f]"
              : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
          }`}
        >
          {isDark ? (
            <>
              <Moon className="w-3.5 h-3.5 text-yellow-400" />
              <span>暗系</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-yellow-500" />
              <span>白天</span>
            </>
          )}
        </button>

        {/* 批量导入发票 */}
        <button
          onClick={onOpenBatchImport}
          className="flex items-center space-x-1 bg-[#e60023] hover:bg-[#cc001f] px-3 py-1.5 rounded font-semibold text-white shadow-md transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>批量导入发票</span>
        </button>

        {/* 导出台账Excel */}
        <button
          onClick={onExportExcel}
          className={`hidden lg:flex items-center space-x-1 px-3 py-1.5 rounded font-medium border cursor-pointer ${
            isDark
              ? "bg-[#1a2232] hover:bg-[#232d3f] text-[#00c875] border-[#00c875]/40"
              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>导出台账Excel</span>
        </button>

        {/* 一键打印 */}
        <button
          onClick={onPrint}
          title="调出系统打印对话框或直接高清打印排版好的发票"
          className={`flex items-center space-x-1 px-3 py-1.5 rounded border transition cursor-pointer ${
            isDark
              ? "bg-[#1a2232] hover:bg-[#232d3f] text-gray-200 border-[#232d3f]"
              : "bg-slate-900 hover:bg-slate-800 text-white border-slate-900"
          }`}
        >
          <Printer className="w-3.5 h-3.5 text-red-400" />
          <span>一键打印</span>
        </button>

        {/* 设置 */}
        <button
          onClick={onOpenSettings}
          title="设置（AI API Key、企业抬头与数据保存）"
          className={`flex items-center space-x-1 px-3 py-1.5 rounded border transition cursor-pointer ${
            isDark
              ? "bg-[#1a2232] hover:bg-[#232d3f] text-gray-200 border-[#232d3f]"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>设置</span>
        </button>
      </div>
    </header>
  );
};
