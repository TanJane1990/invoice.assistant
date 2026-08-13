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
    <header className="no-print border-b border-slate-800 bg-[#0B0F19] text-white px-4 py-2 flex items-center justify-between shrink-0 sticky top-0 z-[70] shadow-md">
      {/* 左侧 Logo 与应用名 */}
      <div className="flex items-center space-x-3">
        <div className="bg-[#e60023] p-2 rounded-xl flex items-center justify-center shadow-md">
          <Printer className="w-5 h-5 text-white" />
        </div>
        <span className="font-extrabold text-lg tracking-wide text-white">
          智能发票管理助手
        </span>
      </div>

      {/* 中间功能 Tab 切换 */}
      <div className="hidden md:flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab("layout")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "layout"
              ? "bg-[#e60023] text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>拼页打印排版预览</span>
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "ledger"
              ? "bg-[#e60023] text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>发票台账与查重</span>
        </button>

        <button
          onClick={() => setActiveTab("cover")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "cover"
              ? "bg-[#e60023] text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
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
          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer font-bold"
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
          className="flex items-center space-x-1 bg-[#e60023] hover:bg-[#cc001f] px-3.5 py-1.5 rounded-xl font-bold text-white shadow-sm transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>批量导入发票</span>
        </button>

        {/* 导出台账Excel */}
        <button
          onClick={onExportExcel}
          className="hidden lg:flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800 font-bold transition cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>导出台账Excel</span>
        </button>

        {/* 一键打印 */}
        <button
          onClick={onPrint}
          title="调出系统打印对话框或直接高清打印排版好的发票"
          className="flex items-center space-x-1 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-red-400" />
          <span>一键打印</span>
        </button>

        {/* 设置 */}
        <button
          onClick={onOpenSettings}
          title="设置（AI API Key、企业抬头与数据保存）"
          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold transition cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          <span>设置</span>
        </button>
      </div>
    </header>
  );
};
