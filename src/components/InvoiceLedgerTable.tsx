import React, { useState } from "react";
import {
  Search,
  Filter,
  FileSpreadsheet,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Square,
  ShieldAlert,
  Sparkles,
  Archive,
  Layers,
  Clock,
} from "lucide-react";
import { InvoiceData, SystemSettings } from "../types";
import { exportInvoicesToExcel, getLastExportInfoAsync, LastExportInfo } from "../utils/exportExcel";
import { ExcelExportDialog } from "./ExcelExportDialog";

interface InvoiceLedgerTableProps {
  invoices: InvoiceData[];
  onDeleteInvoice: (id: string) => void;
  onEditInvoice: (invoice: InvoiceData) => void;
  onToggleSelectForPrint: (id: string) => void;
  onToggleSelectAll: (selected: boolean) => void;
  onExportSuccess?: (exportedIds: string[]) => void;
  systemSettings?: SystemSettings;
  theme?: "light" | "dark";
}

// 相同号码重复发票的高亮调色盘
const DUPLICATE_PALETTES = [
  { rowBg: "bg-amber-100/90 hover:bg-amber-100", badgeBg: "bg-amber-200 text-amber-900 border-amber-400" },
  { rowBg: "bg-orange-100/90 hover:bg-orange-100", badgeBg: "bg-orange-200 text-orange-900 border-orange-400" },
  { rowBg: "bg-rose-100/90 hover:bg-rose-100", badgeBg: "bg-rose-200 text-rose-900 border-rose-400" },
  { rowBg: "bg-yellow-100/90 hover:bg-yellow-100", badgeBg: "bg-yellow-200 text-yellow-900 border-yellow-400" },
];

export const InvoiceLedgerTable: React.FC<InvoiceLedgerTableProps> = ({
  invoices,
  onDeleteInvoice,
  onEditInvoice,
  onManualCreate,
  onAddCustomInvoice,
  onToggleSelectForPrint,
  onToggleSelectAll,
  onExportSuccess,
  systemSettings,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterDuplicateOnly, setFilterDuplicateOnly] = useState(false);
  const [batchFilter, setBatchFilter] = useState<"all" | "unexported" | "exported">("all");
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [lastExportInfo, setLastExportInfo] = useState<LastExportInfo | null>(null);

  const unexportedCount = invoices.filter((i) => !i.exported).length;
  const exportedCount = invoices.filter((i) => !!i.exported).length;

  // 1. 发票重复计算引擎（纯粹精准匹配【相同发票号码】，相同号码同色标出）
  const duplicateMap = React.useMemo(() => {
    const counts: Record<string, InvoiceData[]> = {};
    invoices.forEach((inv) => {
      if (inv.invoiceNumber && inv.invoiceNumber.trim() && inv.invoiceNumber.trim() !== "-") {
        const num = inv.invoiceNumber.trim();
        // 核心：严格按发票号码查重（发票号码相同即视为重号发票）
        const key = num;
        if (!counts[key]) counts[key] = [];
        counts[key].push(inv);
      }
    });

    const dupInfoMap: Record<string, { groupIndex: number; totalInGroup: number }> = {};
    let groupCounter = 0;

    Object.values(counts).forEach((group) => {
      if (group.length > 1) {
        const currentGroupIdx = groupCounter++;
        group.forEach((inv) => {
          dupInfoMap[inv.id] = {
            groupIndex: currentGroupIdx,
            totalInGroup: group.length,
          };
        });
      }
    });

    return dupInfoMap;
  }, [invoices]);

  const duplicateGroupCount = new Set(Object.values(duplicateMap).map((d) => (d as { groupIndex: number }).groupIndex)).size;

  // 2. 筛选过滤逻辑
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.includes(searchTerm) ||
      (inv.invoiceCode && inv.invoiceCode.includes(searchTerm)) ||
      inv.sellerName.includes(searchTerm) ||
      inv.buyerName.includes(searchTerm) ||
      (inv.remarks && inv.remarks.includes(searchTerm));

    const matchesCategory =
      selectedCategory === "all" || inv.category === selectedCategory;

    const isDuplicate = !!duplicateMap[inv.id] || inv.duplicateWarning;
    const matchesDuplicate = !filterDuplicateOnly || isDuplicate;

    const matchesBatch =
      batchFilter === "all" ||
      (batchFilter === "unexported" && !inv.exported) ||
      (batchFilter === "exported" && !!inv.exported);

    return matchesSearch && matchesCategory && matchesDuplicate && matchesBatch;
  });

  const unexportedInvoices = filteredInvoices.filter((i) => !i.exported);
  const exportedInvoices = filteredInvoices.filter((i) => !!i.exported);

  const allSelected =
    invoices.length > 0 && invoices.every((i) => i.selectedForPrint);
  const selectedForPrintCount = invoices.filter((i) => i.selectedForPrint).length;
  const duplicateCount = Object.keys(duplicateMap).length;

  // 触发导出 Excel：智能判定首次导出 vs 再次导出（包含 Mac 磁盘物理文件存在性检测）
  const handleExportButtonClick = async () => {
    const historicalInfo = await getLastExportInfoAsync();
    if (!historicalInfo) {
      // 首次导出或磁盘文件已删除，直接弹出保存对话框另存
      exportInvoicesToExcel(invoices, systemSettings, "default", undefined, onExportSuccess);
    } else {
      // 发现此前导出过文件且磁盘上该文件真实存在，弹出智能对话框
      setLastExportInfo(historicalInfo);
      setIsExportDialogOpen(true);
    }
  };

  const renderInvoiceRow = (inv: InvoiceData) => {
    const dupInfo = duplicateMap[inv.id];
    const palette = dupInfo
      ? DUPLICATE_PALETTES[dupInfo.groupIndex % DUPLICATE_PALETTES.length]
      : null;

    return (
      <tr
        key={inv.id}
        className={`transition-colors whitespace-nowrap ${
          palette
            ? palette.rowBg
            : inv.selectedForPrint
            ? "bg-white hover:bg-slate-50/80"
            : !inv.exported
            ? "bg-emerald-50/20 hover:bg-emerald-50/50"
            : "bg-slate-50/70 hover:bg-slate-100/70"
        }`}
        style={{ color: "#0f172a" }}
      >
        {/* Checkbox */}
        <td className="p-3.5 text-center">
          <button
            onClick={() => onToggleSelectForPrint(inv.id)}
            className="cursor-pointer"
          >
            {inv.selectedForPrint ? (
              <CheckSquare className="w-4 h-4 text-[#E8000A]" style={{ color: "#E8000A" }} />
            ) : (
              <Square className="w-4 h-4" style={{ color: "#cbd5e1" }} />
            )}
          </button>
        </td>

        {/* Invoice Type & Code */}
        <td className="p-3.5 font-sans whitespace-nowrap max-w-[170px]">
          <div className="font-extrabold truncate" title={inv.invoiceType} style={{ color: "#0f172a" }}>
            {inv.invoiceType}
          </div>
          <div className="text-[10px] font-mono mt-0.5 truncate" title={inv.invoiceCode ? `代码: ${inv.invoiceCode}` : "电子发票(无代码)"} style={{ color: "#64748b" }}>
            {inv.invoiceCode ? `代码: ${inv.invoiceCode}` : "电子发票(无代码)"}
          </div>
          {/* 批次状态与时间胶囊 */}
          <div className="flex items-center space-x-1.5 mt-1">
            {!inv.exported ? (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                新导入
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-300">
                <Archive className="w-2.5 h-2.5 mr-0.5" />
                已归档
              </span>
            )}
            {inv.importTime && (
              <span className="text-[9px] font-mono text-slate-500 truncate" title={`导入时间: ${inv.importTime}`}>
                {inv.importTime.split(" ")[0]}
              </span>
            )}
          </div>
        </td>

        {/* Invoice Number */}
        <td className="p-3.5 font-bold whitespace-nowrap max-w-[180px]">
          <div className="flex items-center space-x-1.5">
            <span className="font-black truncate" title={inv.invoiceNumber} style={{ color: "#0f172a" }}>{inv.invoiceNumber}</span>
            {palette && (
              <span
                className={`px-2 py-0.5 text-[9px] rounded-md border whitespace-nowrap shrink-0 ${palette.badgeBg}`}
                title={`相同号码发票重复出现在台账中 (重复组 #${dupInfo.groupIndex + 1})`}
                style={{ color: "#78350f" }}
              >
                重号组#{dupInfo.groupIndex + 1}
              </span>
            )}
          </div>
        </td>

        {/* Date */}
        <td className="p-3.5 font-semibold whitespace-nowrap" style={{ color: "#475569" }}>{inv.issueDate}</td>

        {/* Seller */}
        <td className="p-3.5 font-sans font-bold whitespace-nowrap max-w-[180px]">
          <div className="truncate" title={inv.sellerName} style={{ color: "#0f172a" }}>
            {inv.sellerName}
          </div>
        </td>

        {/* Category Badge */}
        <td className="p-3.5 font-sans whitespace-nowrap">
          <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-slate-100 border-slate-200" style={{ color: "#334155", backgroundColor: "#f1f5f9" }}>
            {inv.category}
          </span>
        </td>

        {/* Amount */}
        <td className="p-3.5 text-right font-mono font-black text-sm whitespace-nowrap" style={{ color: "#0f172a" }}>
          ¥{inv.totalAmountWithTax.toFixed(2)}
        </td>

        {/* Status */}
        <td className="p-3.5 text-center font-sans whitespace-nowrap">
          {dupInfo ? (
            <span className="inline-flex items-center space-x-1 font-bold px-2.5 py-0.5 rounded-full border text-[10px] bg-amber-50 border-amber-300 whitespace-nowrap" style={{ color: "#b45309", backgroundColor: "#fffbeb" }}>
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span style={{ color: "#b45309" }}>⚠️ 发票重复 ({dupInfo.totalInGroup}张)</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 font-bold px-2.5 py-0.5 rounded-full border text-[10px] bg-emerald-50 border-emerald-200 whitespace-nowrap" style={{ color: "#009966", backgroundColor: "#ecfdf5" }}>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#009966]" style={{ color: "#009966" }} />
              <span style={{ color: "#009966" }}>✓ 唯一正常</span>
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="p-3.5 text-right font-sans space-x-1.5 whitespace-nowrap">
          <button
            onClick={() => onEditInvoice(inv)}
            style={{ color: "#0284C7", backgroundColor: "#E0F2FE" }}
            className="px-2.5 py-1 hover:bg-sky-100 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3 h-3" style={{ color: "#0284C7" }} />
            <span style={{ color: "#0284C7" }}>编辑</span>
          </button>

          <button
            onClick={() => {
              if (
                window.confirm(
                  `确定要从发票台账数据库中永久删除该发票记录吗？\n【发票号码】：${inv.invoiceNumber}\n【商户/金额】：${inv.sellerName} (¥${inv.totalAmountWithTax.toFixed(2)})\n\n（提示：如果您只是想在 A4 打印排版中临时不打印该发票，只需取消最左侧的勾选框即可，无需删除台账数据）`
                )
              ) {
                onDeleteInvoice(inv.id);
              }
            }}
            style={{ color: "#DC2626", backgroundColor: "#FEE2E2" }}
            className="px-2.5 py-1 hover:bg-red-100 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-colors cursor-pointer"
            title="从发票台账主数据库中永久删除此记录"
          >
            <Trash2 className="w-3 h-3" style={{ color: "#DC2626" }} />
            <span style={{ color: "#DC2626" }}>删除</span>
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4 font-sans">
      {/* 1. 顶部统计卡片区域 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 卡片 1: 台账总发票数 */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between" style={{ backgroundColor: "#ffffff" }}>
          <div className="text-sm font-extrabold tracking-tight flex items-center justify-between" style={{ color: "#0f172a" }}>
            <span style={{ color: "#0f172a" }}>台账总发票数</span>
            {unexportedCount > 0 ? (
              <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full border animate-pulse" style={{ backgroundColor: "#d1fae5", color: "#065f46", borderColor: "#6ee7b7" }}>
                {unexportedCount} 张待追加
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full border" style={{ backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" }}>
                已全量归档
              </span>
            )}
          </div>
          <div className="text-2xl font-black mt-2 flex items-baseline space-x-1" style={{ color: "#0f172a" }}>
            <span style={{ color: "#0f172a" }}>{invoices.length}</span>
            <span className="text-xs font-bold" style={{ color: "#475569" }}>张</span>
          </div>
          <div className="text-[11px] font-bold mt-2 flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md font-black text-[11px] border" style={{ color: "#065f46", backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }}>
              ✨ 新导入: {unexportedCount}
            </span>
            <span style={{ color: "#94a3b8" }}>•</span>
            <span className="px-2 py-0.5 rounded-md font-bold text-[11px] border" style={{ color: "#334155", backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
              📁 已归档: {exportedCount}
            </span>
          </div>
        </div>

        {/* 卡片 2: 拟排版打印数 */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between" style={{ backgroundColor: "#ffffff" }}>
          <div className="text-sm font-extrabold tracking-tight" style={{ color: "#0f172a" }}>
            拟排版打印数
          </div>
          <div className="text-2xl font-black mt-2 flex items-baseline space-x-1" style={{ color: "#E8000A" }}>
            <span style={{ color: "#E8000A" }}>{selectedForPrintCount}</span>
            <span className="text-xs font-bold" style={{ color: "#475569" }}>/ {invoices.length}</span>
          </div>
          <div className="text-[11px] font-extrabold mt-2 truncate flex items-center space-x-1.5" style={{ color: "#334155" }}>
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: selectedForPrintCount > 0 ? "#dc2626" : "#94a3b8" }}></span>
            <span style={{ color: selectedForPrintCount > 0 ? "#b91c1c" : "#475569" }}>
              {selectedForPrintCount > 0 ? `已勾选 ${selectedForPrintCount} 张发票就绪排版` : "未勾选任何发票"}
            </span>
          </div>
        </div>

        {/* 卡片 3: 总金额合计 */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between" style={{ backgroundColor: "#ffffff" }}>
          <div className="text-sm font-extrabold tracking-tight" style={{ color: "#0f172a" }}>
            总金额合计
          </div>
          <div className="text-2xl font-black mt-2 font-mono" style={{ color: "#009966" }}>
            ¥{invoices.reduce((sum, i) => sum + i.totalAmountWithTax, 0).toFixed(2)}
          </div>
          <div className="text-[11px] font-black mt-2 truncate font-mono flex items-center space-x-1" style={{ color: "#334155" }}>
            <span style={{ color: "#64748b" }}>均价:</span>
            <span style={{ color: "#0f172a" }}>¥{invoices.length > 0 ? (invoices.reduce((sum, i) => sum + i.totalAmountWithTax, 0) / invoices.length).toFixed(2) : "0.00"}</span>
          </div>
        </div>

        {/* 卡片 4: 相同发票号查重预警 */}
        <div
          onClick={() => setFilterDuplicateOnly((prev) => !prev)}
          className={`p-5 rounded-2xl border cursor-pointer transition-all shadow-sm flex flex-col justify-between relative group ${
            duplicateCount > 0
              ? "bg-red-50/70 border-red-300 hover:border-red-400"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
          style={{ backgroundColor: duplicateCount > 0 ? "#fff5f5" : "#ffffff" }}
          title={duplicateCount > 0 ? "点击快速仅筛选重复发票" : "当前无重复发票"}
        >
          <div className="flex items-center justify-between text-sm font-extrabold" style={{ color: duplicateCount > 0 ? "#b91c1c" : "#0f172a" }}>
            <span style={{ color: duplicateCount > 0 ? "#b91c1c" : "#0f172a" }}>相同发票号查重预警</span>
            {duplicateCount > 0 ? (
              <div className="relative flex items-center justify-center w-7 h-7">
                <span
                  className="animate-ping absolute inline-flex h-6 w-6 rounded-full opacity-75"
                  style={{ backgroundColor: "#ef4444" }}
                ></span>
                <div
                  className="relative flex items-center justify-center w-7 h-7 rounded-full shadow-md animate-pulse"
                  style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
                >
                  <ShieldAlert className="w-4 h-4 text-white" style={{ color: "#ffffff" }} />
                </div>
              </div>
            ) : (
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full border"
                style={{ backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" }}
              >
                <ShieldAlert className="w-4 h-4" style={{ color: "#94a3b8" }} />
              </div>
            )}
          </div>
          <div className="text-2xl font-black mt-2 flex items-baseline space-x-1.5" style={{ color: duplicateCount > 0 ? "#b91c1c" : "#0f172a" }}>
            <span style={{ color: duplicateCount > 0 ? "#b91c1c" : "#0f172a" }}>{duplicateCount}</span>
            <span className="text-xs font-bold" style={{ color: duplicateCount > 0 ? "#dc2626" : "#64748b" }}>
              {duplicateCount > 0 ? `张发票存在重复 (${duplicateGroupCount}组相同色块标出)` : "无重复发票"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 中间控制栏：搜索、分类、批次胶囊与操作按钮 */}
      <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: "#ffffff" }}>
        {/* 左侧: 搜索框 & 分类 & 批次筛选胶囊 */}
        <div className="flex flex-wrap items-center space-x-3 gap-y-2">
          {/* 搜索框 */}
          <div className="relative w-52">
            <Search className="w-4 h-4 absolute left-3 top-2.5" style={{ color: "#64748b" }} />
            <input
              type="text"
              placeholder="搜索发票号、商户..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ color: "#0f172a", backgroundColor: "#F8FAFC" }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* 批次筛选切换胶囊 (高对比度清晰色彩) */}
          <div className="flex items-center p-1 rounded-xl border space-x-1" style={{ backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" }}>
            <button
              type="button"
              onClick={() => setBatchFilter("all")}
              className="px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-black flex items-center space-x-1 shadow-2xs"
              style={{
                backgroundColor: batchFilter === "all" ? "#0f172a" : "transparent",
                color: batchFilter === "all" ? "#ffffff" : "#334155",
              }}
            >
              <span>全部 ({invoices.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setBatchFilter("unexported")}
              className="px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-black flex items-center space-x-1 shadow-2xs"
              style={{
                backgroundColor: batchFilter === "unexported" ? "#059669" : "transparent",
                color: batchFilter === "unexported" ? "#ffffff" : unexportedCount > 0 ? "#047857" : "#64748b",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: batchFilter === "unexported" ? "#ffffff" : "#047857" }} />
              <span>新导入 ({unexportedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setBatchFilter("exported")}
              className="px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-black flex items-center space-x-1 shadow-2xs"
              style={{
                backgroundColor: batchFilter === "exported" ? "#334155" : "transparent",
                color: batchFilter === "exported" ? "#ffffff" : "#475569",
              }}
            >
              <Archive className="w-3.5 h-3.5" style={{ color: batchFilter === "exported" ? "#ffffff" : "#475569" }} />
              <span>已归档 ({exportedCount})</span>
            </button>
          </div>

          {/* 分类下拉列表 */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" style={{ color: "#64748b" }} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              className="border border-slate-300 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none cursor-pointer"
            >
              <option value="all" style={{ color: "#0f172a" }}>全部分类</option>
              <option value="餐饮费" style={{ color: "#0f172a" }}>餐饮费</option>
              <option value="交通费" style={{ color: "#0f172a" }}>交通费</option>
              <option value="住宿费" style={{ color: "#0f172a" }}>住宿费</option>
              <option value="办公用品" style={{ color: "#0f172a" }}>办公用品</option>
              <option value="通讯费" style={{ color: "#0f172a" }}>通讯费</option>
              <option value="会议费" style={{ color: "#0f172a" }}>会议费</option>
              <option value="软件服务" style={{ color: "#0f172a" }}>软件服务</option>
              <option value="其他" style={{ color: "#0f172a" }}>其他</option>
            </select>
          </div>

          {/* 仅筛选重复发票 */}
          <label className="flex items-center space-x-1.5 text-xs cursor-pointer px-2.5 py-1.5 rounded-xl border font-bold" style={{ color: "#78350f", backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}>
            <input
              type="checkbox"
              checked={filterDuplicateOnly}
              onChange={(e) => setFilterDuplicateOnly(e.target.checked)}
              className="accent-amber-600 rounded cursor-pointer"
            />
            <span style={{ color: "#78350f" }}>仅重复 ({duplicateCount}张)</span>
          </label>
        </div>

        {/* 右侧: 导出 Excel 按钮 */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportButtonClick}
            style={{ color: "#ffffff", backgroundColor: "#009966" }}
            className="px-4 py-2 hover:bg-[#008055] rounded-xl text-xs font-extrabold shadow-sm transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" style={{ color: "#ffffff" }} />
            <span style={{ color: "#ffffff" }}>
              {unexportedCount > 0 ? `导出 Excel (含${unexportedCount}张新发票)` : "导出 Excel 表格"}
            </span>
          </button>
        </div>
      </div>

      {/* 3. 底部发票台账表格 (支持分批次分割横幅) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" style={{ backgroundColor: "#ffffff" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F8FAFC] font-extrabold text-xs whitespace-nowrap" style={{ backgroundColor: "#F8FAFC", color: "#1e293b" }}>
                <th className="p-3.5 w-10 text-center">
                  <button
                    onClick={() => onToggleSelectAll(!allSelected)}
                    className="cursor-pointer"
                    title={allSelected ? "取消全选" : "全选包含在拼版排版中"}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#E8000A]" style={{ color: "#E8000A" }} />
                    ) : (
                      <Square className="w-4 h-4" style={{ color: "#94a3b8" }} />
                    )}
                  </button>
                </th>
                <th className="p-3.5 font-bold whitespace-nowrap" style={{ color: "#1e293b" }}>发票类型与批次</th>
                <th className="p-3.5 font-bold whitespace-nowrap" style={{ color: "#1e293b" }}>发票号码 (相同号码同色标出)</th>
                <th className="p-3.5 font-bold whitespace-nowrap" style={{ color: "#1e293b" }}>开票日期</th>
                <th className="p-3.5 font-bold whitespace-nowrap" style={{ color: "#1e293b" }}>销货方名称</th>
                <th className="p-3.5 font-bold whitespace-nowrap" style={{ color: "#1e293b" }}>分类</th>
                <th className="p-3.5 text-right font-bold whitespace-nowrap" style={{ color: "#1e293b" }}>含税金额(元)</th>
                <th className="p-3.5 text-center font-bold whitespace-nowrap" style={{ color: "#1e293b" }}>查重状态与标记</th>
                <th className="p-3.5 text-right font-bold whitespace-nowrap" style={{ color: "#1e293b" }}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 font-mono">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center font-sans font-medium" style={{ color: "#94a3b8" }}>
                    没有找到符合条件的发票记录
                  </td>
                </tr>
              ) : (
                <>
                  {/* 分组 1: 新导入批次横幅与行 */}
                  {(batchFilter === "all" || batchFilter === "unexported") && unexportedInvoices.length > 0 && (
                    <>
                      <tr className="bg-emerald-50 border-y border-emerald-200 text-emerald-950 font-sans" style={{ backgroundColor: "#ecfdf5" }}>
                        <td colSpan={9} className="px-4 py-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                                ✨
                              </span>
                              <span className="font-extrabold text-xs text-emerald-900" style={{ color: "#064e3b" }}>
                                本次新导入批次（待追加至 Excel 归档）
                              </span>
                              <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-200 text-emerald-900 border border-emerald-300" style={{ color: "#064e3b" }}>
                                共 {unexportedInvoices.length} 张
                              </span>
                              <span className="text-xs font-mono font-black text-emerald-800" style={{ color: "#065f46" }}>
                                合计: ¥{unexportedInvoices.reduce((s, i) => s + i.totalAmountWithTax, 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[11px]">
                              <button
                                onClick={() => {
                                  const allUnexpSelected = unexportedInvoices.every((i) => i.selectedForPrint);
                                  unexportedInvoices.forEach((i) => {
                                    if (i.selectedForPrint === allUnexpSelected) {
                                      onToggleSelectForPrint(i.id);
                                    }
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold transition cursor-pointer shadow-2xs"
                                style={{ color: "#065f46" }}
                              >
                                {unexportedInvoices.every((i) => i.selectedForPrint) ? "取消选中新导入" : "一键选中新导入发票排版"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {unexportedInvoices.map((inv) => renderInvoiceRow(inv))}
                    </>
                  )}

                  {/* 分组 2: 历史归档批次横幅与行 */}
                  {(batchFilter === "all" || batchFilter === "exported") && exportedInvoices.length > 0 && (
                    <>
                      <tr className="bg-slate-100 border-y border-slate-300 text-slate-800 font-sans" style={{ backgroundColor: "#f1f5f9" }}>
                        <td colSpan={9} className="px-4 py-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-black">
                                📁
                              </span>
                              <span className="font-extrabold text-xs text-slate-800" style={{ color: "#1e293b" }}>
                                历史归档批次（已导出至 Excel 发票台账）
                              </span>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-200 text-slate-700 border border-slate-300" style={{ color: "#334155" }}>
                                共 {exportedInvoices.length} 张
                              </span>
                              <span className="text-xs font-mono font-black text-slate-700" style={{ color: "#334155" }}>
                                合计: ¥{exportedInvoices.reduce((s, i) => s + i.totalAmountWithTax, 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[11px]">
                              <button
                                onClick={() => {
                                  const allExpSelected = exportedInvoices.every((i) => i.selectedForPrint);
                                  exportedInvoices.forEach((i) => {
                                    if (i.selectedForPrint === allExpSelected) {
                                      onToggleSelectForPrint(i.id);
                                    }
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold transition cursor-pointer shadow-2xs"
                                style={{ color: "#334155" }}
                              >
                                {exportedInvoices.every((i) => i.selectedForPrint) ? "取消选中已归档" : "一键选中已归档发票排版"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {exportedInvoices.map((inv) => renderInvoiceRow(inv))}
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. 智能 Excel 导出与追加确认弹窗 */}
      <ExcelExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        lastExportInfo={lastExportInfo}
        currentCount={invoices.length}
        unexportedCount={unexportedCount}
        onAppendToExisting={() => exportInvoicesToExcel(invoices, systemSettings, "append", undefined, onExportSuccess)}
        onSaveNewFile={() => exportInvoicesToExcel(invoices, systemSettings, "new", undefined, onExportSuccess)}
      />
    </div>
  );
};
