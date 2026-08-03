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
  onLoadSamples,
  onPrint,
  onExportExcel,
  selectedCount,
  duplicateCount,
}) => {
  const isDark = theme === "dark";

  return (
    <header
      className={`no-print border-b sticky top-0 z-50 transition-colors ${
        isDark
          ? "bg-slate-900 border-slate-800 text-slate-100"
          : "bg-white border-slate-200 shadow-xs text-slate-900"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & App Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-red-600 via-rose-600 to-orange-500 flex items-center justify-center text-white font-bold shadow-sm shadow-red-200">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`font-bold text-lg tracking-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  智能发票管理助手
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className={`hidden md:flex items-center p-1 rounded-xl border ${
            isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200/80"
          }`}>
            <button
              onClick={() => setActiveTab("layout")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "layout"
                  ? isDark ? "bg-slate-900 text-red-400 shadow-xs" : "bg-white text-red-600 shadow-xs"
                  : isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>拼页打印排版预览</span>
            </button>

            <button
              onClick={() => setActiveTab("ledger")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "ledger"
                  ? isDark ? "bg-slate-900 text-red-400 shadow-xs" : "bg-white text-red-600 shadow-xs"
                  : isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>发票台账与查重</span>
            </button>

            <button
              onClick={() => setActiveTab("cover")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "cover"
                  ? isDark ? "bg-slate-900 text-red-400 shadow-xs" : "bg-white text-red-600 shadow-xs"
                  : isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>报销汇总封面单</span>
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle (白天 / 暗系 皮肤) */}
            <button
              onClick={onToggleTheme}
              title={isDark ? "切换为白天模式" : "切换为暗系模式"}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
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
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg shadow-sm transition-all hover:shadow cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>批量导入发票</span>
            </button>

            <button
              onClick={onExportExcel}
              className={`hidden lg:flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
                isDark
                  ? "bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-800"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>导出台账Excel</span>
            </button>

            <button
              onClick={onPrint}
              title="调出系统打印对话框设置打印机并打印"
              className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-red-500" />
              <span>一键打印</span>
            </button>

            <button
              onClick={onOpenSettings}
              title="设置（AI API Key、企业抬头与数据保存）"
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">设置</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab bar */}
        <div className={`flex md:hidden border-t py-2 justify-around ${
          isDark ? "border-slate-800" : "border-slate-100"
        }`}>
          <button
            onClick={() => setActiveTab("layout")}
            className={`flex items-center space-x-1 text-xs py-1 px-2 rounded ${
              activeTab === "layout"
                ? "bg-red-600 text-white font-bold"
                : isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>排版</span>
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center space-x-1 text-xs py-1 px-2 rounded ${
              activeTab === "ledger"
                ? "bg-red-600 text-white font-bold"
                : isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>台账</span>
          </button>
          <button
            onClick={() => setActiveTab("cover")}
            className={`flex items-center space-x-1 text-xs py-1 px-2 rounded ${
              activeTab === "cover"
                ? "bg-red-600 text-white font-bold"
                : isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>报销单</span>
          </button>
        </div>
      </div>
    </header>
  );
};
