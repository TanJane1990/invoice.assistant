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
  theme?: "light" | "dark";
}

// Distinct matching color styles for duplicate invoice groups
const DUPLICATE_PALETTES = [
  {
    rowBg: "bg-amber-100/90 border-l-4 border-l-amber-500 font-medium",
    badgeBg: "bg-amber-200 border-amber-300 font-bold",
  },
  {
    rowBg: "bg-rose-100/90 border-l-4 border-l-rose-500 font-medium",
    badgeBg: "bg-rose-200 border-rose-300 font-bold",
  },
  {
    rowBg: "bg-purple-100/90 border-l-4 border-l-purple-500 font-medium",
    badgeBg: "bg-purple-200 border-purple-300 font-bold",
  },
  {
    rowBg: "bg-sky-100/90 border-l-4 border-l-sky-500 font-medium",
    badgeBg: "bg-sky-200 border-sky-300 font-bold",
  },
  {
    rowBg: "bg-emerald-100/90 border-l-4 border-l-emerald-500 font-medium",
    badgeBg: "bg-emerald-200 border-emerald-300 font-bold",
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
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-bold text-slate-500" style={{ color: "#64748b" }}>
            台账总发票数
          </div>
          <div className="text-2xl font-black mt-1 text-slate-900" style={{ color: "#0f172a" }}>
            {invoices.length} <span className="text-xs font-bold text-slate-700" style={{ color: "#334155" }}>张</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-bold text-slate-500" style={{ color: "#64748b" }}>
            拟排版打印数
          </div>
          <div className="text-2xl font-black mt-1 text-[#E8000A]" style={{ color: "#E8000A" }}>
            {selectedForPrintCount}{" "}
            <span className="text-xs font-bold text-slate-500" style={{ color: "#64748b" }}>
              / {invoices.length}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-bold text-slate-700" style={{ color: "#1e293b" }}>
            总金额合计
          </div>
          <div className="text-2xl font-black mt-1 font-mono text-slate-900" style={{ color: "#0f172a" }}>
            ¥
            {invoices
              .reduce((sum, i) => sum + i.totalAmountWithTax, 0)
              .toFixed(2)}
          </div>
        </div>

        <div
          onClick={() => setFilterDuplicateOnly((prev) => !prev)}
          className={`p-5 rounded-2xl border cursor-pointer transition-all shadow-sm ${
            duplicateCount > 0
              ? "bg-amber-50 border-amber-300"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-800" style={{ color: "#1e293b" }}>
            <span>相同发票号查重预警</span>
            {duplicateCount > 0 && <ShieldAlert className="w-4 h-4 animate-pulse text-amber-600" />}
          </div>
          <div className="text-2xl font-black mt-1 text-slate-900" style={{ color: "#0f172a" }}>
            {duplicateCount}{" "}
            <span className="text-xs font-bold text-slate-600" style={{ color: "#475569" }}>
              {duplicateCount > 0 ? `张发票存在重复 (${duplicateGroupCount}组相同色块标出)` : "无重复发票"}
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filter */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search & Category */}
        <div className="flex flex-wrap items-center space-x-3 gap-y-2">
          {/* Search Box */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-700" style={{ color: "#334155" }} />
            <input
              type="text"
              placeholder="搜索发票号、商户、销货方..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-bold"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-slate-700" style={{ color: "#334155" }} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              className="border border-slate-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer font-bold"
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

          {/* Duplicate filter check */}
          <label className="flex items-center space-x-1.5 text-xs cursor-pointer px-3 py-1.5 rounded-xl border border-slate-300 font-bold bg-white" style={{ color: "#0f172a" }}>
            <input
              type="checkbox"
              checked={filterDuplicateOnly}
              onChange={(e) => setFilterDuplicateOnly(e.target.checked)}
              className="accent-amber-600 rounded cursor-pointer w-4 h-4"
            />
            <span style={{ color: "#0f172a" }}>仅筛选重复发票 ({duplicateCount}张)</span>
          </label>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onAddCustomInvoice}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
            style={{ color: "#0f172a" }}
          >
            <Plus className="w-3.5 h-3.5 text-slate-700" style={{ color: "#334155" }} />
            <span style={{ color: "#0f172a" }}>手动新建发票</span>
          </button>

          <button
            onClick={() => exportInvoicesToExcel(invoices, systemSettings, `发票查重汇总台账_${new Date().toISOString().split("T")[0]}.xlsx`)}
            className="flex items-center space-x-1 px-3.5 py-1.5 bg-[#009966] hover:bg-[#007A52] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span className="text-white font-bold">导出 Excel 表格</span>
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 font-extrabold" style={{ color: "#0f172a" }}>
                <th className="p-3.5 w-10 text-center">
                  <button
                    onClick={() => onToggleSelectAll(!allSelected)}
                    className="cursor-pointer"
                    title={allSelected ? "取消全选" : "全选包含在拼版排版中"}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#E8000A]" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </th>
                <th className="p-3.5 font-bold" style={{ color: "#0f172a" }}>发票类型与代码</th>
                <th className="p-3.5 font-bold" style={{ color: "#0f172a" }}>发票号码 (相同号码同色标出)</th>
                <th className="p-3.5 font-bold" style={{ color: "#0f172a" }}>开票日期</th>
                <th className="p-3.5 font-bold" style={{ color: "#0f172a" }}>销货方名称</th>
                <th className="p-3.5 font-bold" style={{ color: "#0f172a" }}>分类</th>
                <th className="p-3.5 text-right font-bold" style={{ color: "#0f172a" }}>含税金额(元)</th>
                <th className="p-3.5 text-center font-bold" style={{ color: "#0f172a" }}>查重状态与标记</th>
                <th className="p-3.5 text-right font-bold" style={{ color: "#0f172a" }}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 font-sans font-medium">
                    没有找到符合条件的发票记录
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
                          ? "bg-white hover:bg-slate-50"
                          : "bg-slate-50/70"
                      }`}
                      style={{ color: "#0f172a" }}
                    >
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => onToggleSelectForPrint(inv.id)}
                          className="cursor-pointer"
                        >
                          {inv.selectedForPrint ? (
                            <CheckSquare className="w-4 h-4 text-[#E8000A]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>

                      {/* Invoice Type & Code */}
                      <td className="p-3.5 font-sans">
                        <div className="font-extrabold text-slate-900" style={{ color: "#0f172a" }}>{inv.invoiceType}</div>
                        <div className="text-[10px] font-mono mt-0.5 text-slate-500" style={{ color: "#64748b" }}>
                          {inv.invoiceCode ? `代码: ${inv.invoiceCode}` : "电子发票(无代码)"}
                        </div>
                      </td>

                      {/* Invoice Number */}
                      <td className="p-3.5 font-bold">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-black text-[#E8000A]" style={{ color: "#E8000A" }}>{inv.invoiceNumber}</span>
                          {palette && (
                            <span
                              className={`px-2 py-0.5 text-[9px] rounded-md border ${palette.badgeBg}`}
                              style={{ color: "#78350f" }}
                              title={`相同号码发票重复出现在台账中 (重复组 #${dupInfo.groupIndex + 1})`}
                            >
                              重号组#{dupInfo.groupIndex + 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 font-semibold text-slate-700" style={{ color: "#334155" }}>{inv.issueDate}</td>

                      {/* Seller */}
                      <td className="p-3.5 font-sans truncate max-w-[170px] font-bold text-slate-900" style={{ color: "#0f172a" }}>
                        {inv.sellerName}
                      </td>

                      {/* Category Badge */}
                      <td className="p-3.5 font-sans">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border bg-slate-100 text-slate-800 border-slate-300" style={{ color: "#1e293b" }}>
                          {inv.category}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 text-right font-mono font-black text-sm text-[#009966]" style={{ color: "#009966" }}>
                        ¥{inv.totalAmountWithTax.toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center font-sans">
                        {dupInfo ? (
                          <span className="inline-flex items-center space-x-1 font-bold px-2 py-0.5 rounded-full border text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>⚠️ 发票重复 ({dupInfo.totalInGroup}张)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 font-bold px-2 py-0.5 rounded-full border text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>✓ 已核验</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right font-sans space-x-1.5">
                        <button
                          onClick={() => onEditInvoice(inv)}
                          className="px-2.5 py-1 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>编辑</span>
                        </button>

                        <button
                          onClick={() => onDeleteInvoice(inv.id)}
                          className="px-2.5 py-1 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-colors cursor-pointer"
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
