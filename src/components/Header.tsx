import React from "react";
import {
  Printer,
  FileSpreadsheet,
  Upload,
  FileText,
  Grid,
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
      className={`no-print border-b sticky top-0 z-[70] transition-colors ${
        isDark
          ? "bg-[#0B0F19] border-slate-800 text-slate-100"
          : "bg-white border-slate-200/90 shadow-xs text-slate-900"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & App Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-red-500 flex items-center justify-center text-white font-extrabold shadow-md shadow-red-200 dark:shadow-none">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <span className={`font-extrabold text-lg tracking-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                智能发票管理助手
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className={`hidden md:flex items-center p-1 rounded-2xl border ${
            isDark ? "bg-[#131B2E] border-slate-800" : "bg-slate-100/90 border-slate-200/80"
          }`}>
            <button
              onClick={() => setActiveTab("layout")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "layout"
                  ? isDark ? "bg-[#0E1422] text-red-400 shadow-xs" : "bg-white text-red-600 shadow-xs"
                  : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>拼页打印排版预览</span>
            </button>

            <button
              onClick={() => setActiveTab("ledger")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "ledger"
                  ? isDark ? "bg-[#0E1422] text-red-400 shadow-xs" : "bg-white text-red-600 shadow-xs"
                  : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>发票台账与查重</span>
            </button>

            <button
              onClick={() => setActiveTab("cover")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "cover"
                  ? isDark ? "bg-[#0E1422] text-red-400 shadow-xs" : "bg-white text-red-600 shadow-xs"
                  : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>报销汇总封面单</span>
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              title={isDark ? "切换为白天模式" : "切换为暗系模式"}
              className={`flex items-center space-x-1 px-2.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer border ${
                isDark
                  ? "bg-[#131B2E] hover:bg-slate-800 text-amber-300 border-slate-800"
                  : "bg-amber-50/80 hover:bg-amber-100 text-amber-700 border-amber-200/80"
              }`}
            >
              {isDark ? (
                <>
                  <Moon className="w-4 h-4 text-amber-300" />
                  <span className="hidden sm:inline">暗系</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="hidden sm:inline">白天</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenBatchImport}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-200 dark:shadow-none transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>批量导入发票</span>
            </button>

            <button
              onClick={onExportExcel}
              className={`hidden lg:flex items-center space-x-1 px-3 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer border ${
                isDark
                  ? "bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-800"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>导出台账Excel</span>
            </button>

            <button
              onClick={onPrint}
              title="调出系统打印对话框或直接高清打印排版好的发票"
              className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-red-500" />
              <span>一键打印</span>
            </button>

            <button
              onClick={onOpenSettings}
              title="设置（AI API Key、企业抬头与数据保存）"
              className={`flex items-center space-x-1 px-2.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer border ${
                isDark
                  ? "bg-[#131B2E] hover:bg-slate-800 text-slate-200 border-slate-800"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">设置</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
