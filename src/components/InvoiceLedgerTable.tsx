import React, { useState, useMemo, useEffect } from "react";
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
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { InvoiceData, SystemSettings } from "../types";
import { exportInvoicesToExcel, getLastExportInfoAsync, LastExportInfo } from "../utils/exportExcel";
import { ExcelExportDialog } from "./ExcelExportDialog";
import { ArchiveCleanupModal } from "./ArchiveCleanupModal";

interface InvoiceLedgerTableProps {
  invoices: InvoiceData[];
  onDeleteInvoice: (id: string) => void;
  onEditInvoice: (invoice: InvoiceData) => void;
  onToggleSelectForPrint: (id: string) => void;
  onToggleSelectAll: (selected: boolean) => void;
  onExportSuccess?: (exportedIds: string[]) => void;
  onCleanupArchived?: (deletedIds: string[]) => void;
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

interface InvoiceBatchGroup {
  batchKey: string;
  batchTime: string;
  isUnexported: boolean;
  invoices: InvoiceData[];
  totalAmount: number;
}

export const InvoiceLedgerTable: React.FC<InvoiceLedgerTableProps> = ({
  invoices,
  onDeleteInvoice,
  onEditInvoice,
  onToggleSelectForPrint,
  onToggleSelectAll,
  onExportSuccess,
  onCleanupArchived,
  systemSettings,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [filterDuplicateOnly, setFilterDuplicateOnly] = useState(false);
  const [batchFilter, setBatchFilter] = useState<"all" | "unexported" | "exported">("all");
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [collapsedBatches, setCollapsedBatches] = useState<Record<string, boolean>>({});
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [lastExportInfo, setLastExportInfo] = useState<LastExportInfo | null>(null);

  const unexportedCount = invoices.filter((i) => !i.exported).length;
  const exportedCount = invoices.filter((i) => !!i.exported).length;

  // 1. 发票重复计算引擎（严格按发票号码查重，相同号码同色标出）
  const duplicateMap = useMemo(() => {
    const counts: Record<string, InvoiceData[]> = {};
    invoices.forEach((inv) => {
      if (inv.invoiceNumber && inv.invoiceNumber.trim() && inv.invoiceNumber.trim() !== "-") {
        const num = inv.invoiceNumber.trim();
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

  // 2. 动态分析台账中所有的开票年份与月份，生成周期快捷筛选选项
  const availablePeriods = useMemo(() => {
    const yearsSet = new Set<string>();
    const monthsSet = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.issueDate && inv.issueDate.length >= 7) {
        const year = inv.issueDate.substring(0, 4);
        const month = inv.issueDate.substring(0, 7);
        if (/^\d{4}$/.test(year)) yearsSet.add(year);
        if (/^\d{4}-\d{2}$/.test(month)) monthsSet.add(month);
      }
    });
    const years = Array.from(yearsSet).sort().reverse();
    const months = Array.from(monthsSet).sort().reverse();
    return { years, months };
  }, [invoices]);

  // 3. 多维度复合筛选过滤逻辑 (搜索 + 票种分类 + 批次状态 + 查重预警 + 年月周期)
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const cutoff1Month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const cutoff3Months = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    return invoices.filter((inv) => {
      const matchesSearch =
        !searchTerm ||
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

      let matchesPeriod = true;
      if (selectedPeriod === "last_1_month") {
        matchesPeriod = (inv.issueDate || "") >= cutoff1Month;
      } else if (selectedPeriod === "last_3_months") {
        matchesPeriod = (inv.issueDate || "") >= cutoff3Months;
      } else if (selectedPeriod.startsWith("year_")) {
        const yr = selectedPeriod.replace("year_", "");
        matchesPeriod = (inv.issueDate || "").startsWith(yr);
      } else if (selectedPeriod.startsWith("month_")) {
        const mo = selectedPeriod.replace("month_", "");
        matchesPeriod = (inv.issueDate || "").startsWith(mo);
      }

      return matchesSearch && matchesCategory && matchesDuplicate && matchesBatch && matchesPeriod;
    });
  }, [invoices, searchTerm, selectedCategory, duplicateMap, filterDuplicateOnly, batchFilter, selectedPeriod]);

  // 4. 分页控制计算
  const totalFilteredCount = filteredInvoices.length;
  const totalPages = pageSize === "all" ? 1 : Math.ceil(totalFilteredCount / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // 当搜索、分类、周期改变时，自动将页码重置为第 1 页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedPeriod, filterDuplicateOnly, batchFilter, pageSize]);

  // 当前分页呈现的发票切片
  const paginatedInvoices = useMemo(() => {
    if (pageSize === "all") return filteredInvoices;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, safeCurrentPage, pageSize]);

  // 5. 按导入批次时间线稳定聚合（生成批次分割横幅）
  const batchGroups = useMemo(() => {
    const groupMap = new Map<string, InvoiceBatchGroup>();

    paginatedInvoices.forEach((inv) => {
      const rawTime = inv.importTime ? inv.importTime.trim() : "";
      // 聚合至分钟级别或完整导入时间
      const batchTime = rawTime.length >= 16 ? rawTime.substring(0, 16) : rawTime || (inv.exported ? "历史归档批次" : "本次新导入批次");
      const isUnexp = !inv.exported;
      const batchKey = `${batchTime}_${isUnexp ? "unexp" : "exp"}`;

      let group = groupMap.get(batchKey);
      if (!group) {
        group = {
          batchKey,
          batchTime,
          isUnexported: isUnexp,
          invoices: [],
          totalAmount: 0,
        };
        groupMap.set(batchKey, group);
      }
      group.invoices.push(inv);
      group.totalAmount += inv.totalAmountWithTax;
    });

    return Array.from(groupMap.values());
  }, [paginatedInvoices]);

  const allSelected =
    invoices.length > 0 && invoices.every((i) => i.selectedForPrint);
  const selectedForPrintCount = invoices.filter((i) => i.selectedForPrint).length;
  const duplicateCount = Object.keys(duplicateMap).length;

  // 触发导出 Excel：智能判定首次导出 vs 再次追加导出
  const handleExportButtonClick = async () => {
    const historicalInfo = await getLastExportInfoAsync();
    if (!historicalInfo) {
      exportInvoicesToExcel(invoices, systemSettings, "default", undefined, onExportSuccess);
    } else {
      setLastExportInfo(historicalInfo);
      setIsExportDialogOpen(true);
    }
  };

  // 核心折叠状态判定逻辑：
  // 规则：只要是没有做归档（新导入，isUnexported===true）才默认展开；已做归档的批次（isUnexported===false）默认全部折叠收起。
  // 若用户手动点击过展开/折叠，以用户的设置为主。
  const isGroupCollapsed = (group: InvoiceBatchGroup) => {
    if (collapsedBatches[group.batchKey] !== undefined) {
      return collapsedBatches[group.batchKey];
    }
    return !group.isUnexported;
  };

  // 切换指定批次的折叠状态
  const toggleBatchCollapse = (batchKey: string, currentCollapsed: boolean) => {
    setCollapsedBatches((prev) => ({
      ...prev,
      [batchKey]: !currentCollapsed,
    }));
  };



  // 一键全选/取消指定批次的发票排版
  const toggleBatchSelect = (group: InvoiceBatchGroup) => {
    const allBatchSelected = group.invoices.length > 0 && group.invoices.every((i) => i.selectedForPrint);
    group.invoices.forEach((inv) => {
      if (inv.selectedForPrint === allBatchSelected) {
        onToggleSelectForPrint(inv.id);
      }
    });
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
            type="button"
            onClick={() => onToggleSelectForPrint(inv.id)}
            className="cursor-pointer inline-flex items-center justify-center"
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
              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
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
            type="button"
            onClick={() => onEditInvoice(inv)}
            style={{ color: "#0284C7", backgroundColor: "#E0F2FE" }}
            className="px-2.5 py-1 hover:bg-sky-100 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3 h-3" style={{ color: "#0284C7" }} />
            <span style={{ color: "#0284C7" }}>编辑</span>
          </button>

          <button
            type="button"
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

      {/* 2. 中间控制栏：统一规整排版（左侧筛选控制，右侧功能操作） */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5" style={{ backgroundColor: "#ffffff" }}>
        {/* 左侧: 搜索框 & 批次胶囊 & 周期 & 分类 & 查重 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 搜索框 */}
          <div className="relative w-40">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: "#64748b" }} />
            <input
              type="text"
              placeholder="搜索号码、商户..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ color: "#0f172a", backgroundColor: "#F8FAFC" }}
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* 批次筛选切换胶囊 */}
          <div className="flex items-center p-0.5 rounded-xl border space-x-0.5" style={{ backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" }}>
            <button
              type="button"
              onClick={() => setBatchFilter("all")}
              className="px-2.5 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-black flex items-center space-x-1 shadow-2xs"
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
              className="px-2.5 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-black flex items-center space-x-1 shadow-2xs"
              style={{
                backgroundColor: batchFilter === "unexported" ? "#059669" : "transparent",
                color: batchFilter === "unexported" ? "#ffffff" : unexportedCount > 0 ? "#047857" : "#64748b",
              }}
            >
              <Sparkles className="w-3 h-3" style={{ color: batchFilter === "unexported" ? "#ffffff" : "#047857" }} />
              <span>新导入 ({unexportedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setBatchFilter("exported")}
              className="px-2.5 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-black flex items-center space-x-1 shadow-2xs"
              style={{
                backgroundColor: batchFilter === "exported" ? "#334155" : "transparent",
                color: batchFilter === "exported" ? "#ffffff" : "#475569",
              }}
            >
              <Archive className="w-3 h-3" style={{ color: batchFilter === "exported" ? "#ffffff" : "#475569" }} />
              <span>已归档 ({exportedCount})</span>
            </button>
          </div>

          {/* 周期/年份/月份快捷筛选 */}
          <div className="flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5" style={{ color: "#64748b" }} />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              className="border border-slate-300 text-xs rounded-xl px-2 py-1.5 font-bold focus:outline-none cursor-pointer"
            >
              <option value="all">📅 全部时间</option>
              <option value="last_1_month">⚡ 近 1 个月</option>
              <option value="last_3_months">⏳ 近 3 个月</option>
              {availablePeriods.years.length > 0 && (
                <optgroup label="── 按年份 ──">
                  {availablePeriods.years.map((yr) => (
                    <option key={`yr-${yr}`} value={`year_${yr}`}>
                      {yr} 年全年度
                    </option>
                  ))}
                </optgroup>
              )}
              {availablePeriods.months.length > 0 && (
                <optgroup label="── 按月份 ──">
                  {availablePeriods.months.map((mo) => (
                    <option key={`mo-${mo}`} value={`month_${mo}`}>
                      {mo}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* 分类下拉列表 */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" style={{ color: "#64748b" }} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              className="border border-slate-300 text-xs rounded-xl px-2 py-1.5 font-bold focus:outline-none cursor-pointer"
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
          <label className="flex items-center space-x-1 text-xs cursor-pointer px-2 py-1.5 rounded-xl border font-bold" style={{ color: "#78350f", backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}>
            <input
              type="checkbox"
              checked={filterDuplicateOnly}
              onChange={(e) => setFilterDuplicateOnly(e.target.checked)}
              className="accent-amber-600 rounded cursor-pointer"
            />
            <span style={{ color: "#78350f" }}>仅重复 ({duplicateCount})</span>
          </label>
        </div>

        {/* 右侧: 操作按钮区 (归档管理 + 导出 Excel 永远居右且不换行) */}
        <div className="flex items-center space-x-2 shrink-0 ml-auto">
          {exportedCount > 0 && (
            <button
              type="button"
              onClick={() => setIsArchiveModalOpen(true)}
              className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs shrink-0"
              style={{ color: "#334155", backgroundColor: "#f8fafc" }}
              title="导出历史已归档发票 ZIP 完整备份包或安全清空已归档数据"
            >
              <Archive className="w-3.5 h-3.5 text-slate-600" />
              <span>🗄️ 归档封存管理</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportButtonClick}
            style={{ color: "#ffffff", backgroundColor: "#009966" }}
            className="px-3.5 py-2 hover:bg-[#008055] rounded-xl text-xs font-extrabold shadow-sm transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" style={{ color: "#ffffff" }} />
            <span style={{ color: "#ffffff" }}>
              {unexportedCount > 0 ? `导出 Excel (含${unexportedCount}张新发票)` : "导出 Excel 表格"}
            </span>
          </button>
        </div>
      </div>

      {/* 3. 底部发票台账表格 (支持导入批次时间线自动分割与智能折叠) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" style={{ backgroundColor: "#ffffff" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F8FAFC] font-extrabold text-xs whitespace-nowrap" style={{ backgroundColor: "#F8FAFC", color: "#1e293b" }}>
                <th className="p-3.5 w-10 text-center">
                  <button
                    type="button"
                    onClick={() => onToggleSelectAll(!allSelected)}
                    className="cursor-pointer inline-flex items-center justify-center"
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
                batchGroups.map((group) => {
                  // 智能判定折叠状态：未归档默认展开，已归档默认收起；若用户手动点击过以用户为准
                  const isCollapsed = isGroupCollapsed(group);
                  const allBatchSelected = group.invoices.length > 0 && group.invoices.every((i) => i.selectedForPrint);

                  return (
                    <React.Fragment key={group.batchKey}>
                      {/* 批次专属时间线分割横幅 */}
                      <tr
                        onClick={() => toggleBatchCollapse(group.batchKey, isCollapsed)}
                        className={`border-y font-sans transition-colors cursor-pointer select-none ${
                          group.isUnexported
                            ? "bg-emerald-50/90 hover:bg-emerald-100/80 text-emerald-950 border-emerald-200"
                            : "bg-slate-100/90 hover:bg-slate-200/80 text-slate-800 border-slate-300"
                        }`}
                        style={{
                          backgroundColor: group.isUnexported ? "#ecfdf5" : "#f1f5f9",
                        }}
                      >
                        <td colSpan={9} className="px-4 py-2.5">
                          <div className="flex items-center justify-between">
                            {/* 左侧：批次图标、时间、数量与合计 */}
                            <div className="flex items-center space-x-2">
                              <span
                                className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black shadow-2xs ${
                                  group.isUnexported ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"
                                }`}
                              >
                                {group.isUnexported ? "✨" : "📁"}
                              </span>
                              <span
                                className={`font-black text-xs ${
                                  group.isUnexported ? "text-emerald-950" : "text-slate-900"
                                }`}
                                style={{ color: group.isUnexported ? "#064e3b" : "#0f172a" }}
                              >
                                {group.isUnexported ? "【新导入批次】" : "【已归档批次】"} {group.batchTime}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${
                                  group.isUnexported
                                    ? "bg-emerald-200 text-emerald-900 border-emerald-300"
                                    : "bg-slate-200 text-slate-700 border-slate-300"
                                }`}
                                style={{ color: group.isUnexported ? "#064e3b" : "#334155" }}
                              >
                                共 {group.invoices.length} 张
                              </span>
                              <span
                                className={`text-xs font-mono font-black ${
                                  group.isUnexported ? "text-emerald-800" : "text-slate-700"
                                }`}
                                style={{ color: group.isUnexported ? "#065f46" : "#334155" }}
                              >
                                批次合计: ¥{group.totalAmount.toFixed(2)}
                              </span>
                            </div>

                            {/* 右侧：批次一键选中 & 批次折叠切换 */}
                            <div className="flex items-center space-x-2 text-[11px]" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleBatchSelect(group)}
                                className={`px-2.5 py-1 rounded-lg border font-bold transition cursor-pointer shadow-2xs ${
                                  group.isUnexported
                                    ? "bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-800"
                                    : "bg-white hover:bg-slate-200 border-slate-300 text-slate-700"
                                }`}
                                style={{ color: group.isUnexported ? "#064e3b" : "#334155" }}
                              >
                                {allBatchSelected ? "取消选中此批次" : "一键选中此批次排版"}
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleBatchCollapse(group.batchKey, isCollapsed)}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold transition cursor-pointer flex items-center space-x-1 shadow-2xs"
                                style={{ color: "#334155" }}
                              >
                                {isCollapsed ? (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    <span>展开 ({group.invoices.length}张)</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    <span>折叠收起</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* 批次内发票行（非折叠时渲染） */}
                      {!isCollapsed && group.invoices.map((inv) => renderInvoiceRow(inv))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. 标准多功能分页控制栏 */}
        {totalFilteredCount > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3 text-xs font-sans" style={{ backgroundColor: "#F8FAFC", color: "#475569" }}>
            {/* 左侧：数据范围与全表统计 */}
            <div className="flex items-center space-x-2 font-medium">
              <span>
                显示第 <strong className="font-bold text-slate-900" style={{ color: "#0f172a" }}>{pageSize === "all" ? 1 : (safeCurrentPage - 1) * pageSize + 1}</strong> 至{" "}
                <strong className="font-bold text-slate-900" style={{ color: "#0f172a" }}>{pageSize === "all" ? totalFilteredCount : Math.min(safeCurrentPage * pageSize, totalFilteredCount)}</strong> 条，共{" "}
                <strong className="font-black text-slate-900" style={{ color: "#0f172a" }}>{totalFilteredCount}</strong> 条发票
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-bold text-[#E8000A]" style={{ color: "#E8000A" }}>
                已勾选 {selectedForPrintCount} 张就绪排版
              </span>
            </div>

            {/* 右侧：每页条数切换 & 翻页导航器 */}
            <div className="flex items-center space-x-3">
              {/* 每页条数下拉 */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">每页显示:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === "all" ? "all" : parseInt(e.target.value, 10);
                    setPageSize(val);
                  }}
                  className="border border-slate-300 rounded-lg px-2 py-1 bg-white font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
                  style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                >
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                  <option value={100}>100 条/页</option>
                  <option value="all">显示全部</option>
                </select>
              </div>

              {/* 翻页按钮组 */}
              {pageSize !== "all" && totalPages > 1 && (
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center ${
                      safeCurrentPage <= 1
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 cursor-pointer shadow-2xs"
                    }`}
                    title="上一页"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* 智能页码按钮胶囊 */}
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, idx) => {
                    let pageNum = idx + 1;
                    if (totalPages > 7 && safeCurrentPage > 4) {
                      pageNum = safeCurrentPage - 3 + idx;
                      if (pageNum > totalPages) pageNum = totalPages - (6 - idx);
                    }
                    return (
                      <button
                        type="button"
                        key={`page-btn-${pageNum}`}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-7 h-7 px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                          safeCurrentPage === pageNum
                            ? "bg-[#0f172a] text-white shadow-2xs"
                            : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                        style={{
                          backgroundColor: safeCurrentPage === pageNum ? "#0f172a" : "#ffffff",
                          color: safeCurrentPage === pageNum ? "#ffffff" : "#334155",
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center ${
                      safeCurrentPage >= totalPages
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 cursor-pointer shadow-2xs"
                    }`}
                    title="下一页"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. 导出 Excel 对话框 */}
      {isExportDialogOpen && lastExportInfo && (
        <ExcelExportDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          invoices={invoices}
          lastExportInfo={lastExportInfo}
          systemSettings={systemSettings}
          onExportSuccess={onExportSuccess}
        />
      )}

      {/* 6. 归档发票安全封存与清理弹窗 */}
      {isArchiveModalOpen && (
        <ArchiveCleanupModal
          isOpen={isArchiveModalOpen}
          onClose={() => setIsArchiveModalOpen(false)}
          invoices={invoices}
          onCleanupSuccess={(deletedIds) => {
            if (onCleanupArchived) {
              onCleanupArchived(deletedIds);
            }
          }}
        />
      )}
    </div>
  );
};
