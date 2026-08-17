import React, { useState } from "react";
import {
  Search,
  Filter,
  FileSpreadsheet,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Plus,
  CheckSquare,
  Square,
  ShieldAlert,
} from "lucide-react";
import { InvoiceData, SystemSettings } from "../types";
import { exportInvoicesToExcel, getLastExportInfo, LastExportInfo } from "../utils/exportExcel";
import { ExcelExportDialog } from "./ExcelExportDialog";

interface InvoiceLedgerTableProps {
  invoices: InvoiceData[];
  onDeleteInvoice: (id: string) => void;
  onEditInvoice: (invoice: InvoiceData) => void;
  onManualCreate?: () => void;
  onAddCustomInvoice?: () => void;
  onToggleSelectForPrint: (id: string) => void;
  onToggleSelectAll: (selected: boolean) => void;
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
  systemSettings,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterDuplicateOnly, setFilterDuplicateOnly] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [lastExportInfo, setLastExportInfo] = useState<LastExportInfo | null>(null);

  // 1. 发票重复计算引擎（按发票号码分组）
  const duplicateMap = React.useMemo(() => {
    const counts: Record<string, InvoiceData[]> = {};
    invoices.forEach((inv) => {
      if (inv.invoiceNumber && inv.invoiceNumber.trim()) {
        const num = inv.invoiceNumber.trim();
        if (!counts[num]) counts[num] = [];
        counts[num].push(inv);
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

  const duplicateGroupCount = new Set(Object.values(duplicateMap).map((d) => d.groupIndex)).size;

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

    return matchesSearch && matchesCategory && matchesDuplicate;
  });

  const allSelected =
    invoices.length > 0 && invoices.every((i) => i.selectedForPrint);
  const selectedForPrintCount = invoices.filter((i) => i.selectedForPrint).length;
  const duplicateCount = Object.keys(duplicateMap).length;

  // 触发导出 Excel：智能判定首次导出 vs 再次导出
  const handleExportButtonClick = () => {
    const historicalInfo = getLastExportInfo();
    if (!historicalInfo) {
      // 首次导出，直接弹出保存对话框另存
      exportInvoicesToExcel(invoices, systemSettings, "default");
    } else {
      // 发现此前导出过文件，弹出智能对话框供选择【追加/更新】还是【另存为新文件】
      setLastExportInfo(historicalInfo);
      setIsExportDialogOpen(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4 font-sans">
      {/* 1. 顶部统计卡片区域 (4列全景 1:1 对标) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 卡片 1: 台账总发票数 */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between" style={{ backgroundColor: "#ffffff" }}>
          <div className="text-xs font-bold" style={{ color: "#64748b" }}>
            台账总发票数
          </div>
          <div className="text-2xl font-black mt-2 flex items-baseline space-x-1" style={{ color: "#0f172a" }}>
            <span style={{ color: "#0f172a" }}>{invoices.length}</span>
            <span className="text-xs font-bold" style={{ color: "#64748b" }}>张</span>
          </div>
        </div>

        {/* 卡片 2: 拟排版打印数 */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between" style={{ backgroundColor: "#ffffff" }}>
          <div className="text-xs font-bold" style={{ color: "#64748b" }}>
            拟排版打印数
          </div>
          <div className="text-2xl font-black mt-2 flex items-baseline space-x-1" style={{ color: "#E8000A" }}>
            <span style={{ color: "#E8000A" }}>{selectedForPrintCount}</span>
            <span className="text-xs font-bold" style={{ color: "#64748b" }}>/ {invoices.length}</span>
          </div>
        </div>

        {/* 卡片 3: 总金额合计 */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between" style={{ backgroundColor: "#ffffff" }}>
          <div className="text-xs font-bold" style={{ color: "#64748b" }}>
            总金额合计
          </div>
          <div className="text-2xl font-black mt-2 font-mono" style={{ color: "#009966" }}>
            ¥{invoices.reduce((sum, i) => sum + i.totalAmountWithTax, 0).toFixed(2)}
          </div>
        </div>

        {/* 卡片 4: 相同发票号查重预警 */}
        <div
          onClick={() => setFilterDuplicateOnly((prev) => !prev)}
          className={`p-5 rounded-2xl border cursor-pointer transition-all shadow-sm flex flex-col justify-between ${
            duplicateCount > 0
              ? "bg-amber-50 border-amber-300"
              : "bg-white border-slate-200/80"
          }`}
          style={{ backgroundColor: duplicateCount > 0 ? "#fffbeb" : "#ffffff" }}
        >
          <div className="flex items-center justify-between text-xs font-bold" style={{ color: "#64748b" }}>
            <span style={{ color: "#64748b" }}>相同发票号查重预警</span>
            {duplicateCount > 0 && <ShieldAlert className="w-4 h-4 animate-pulse text-amber-600" />}
          </div>
          <div className="text-2xl font-black mt-2 flex items-baseline space-x-1.5" style={{ color: "#0f172a" }}>
            <span style={{ color: "#0f172a" }}>{duplicateCount}</span>
            <span className="text-xs font-bold" style={{ color: "#64748b" }}>
              {duplicateCount > 0 ? `张发票存在重复 (${duplicateGroupCount}组相同色块标出)` : "无重复发票"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 中间控制栏：搜索、分类与操作按钮 (1:1 对标) */}
      <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: "#ffffff" }}>
        {/* 左侧: 搜索框 & 分类选择 */}
        <div className="flex flex-wrap items-center space-x-3 gap-y-2">
          {/* 搜索框 */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5" style={{ color: "#64748b" }} />
            <input
              type="text"
              placeholder="搜索发票号、商户、销货方..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ color: "#0f172a", backgroundColor: "#F8FAFC" }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* 分类下拉列表 */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" style={{ color: "#64748b" }} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              className="border border-slate-300 text-xs rounded-xl px-3 py-1.5 font-bold focus:outline-none cursor-pointer"
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
          <label className="flex items-center space-x-1.5 text-xs cursor-pointer px-3 py-1.5 rounded-xl border border-amber-300 font-bold bg-amber-50" style={{ color: "#78350f", backgroundColor: "#fffbeb" }}>
            <input
              type="checkbox"
              checked={filterDuplicateOnly}
              onChange={(e) => setFilterDuplicateOnly(e.target.checked)}
              className="accent-amber-600 rounded cursor-pointer"
            />
            <span style={{ color: "#78350f" }}>仅筛选重复发票 ({duplicateCount}张)</span>
          </label>
        </div>

        {/* 右侧: 新建与导出 Excel 按钮 */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onManualCreate || onAddCustomInvoice}
            style={{ color: "#1e293b", backgroundColor: "#F1F5F9" }}
            className="px-4 py-2 hover:bg-slate-200 rounded-xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" style={{ color: "#475569" }} />
            <span style={{ color: "#1e293b" }}>手动新建发票</span>
          </button>

          <button
            onClick={handleExportButtonClick}
            style={{ color: "#ffffff", backgroundColor: "#009966" }}
            className="px-4 py-2 hover:bg-[#008055] rounded-xl text-xs font-extrabold shadow-sm transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" style={{ color: "#ffffff" }} />
            <span style={{ color: "#ffffff" }}>导出 Excel 表格</span>
          </button>
        </div>
      </div>

      {/* 3. 底部发票台账表格 (1:1 对标) */}
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
                <th className="p-3.5 font-bold whitespace-nowrap" style={{ color: "#1e293b" }}>发票类型与代码</th>
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
                filteredInvoices.map((inv) => {
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
                          : "bg-slate-50/70"
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
                      <td className="p-3.5 font-sans whitespace-nowrap max-w-[160px]">
                        <div className="font-extrabold truncate" title={inv.invoiceType} style={{ color: "#0f172a" }}>
                          {inv.invoiceType}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5 truncate" title={inv.invoiceCode ? `代码: ${inv.invoiceCode}` : "电子发票(无代码)"} style={{ color: "#64748b" }}>
                          {inv.invoiceCode ? `代码: ${inv.invoiceCode}` : "电子发票(无代码)"}
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
                          onClick={() => onDeleteInvoice(inv.id)}
                          style={{ color: "#DC2626", backgroundColor: "#FEE2E2" }}
                          className="px-2.5 py-1 hover:bg-red-100 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" style={{ color: "#DC2626" }} />
                          <span style={{ color: "#DC2626" }}>删除</span>
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

      {/* 4. 智能 Excel 导出与追加确认弹窗 */}
      <ExcelExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        lastExportInfo={lastExportInfo}
        onAppendToExisting={() => exportInvoicesToExcel(invoices, systemSettings, "append")}
        onSaveNewFile={() => exportInvoicesToExcel(invoices, systemSettings, "new")}
      />
    </div>
  );
};
