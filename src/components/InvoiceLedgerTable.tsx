import React, { useState, useMemo } from "react";
import { InvoiceData, SystemSettings } from "../types";
import { exportInvoicesToExcel } from "../utils/exportExcel";
import {
  Search,
  Filter,
  FileSpreadsheet,
  Trash2,
  Edit3,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  CheckSquare,
  Square,
  Plus,
} from "lucide-react";

interface InvoiceLedgerTableProps {
  invoices: InvoiceData[];
  systemSettings?: SystemSettings;
  onToggleSelectForPrint: (id: string) => void;
  onToggleSelectAll: (select: boolean) => void;
  onDeleteInvoice: (id: string) => void;
  onEditInvoice: (invoice: InvoiceData) => void;
  onAddCustomInvoice: () => void;
}

// Distinct matching color styles for duplicate invoice groups
const DUPLICATE_PALETTES = [
  {
    rowBg: "bg-amber-100/90 dark:bg-amber-950/70 border-l-4 border-l-amber-500 text-amber-950 dark:text-amber-100 font-medium",
    badgeBg: "bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 border-amber-300 font-bold",
    groupLabel: "重复组 #1 (琥珀黄)",
  },
  {
    rowBg: "bg-rose-100/90 dark:bg-rose-950/70 border-l-4 border-l-rose-500 text-rose-950 dark:text-rose-100 font-medium",
    badgeBg: "bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 border-rose-300 font-bold",
    groupLabel: "重复组 #2 (玫瑰粉)",
  },
  {
    rowBg: "bg-purple-100/90 dark:bg-purple-950/70 border-l-4 border-l-purple-500 text-purple-950 dark:text-purple-100 font-medium",
    badgeBg: "bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-100 border-purple-300 font-bold",
    groupLabel: "重复组 #3 (罗兰紫)",
  },
  {
    rowBg: "bg-sky-100/90 dark:bg-sky-950/70 border-l-4 border-l-sky-500 text-sky-950 dark:text-sky-100 font-medium",
    badgeBg: "bg-sky-200 dark:bg-sky-900 text-sky-900 dark:text-sky-100 border-sky-300 font-bold",
    groupLabel: "重复组 #4 (天空蓝)",
  },
  {
    rowBg: "bg-emerald-100/90 dark:bg-emerald-950/70 border-l-4 border-l-emerald-500 text-emerald-950 dark:text-emerald-100 font-medium",
    badgeBg: "bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 border-emerald-300 font-bold",
    groupLabel: "重复组 #5 (薄荷绿)",
  },
];

export const InvoiceLedgerTable: React.FC<InvoiceLedgerTableProps> = ({
  invoices,
  systemSettings,
  onToggleSelectForPrint,
  onToggleSelectAll,
  onDeleteInvoice,
  onEditInvoice,
  onAddCustomInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterDuplicateOnly, setFilterDuplicateOnly] = useState(false);

  // Calculate duplicate groups
  const { duplicateMap, duplicateGroupCount } = useMemo(() => {
    const numberCounts: Record<string, string[]> = {};

    invoices.forEach((inv) => {
      const numKey = (inv.invoiceNumber || "").trim();
      if (numKey) {
        if (!numberCounts[numKey]) numberCounts[numKey] = [];
        numberCounts[numKey].push(inv.id);
      }
    });

    const map: Record<string, { groupIndex: number; totalInGroup: number; numKey: string }> = {};
    let groupIdxCounter = 0;

    Object.entries(numberCounts).forEach(([numKey, ids]) => {
      if (ids.length >= 2) {
        const groupIndex = groupIdxCounter;
        groupIdxCounter++;
        ids.forEach((id) => {
          map[id] = { groupIndex, totalInGroup: ids.length, numKey };
        });
      }
    });

    return { duplicateMap: map, duplicateGroupCount: groupIdxCounter };
  }, [invoices]);

  // Filter invoices
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

    return matchesSearch && matchesCategory && matchesDuplicate;
  });

  const allSelected =
    invoices.length > 0 && invoices.every((i) => i.selectedForPrint);
  const selectedForPrintCount = invoices.filter((i) => i.selectedForPrint).length;
  const duplicateCount = Object.keys(duplicateMap).length;

  // Export to Excel
  const handleExportToExcel = () => {
    exportInvoicesToExcel(invoices, systemSettings, `发票查重汇总台账_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      {/* Top Banner & Audit Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0E1422] p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">台账总发票数</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {invoices.length} <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">张</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0E1422] p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">拟排版打印数</div>
          <div className="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-1">
            {selectedForPrintCount}{" "}
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">/ {invoices.length}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0E1422] p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">总金额合计</div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            ¥
            {invoices
              .reduce((sum, i) => sum + i.totalAmountWithTax, 0)
              .toFixed(2)}
          </div>
        </div>

        <div
          onClick={() => setFilterDuplicateOnly((prev) => !prev)}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            duplicateCount > 0
              ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
              : "bg-white dark:bg-[#0E1422] border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span>相同发票号查重预警</span>
            {duplicateCount > 0 && <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />}
          </div>
          <div className="text-2xl font-extrabold mt-1">
            {duplicateCount}{" "}
            <span className="text-xs font-normal">
              {duplicateCount > 0 ? `张发票存在重复 (${duplicateGroupCount}组相同色块标出)` : "无重复发票"}
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filter */}
      <div className="bg-white dark:bg-[#0E1422] p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search & Category */}
        <div className="flex flex-wrap items-center space-x-3 gap-y-2">
          {/* Search Box */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索发票号、商户、销货方..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#131B2E] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 dark:bg-[#131B2E] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer font-bold"
            >
              <option value="all">全部分类</option>
              <option value="餐饮费">餐饮费</option>
              <option value="交通费">交通费</option>
              <option value="住宿费">住宿费</option>
              <option value="办公用品">办公用品</option>
              <option value="通讯费">通讯费</option>
              <option value="会议费">会议费</option>
              <option value="软件服务">软件服务</option>
              <option value="其他">其他</option>
            </select>
          </div>

          {/* Duplicate filter check */}
          <label className="flex items-center space-x-1.5 text-xs text-amber-900 dark:text-amber-200 cursor-pointer bg-amber-50 dark:bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 font-bold">
            <input
              type="checkbox"
              checked={filterDuplicateOnly}
              onChange={(e) => setFilterDuplicateOnly(e.target.checked)}
              className="accent-amber-500 rounded text-amber-600 cursor-pointer"
            />
            <span>仅筛选重复发票 ({duplicateCount}张)</span>
          </label>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onAddCustomInvoice}
            className="flex items-center space-x-1 px-3.5 py-2 bg-slate-100 dark:bg-[#131B2E] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
          >
            <Plus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>手动新建发票</span>
          </button>

          <button
            onClick={handleExportToExcel}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>导出 Excel 表格</span>
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-[#0E1422] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#131B2E] text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold">
                <th className="p-3.5 w-10 text-center">
                  <button
                    onClick={() => onToggleSelectAll(!allSelected)}
                    className="cursor-pointer"
                    title={allSelected ? "取消全选" : "全选包含在拼版排版中"}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-red-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">发票类型与代码</th>
                <th className="p-3.5">发票号码 (相同号码同色标出)</th>
                <th className="p-3.5">开票日期</th>
                <th className="p-3.5">销货方名称</th>
                <th className="p-3.5">分类</th>
                <th className="p-3.5 text-right">含税金额(元)</th>
                <th className="p-3.5 text-center">查重状态与标记</th>
                <th className="p-3.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-slate-800 dark:text-slate-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 dark:text-slate-500 font-sans font-medium">
                    暂无匹配的发票台账数据
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const dupInfo = duplicateMap[inv.id];
                  const palette = dupInfo
                    ? DUPLICATE_PALETTES[dupInfo.groupIndex % DUPLICATE_PALETTES.length]
                    : null;

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        palette
                          ? palette.rowBg
                          : inv.selectedForPrint
                          ? "bg-white dark:bg-[#0E1422] hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                          : "bg-slate-50/50 dark:bg-slate-950/50 text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => onToggleSelectForPrint(inv.id)}
                          className="cursor-pointer"
                        >
                          {inv.selectedForPrint ? (
                            <CheckSquare className="w-4 h-4 text-red-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
                      </td>

                      {/* Invoice Type & Code */}
                      <td className="p-3.5 font-sans">
                        <div className="font-extrabold text-slate-900 dark:text-slate-100">{inv.invoiceType}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {inv.invoiceCode ? `代码: ${inv.invoiceCode}` : "电子发票(无代码)"}
                        </div>
                      </td>

                      {/* Invoice Number */}
                      <td className="p-3.5 font-bold">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-900 dark:text-slate-100 font-extrabold">{inv.invoiceNumber}</span>
                          {palette && (
                            <span
                              className={`px-2 py-0.5 text-[9px] rounded-md border ${palette.badgeBg}`}
                              title={`相同号码发票重复出现在台账中 (重复组 #${dupInfo.groupIndex + 1})`}
                            >
                              重号组#{dupInfo.groupIndex + 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 font-medium">{inv.issueDate}</td>

                      {/* Seller */}
                      <td className="p-3.5 font-sans text-slate-800 dark:text-slate-200 truncate max-w-[170px] font-medium">
                        {inv.sellerName}
                      </td>

                      {/* Category Badge */}
                      <td className="p-3.5 font-sans">
                        <span className="inline-block px-2.5 py-0.5 bg-slate-100 dark:bg-[#131B2E] text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-bold border border-slate-200 dark:border-slate-800">
                          {inv.category}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 text-right font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                        ¥{inv.totalAmountWithTax.toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center font-sans">
                        {dupInfo ? (
                          <span className="inline-flex items-center space-x-1 text-amber-800 dark:text-amber-200 font-bold bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 text-[10px]">
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>号相同({dupInfo.totalInGroup}张)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 text-[10px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>唯一正常</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right font-sans space-x-1.5">
                        <button
                          onClick={() => onEditInvoice(inv)}
                          className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>编辑</span>
                        </button>

                        <button
                          onClick={() => onDeleteInvoice(inv.id)}
                          className="px-2.5 py-1 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>删除</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
