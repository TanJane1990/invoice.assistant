import React, { useState, useMemo } from "react";
import { InvoiceData, SystemSettings } from "../types";
import { FileText, Edit2, Printer } from "lucide-react";
import { numberToRMB } from "../utils/numberToRMB";

interface ReimbursementCoverProps {
  selectedInvoices?: InvoiceData[];
  invoices?: InvoiceData[];
  settings?: SystemSettings;
  defaultSettings?: SystemSettings;
  config?: any;
  theme?: "light" | "dark";
  onPrintCover?: () => void;
  onOpenBatchImport?: () => void;
}

export const ReimbursementCover: React.FC<ReimbursementCoverProps> = ({
  selectedInvoices,
  invoices,
  settings,
  defaultSettings,
  config,
  theme = "dark",
  onPrintCover,
}) => {
  const isDark = theme === "dark";
  const rawList = selectedInvoices || invoices || [];
  const activeInvoices = Array.isArray(rawList)
    ? rawList.filter((i) => i && (i.selectedForPrint || rawList.length === 1))
    : [];
  const activeSettings = settings || defaultSettings || ({} as SystemSettings);

  const [formData, setFormData] = useState({
    companyName: activeSettings?.defaultCompany || "示例单位名称",
    department: activeSettings?.defaultDepartment || "猫粮研发部",
    applicant: activeSettings?.defaultApplicant || "张喵喵",
    reimbursementNo: `BX-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-001`,
    date: new Date().toISOString().split("T")[0],
    approver: activeSettings?.defaultApprover || "李喵喵",
    financeAuditor: activeSettings?.defaultFinanceAuditor || "陈喵喵",
    cashier: activeSettings?.defaultCashier || "王喵喵",
    reason: "三季度客户拜访与办公用品出差报销",
  });

  const [isEditing, setIsEditing] = useState(false);

  // Group invoices by category and calculate total (Default 1 row if empty)
  const categorySummary = activeInvoices.length > 0
    ? activeInvoices.reduce((acc, inv) => {
        const cat = inv?.category || "其他";
        const amt = typeof inv?.totalAmountWithTax === "number" && !isNaN(inv.totalAmountWithTax) ? inv.totalAmountWithTax : 0;
        acc[cat] = (acc[cat] || 0) + amt;
        return acc;
      }, {} as Record<string, number>)
    : { "其他": 0 };

  const grandTotal = activeInvoices.reduce(
    (sum, inv) => sum + (typeof inv?.totalAmountWithTax === "number" && !isNaN(inv.totalAmountWithTax) ? inv.totalAmountWithTax : 0),
    0
  );

  const categoryCount = Object.keys(categorySummary).length;

  // 智能自适应分页算法：精准根据上方「费用分类汇总」行数及事由高度动态计算首页发票条数
  // 核心原则：分类每多 1 行（占用约 6.2mm 空间），首页发票容量自动缩减 1 条（顺延至下一页），
  // 确保发票表格底边与签章栏顶部分割线之间始终保持恒定优雅的 8~12mm 舒适间距，永不重叠压线！
  const page1Capacity = useMemo(() => {
    // 基础基准：常规 1~3 个分类时，首页安全容纳 20 条
    let capacity = 20;

    // 当分类超过 3 个时（如 4、5、6 个分类），每多 1 个分类，动态顺延 1 条发票进入下一页
    if (categoryCount > 3) {
      capacity -= (categoryCount - 3);
    }

    // 若报销事由文字极长导致多行折行（超过 38 个字符），额外预留 1 条发票空间
    if (formData.reason && formData.reason.length > 38) {
      capacity -= 1;
    }

    // 最低安全保底
    return Math.max(10, capacity);
  }, [categoryCount, formData.reason]);

  // 附表续页（无上方分类汇总与事由表格，整页全明细）每页标准安全容纳30条
  const subsequentPageCapacity = 30;

  // 分页计算：当明细超过首页容量时自动分页生成续表
  const coverPages = useMemo(() => {
    if (activeInvoices.length === 0) {
      return [
        {
          pageIndex: 0,
          totalPages: 1,
          invoices: [] as InvoiceData[],
          isFirstPage: true,
          startIndex: 0,
        },
      ];
    }

    if (activeInvoices.length <= page1Capacity) {
      return [
        {
          pageIndex: 0,
          totalPages: 1,
          invoices: activeInvoices,
          isFirstPage: true,
          startIndex: 0,
        },
      ];
    }

    const pages: Array<{
      pageIndex: number;
      totalPages: number;
      invoices: InvoiceData[];
      isFirstPage: boolean;
      startIndex: number;
    }> = [];

    // 首页（包含报销主表信息与首批明细）
    pages.push({
      pageIndex: 0,
      totalPages: 1,
      invoices: activeInvoices.slice(0, page1Capacity),
      isFirstPage: true,
      startIndex: 0,
    });

    // 续表页（纯明细续页）
    let currentIdx = page1Capacity;
    let pageNum = 1;
    while (currentIdx < activeInvoices.length) {
      const pageInvoices = activeInvoices.slice(currentIdx, currentIdx + subsequentPageCapacity);
      pages.push({
        pageIndex: pageNum,
        totalPages: 1,
        invoices: pageInvoices,
        isFirstPage: false,
        startIndex: currentIdx,
      });
      currentIdx += subsequentPageCapacity;
      pageNum++;
    }

    const total = pages.length;
    pages.forEach((p) => {
      p.totalPages = total;
    });

    return pages;
  }, [activeInvoices, page1Capacity, subsequentPageCapacity]);

  return (
    <div className="w-full max-w-5xl mx-auto py-6 px-4 space-y-6 print:p-0 print:m-0 print:max-w-none print:space-y-0">
      {/* Action Header (铺满宽屏卡片，左右舒展对齐) */}
      <div
        className={`no-print p-4 sm:p-5 rounded-2xl border flex items-center justify-between gap-4 shadow-md transition-colors w-full ${
          isDark
            ? "border-[#1E293B] bg-[#121827] text-white"
            : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0 shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-base leading-snug" style={{ color: isDark ? "#ffffff" : "#0f172a" }}>
              企业费用报销凭证汇总单
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5" style={{ color: "#94a3b8" }}>
              已选包含 {activeInvoices.length} 张发票
              {coverPages.length > 1 ? `（自动分页为 ${coverPages.length} 页凭证单）` : ""} · 总金额 ¥
              {grandTotal.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs shrink-0">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl border font-bold transition cursor-pointer shrink-0 whitespace-nowrap shadow-xs ${
              isEditing
                ? "bg-red-600 text-white border-red-600"
                : isDark
                ? "bg-[#1E293B] hover:bg-[#334155] text-white border-[#334155]"
                : "bg-white hover:bg-slate-100 text-slate-800 border-slate-300"
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditing ? "完成编辑" : "编辑封面信息"}</span>
          </button>

          {onPrintCover && (
            <button
              onClick={onPrintCover}
              className="flex items-center space-x-1.5 px-4.5 py-2 bg-[#E8000A] hover:bg-[#C80009] text-white font-bold rounded-xl shadow-sm transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>打印此封面单</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit Form Drawer */}
      {isEditing && (
        <div
          className={`no-print p-5 rounded-2xl border space-y-4 text-xs w-full shadow-md ${
            isDark
              ? "bg-[#121827] border-[#1E293B] text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block mb-1 font-bold">单位名称</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-bold">报销部门</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-bold">报销申请人</label>
              <input
                type="text"
                value={formData.applicant}
                onChange={(e) => setFormData({ ...formData, applicant: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-bold">报销单号</label>
              <input
                type="text"
                value={formData.reimbursementNo}
                onChange={(e) => setFormData({ ...formData, reimbursementNo: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold font-mono"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-bold">填单日期</label>
              <input
                type="date"
                value={formData.date || new Date().toISOString().split("T")[0]}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold font-mono"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-bold">主管审批人</label>
              <input
                type="text"
                value={formData.approver}
                onChange={(e) => setFormData({ ...formData, approver: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-bold">财务复核人</label>
              <input
                type="text"
                value={formData.financeAuditor}
                onChange={(e) => setFormData({ ...formData, financeAuditor: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-bold">出纳或经办人</label>
              <input
                type="text"
                value={formData.cashier}
                onChange={(e) => setFormData({ ...formData, cashier: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block mb-1 font-bold">报销事由</label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Printable Paper Pages Container */}
      <div className="space-y-10 print:space-y-0">
        {coverPages.map((pageData, pageIdx) => {
          const pageInvoices = pageData.invoices;
          const isFirstPage = pageData.isFirstPage;
          const pageSubtotal = pageInvoices.reduce(
            (sum, inv) =>
              sum +
              (typeof inv?.totalAmountWithTax === "number" && !isNaN(inv.totalAmountWithTax)
                ? inv.totalAmountWithTax
                : 0),
            0
          );

          return (
            <div
              key={`cover-page-${pageIdx}`}
              className="a4-print-page-wrapper portrait-mode relative flex flex-col items-center z-0 print:m-0 print:p-0"
            >
              {/* On-screen Page Badge (hidden in print) */}
              <div
                className={`no-print mb-2 flex items-center justify-between text-xs font-semibold px-2 py-1 rounded-md ${
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
                }`}
                style={{ width: "210mm" }}
              >
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  <span>
                    费用报销凭证单 · 第 {pageIdx + 1} 页 / 共 {coverPages.length} 页 (A4 纵向 210×297mm)
                  </span>
                </span>
                <span className="font-mono">
                  {isFirstPage
                    ? `封面主表 (${pageInvoices.length} 笔明细)`
                    : `附表明细 (第 ${pageData.startIndex + 1} ~ ${pageData.startIndex + pageInvoices.length} 笔，共 ${pageInvoices.length} 笔)`}
                </span>
              </div>

              {/* Printable Paper Voucher (Standard Fixed Portrait A4 Voucher: 210×297mm) */}
              <div
                className={`a4-print-page a4-print-cover-page bg-white text-slate-900 shadow-2xl border border-slate-300 mx-auto font-sans relative flex flex-col justify-between ${
                  config?.grayscale ? "grayscale-mode" : ""
                }`}
                style={{
                  width: "210mm",
                  maxWidth: "210mm",
                  height: "296mm",
                  minHeight: "296mm",
                  maxHeight: "296mm",
                  padding: "14mm 15mm",
                  boxSizing: "border-box",
                  color: "#000000",
                  backgroundColor: "#ffffff",
                  pageBreakInside: "avoid",
                  breakInside: "avoid",
                  pageBreakAfter: "auto",
                  breakAfter: "auto",
                  overflow: "hidden",
                }}
              >
                {isFirstPage ? (
                  /* 首页：标准企业费用报销凭证主单 */
                  <div className="flex flex-col space-y-3.5">
                    {/* Title */}
                    <div className="text-center pt-2 pb-1 mb-1 flex flex-col items-center">
                      <div className="inline-flex flex-col items-center">
                        <h2
                          className="text-3xl font-extrabold tracking-[0.2em] font-serif text-slate-900 leading-tight px-6"
                          style={{ color: "#000000" }}
                        >
                          费 用 报 销 凭 证 单
                        </h2>
                        {/* 独立标题下划线：与汉字底部拉开舒适间距 */}
                        <div
                          className="w-full border-b-2 border-slate-900 mt-2.5"
                          style={{ borderColor: "#000000" }}
                        />
                      </div>
                    </div>

                    {/* Sub-header info */}
                    <div
                      className="flex items-center justify-between text-xs font-semibold border-b border-slate-800 pb-2 mb-1"
                      style={{ color: "#000000" }}
                    >
                      <div>
                        <span>报销部门: </span>
                        <span className="font-bold">{formData.department}</span>
                      </div>
                      <div>
                        <span>报销单号: </span>
                        <span className="font-mono font-bold">{formData.reimbursementNo}</span>
                      </div>
                      <div>
                        <span>填单日期: </span>
                        <span className="font-mono font-bold">
                          {formData.date || new Date().toISOString().split("T")[0]}
                        </span>
                      </div>
                      {coverPages.length > 1 && (
                        <div>
                          <span>页码: </span>
                          <span className="font-mono font-bold">第 1 页 / 共 {coverPages.length} 页</span>
                        </div>
                      )}
                    </div>

                    {/* Top Summary Table (单位名称/报销人/报销事由、报销部门/附发票张数 严格首字尾字两端分散对齐) */}
                    <table
                      className="w-full text-xs border-collapse border border-slate-900"
                      style={{ borderColor: "#000000", color: "#000000" }}
                    >
                      <tbody>
                        <tr className="border-b border-slate-900" style={{ borderColor: "#000000" }}>
                          <td
                            className="py-1.5 px-2 border-r border-slate-900 font-bold bg-slate-100 w-24 text-center"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            <div className="flex justify-center">
                              <span className="inline-flex justify-between w-[4.4em]">
                                <span>单</span>
                                <span>位</span>
                                <span>名</span>
                                <span>称</span>
                              </span>
                            </div>
                          </td>
                          <td
                            className="py-1.5 px-2.5 border-r border-slate-900 text-left font-bold w-[220px] truncate"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            {formData.companyName}
                          </td>
                          <td
                            className="py-1.5 px-2 border-r border-slate-900 font-bold bg-slate-100 w-28 text-center"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            <div className="flex justify-center">
                              <span className="inline-flex justify-between w-[5.5em]">
                                <span>报</span>
                                <span>销</span>
                                <span>部</span>
                                <span>门</span>
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2.5 text-left font-bold" style={{ color: "#000000" }}>
                            {formData.department}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-900" style={{ borderColor: "#000000" }}>
                          <td
                            className="py-1.5 px-2 border-r border-slate-900 font-bold bg-slate-100 w-24 text-center"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            <div className="flex justify-center">
                              <span className="inline-flex justify-between w-[4.4em]">
                                <span>报</span>
                                <span>销</span>
                                <span>人</span>
                              </span>
                            </div>
                          </td>
                          <td
                            className="py-1.5 px-2.5 border-r border-slate-900 text-left font-bold w-[220px]"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            {formData.applicant}
                          </td>
                          <td
                            className="py-1.5 px-2 border-r border-slate-900 font-bold bg-slate-100 w-28 text-center"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            <div className="flex justify-center">
                              <span className="inline-flex justify-between w-[5.5em]">
                                <span>附</span>
                                <span>发</span>
                                <span>票</span>
                                <span>张</span>
                                <span>数</span>
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2.5 text-left font-bold" style={{ color: "#000000" }}>
                            {activeInvoices.length} 张 {coverPages.length > 1 ? `(共 ${coverPages.length} 页凭证单)` : ""}
                          </td>
                        </tr>
                        <tr>
                          <td
                            className="py-1.5 px-2 border-r border-slate-900 font-bold bg-slate-100 w-24 text-center"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            <div className="flex justify-center">
                              <span className="inline-flex justify-between w-[4.4em]">
                                <span>报</span>
                                <span>销</span>
                                <span>事</span>
                                <span>由</span>
                              </span>
                            </div>
                          </td>
                          <td colSpan={3} className="py-1.5 px-2.5 text-left font-medium" style={{ color: "#000000" }}>
                            {formData.reason}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Category Breakdown Table */}
                    <div className="border border-slate-900" style={{ borderColor: "#000000" }}>
                      <div
                        className="bg-slate-100 text-center py-1 font-bold text-xs border-b border-slate-900 tracking-wider"
                        style={{ borderColor: "#000000", color: "#000000" }}
                      >
                        费 用 分 类 销 账 明 细 汇 总
                      </div>
                      <table className="w-full text-xs border-collapse" style={{ color: "#000000" }}>
                        <thead>
                          <tr
                            className="border-b border-slate-900 bg-slate-50 font-bold"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            <th
                              className="py-1.5 px-2 text-left border-r border-slate-900"
                              style={{ borderColor: "#000000", color: "#000000" }}
                            >
                              费用类别
                            </th>
                            <th
                              className="py-1.5 px-2 text-center border-r border-slate-900 w-32"
                              style={{ borderColor: "#000000", color: "#000000" }}
                            >
                              包含笔数
                            </th>
                            <th className="py-1.5 px-2 text-right w-36" style={{ color: "#000000" }}>
                              小计金额 (元)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(categorySummary).map(([cat, amt]) => {
                            const count = activeInvoices.filter((i) => i.category === cat).length;
                            return (
                              <tr
                                key={cat}
                                className="border-b border-slate-900 last:border-b-0"
                                style={{ borderColor: "#000000", color: "#000000" }}
                              >
                                <td
                                  className="py-1.5 px-2 font-bold border-r border-slate-900"
                                  style={{ borderColor: "#000000", color: "#000000" }}
                                >
                                  {cat}
                                </td>
                                <td
                                  className="py-1.5 px-2 text-center font-mono border-r border-slate-900"
                                  style={{ borderColor: "#000000", color: "#000000" }}
                                >
                                  {count} 笔
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono font-bold" style={{ color: "#000000" }}>
                                  ¥{Number(amt).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Grand Total Bar */}
                    <div
                      className="border-2 border-slate-900 py-1.5 px-3 flex items-center justify-between text-xs font-bold bg-white"
                      style={{ borderColor: "#000000", color: "#000000" }}
                    >
                      <div>
                        <span>报销金额合计 (大写): </span>
                        <span className="font-serif text-sm ml-1 font-extrabold" style={{ color: "#000000" }}>
                          {numberToRMB(grandTotal)}
                        </span>
                      </div>
                      <div className="text-base font-mono font-extrabold" style={{ color: "#000000" }}>
                        ¥{grandTotal.toFixed(2)}
                      </div>
                    </div>

                    {/* Attachment Invoice Itemization Table */}
                    <div className="border-b border-dashed border-slate-500 my-0.5" style={{ borderColor: "#64748b" }} />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: "#000000" }}>
                        <span>附件发票明细清单:</span>
                        {coverPages.length > 1 && (
                          <span className="text-[10px] text-slate-700 font-semibold font-mono">
                            [第 1 页 / 共 {coverPages.length} 页 · 本页列出 1~{pageInvoices.length} 笔 · 续表明细见附页]
                          </span>
                        )}
                      </div>
                      <table
                        className="w-full text-[11px] border-collapse border border-slate-900"
                        style={{ borderColor: "#000000", color: "#000000" }}
                      >
                        <thead>
                          <tr
                            className="bg-slate-100 border-b border-slate-900 font-bold"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            <th className="py-1 px-1.5 text-center border-r border-slate-900 w-12">序号</th>
                            <th className="py-1 px-1.5 text-left border-r border-slate-900 w-36">发票号码</th>
                            <th className="py-1 px-1.5 text-left border-r border-slate-900 w-24">开票日期</th>
                            <th className="py-1 px-1.5 text-left border-r border-slate-900">开票单位</th>
                            <th className="py-1 px-1.5 text-center border-r border-slate-900 w-16">类别</th>
                            <th className="py-1 px-1.5 text-right w-20">金额 (元)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeInvoices.length === 0 ? (
                            <tr className="border-b border-slate-900 font-sans text-[11px]" style={{ color: "#000000" }}>
                              <td colSpan={6} className="py-2 px-2 text-center text-slate-600 font-medium">
                                （暂未勾选发票，请在【发票台账与查重】中勾选发票后自动在此列出明细）
                              </td>
                            </tr>
                          ) : (
                            pageInvoices.map((inv, idx) => (
                              <tr
                                key={inv.id}
                                className="border-b border-slate-900 last:border-b-0 font-mono text-[11px]"
                                style={{ borderColor: "#000000", color: "#000000" }}
                              >
                                <td
                                  className="py-1 px-1.5 border-r border-slate-900 text-center font-sans text-slate-700 font-medium"
                                  style={{ borderColor: "#000000" }}
                                >
                                  {pageData.startIndex + idx + 1}
                                </td>
                                <td
                                  className="py-1 px-1.5 border-r border-slate-900 font-bold"
                                  style={{ borderColor: "#000000" }}
                                >
                                  {inv.invoiceNumber}
                                </td>
                                <td
                                  className="py-1 px-1.5 border-r border-slate-900"
                                  style={{ borderColor: "#000000" }}
                                >
                                  {inv.issueDate}
                                </td>
                                <td
                                  className="py-1 px-1.5 border-r border-slate-900 font-sans truncate max-w-[180px]"
                                  style={{ borderColor: "#000000" }}
                                >
                                  {inv.sellerName || "-"}
                                </td>
                                <td
                                  className="py-1 px-1.5 border-r border-slate-900 text-center font-sans"
                                  style={{ borderColor: "#000000" }}
                                >
                                  {inv.category}
                                </td>
                                <td className="py-1 px-1.5 text-right font-bold">¥{inv.totalAmountWithTax.toFixed(2)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* 续页：附件发票明细清单续表（纯明细清单） */
                  <div className="flex flex-col space-y-3">
                    {/* Continuation Title */}
                    <div className="text-center pt-2 pb-1 mb-1 flex flex-col items-center">
                      <div className="inline-flex flex-col items-center">
                        <h2
                          className="text-3xl font-extrabold tracking-[0.2em] font-serif text-slate-900 leading-tight px-6"
                          style={{ color: "#000000" }}
                        >
                          费 用 报 销 凭 证 单
                        </h2>
                        <div
                          className="w-full border-b-2 border-slate-900 mt-2.5"
                          style={{ borderColor: "#000000" }}
                        />
                      </div>
                    </div>

                    {/* Sub-header info */}
                    <div
                      className="flex items-center justify-between text-xs font-semibold border-b border-slate-800 pb-2 mb-1"
                      style={{ color: "#000000" }}
                    >
                      <div>
                        <span>报销部门: </span>
                        <span className="font-bold">{formData.department}</span>
                      </div>
                      <div>
                        <span>报销人: </span>
                        <span className="font-bold">{formData.applicant}</span>
                      </div>
                      <div>
                        <span>报销单号: </span>
                        <span className="font-mono font-bold">{formData.reimbursementNo}</span>
                      </div>
                      <div>
                        <span>填单日期: </span>
                        <span className="font-mono font-bold">
                          {formData.date || new Date().toISOString().split("T")[0]}
                        </span>
                      </div>
                      <div>
                        <span>页码: </span>
                        <span className="font-bold font-mono">
                          第 {pageIdx + 1} 页 / 共 {coverPages.length} 页
                        </span>
                      </div>
                    </div>

                    {/* Continuation Invoices Table */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: "#000000" }}>
                        <span>附件发票明细清单:</span>
                        <span className="text-[10px] text-slate-700 font-semibold font-mono">
                          [第 {pageIdx + 1} 页 / 共 {coverPages.length} 页 · 本页列出第 {pageData.startIndex + 1} ~ {pageData.startIndex + pageInvoices.length} 笔 · 共 {pageInvoices.length} 笔]
                        </span>
                      </div>
                      <table
                        className="w-full text-[11px] border-collapse border border-slate-900"
                        style={{ borderColor: "#000000", color: "#000000" }}
                      >
                        <thead>
                          <tr
                            className="bg-slate-100 border-b border-slate-900 font-bold"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            <th className="py-1 px-1.5 text-center border-r border-slate-900 w-12">序号</th>
                            <th className="py-1 px-1.5 text-left border-r border-slate-900 w-36">发票号码</th>
                            <th className="py-1 px-1.5 text-left border-r border-slate-900 w-24">开票日期</th>
                            <th className="py-1 px-1.5 text-left border-r border-slate-900">开票单位</th>
                            <th className="py-1 px-1.5 text-center border-r border-slate-900 w-16">类别</th>
                            <th className="py-1 px-1.5 text-right w-24">金额 (元)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageInvoices.map((inv, idx) => (
                            <tr
                              key={inv.id}
                              className="border-b border-slate-900 last:border-b-0 font-mono text-[11px]"
                              style={{ borderColor: "#000000", color: "#000000" }}
                            >
                              <td
                                className="py-1 px-1.5 border-r border-slate-900 text-center font-sans text-slate-700 font-medium"
                                style={{ borderColor: "#000000" }}
                              >
                                {pageData.startIndex + idx + 1}
                              </td>
                              <td
                                className="py-1 px-1.5 border-r border-slate-900 font-bold"
                                style={{ borderColor: "#000000" }}
                              >
                                {inv.invoiceNumber}
                              </td>
                              <td
                                className="py-1 px-1.5 border-r border-slate-900"
                                style={{ borderColor: "#000000" }}
                              >
                                {inv.issueDate}
                              </td>
                              <td
                                className="py-1 px-1.5 border-r border-slate-900 font-sans truncate max-w-[200px]"
                                style={{ borderColor: "#000000" }}
                              >
                                {inv.sellerName || "-"}
                              </td>
                              <td
                                className="py-1 px-1.5 border-r border-slate-900 text-center font-sans"
                                style={{ borderColor: "#000000" }}
                              >
                                {inv.category}
                              </td>
                              <td className="py-1 px-1.5 text-right font-bold">
                                ¥{inv.totalAmountWithTax.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr
                            className="bg-slate-50 font-bold border-t border-slate-900 text-[11px]"
                            style={{ borderColor: "#000000", color: "#000000" }}
                          >
                            <td
                              colSpan={4}
                              className="py-1.5 px-2 border-r border-slate-900 text-left font-sans"
                              style={{ borderColor: "#000000" }}
                            >
                              本页小计（第 {pageData.startIndex + 1} ~{" "}
                              {pageData.startIndex + pageInvoices.length} 笔，共 {pageInvoices.length} 笔） ·
                              整单发票累计 {activeInvoices.length} 张
                            </td>
                            <td
                              className="py-1.5 px-1.5 border-r border-slate-900 text-center font-sans"
                              style={{ borderColor: "#000000" }}
                            >
                              本页小计
                            </td>
                            <td className="py-1.5 px-1.5 text-right font-mono font-bold">
                              ¥{pageSubtotal.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Approval Signatures Footer (Naturally docked at bottom) */}
                <div
                  className="grid grid-cols-4 gap-2 pt-2.5 border-t border-slate-900 text-xs font-semibold mt-auto"
                  style={{ borderColor: "#000000", color: "#000000" }}
                >
                  <div>
                    <span>主管审批: </span>
                    <span className="font-bold underline" style={{ color: "#000000" }}>
                      {formData.approver}
                    </span>
                  </div>
                  <div>
                    <span>财务复核: </span>
                    <span className="font-bold underline" style={{ color: "#000000" }}>
                      {formData.financeAuditor}
                    </span>
                  </div>
                  <div>
                    <span>出纳或经办人: </span>
                    <span className="font-bold underline" style={{ color: "#000000" }}>
                      {formData.cashier}
                    </span>
                  </div>
                  <div>
                    <span>报销人签章: </span>
                    <span className="font-bold underline" style={{ color: "#000000" }}>
                      {formData.applicant}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

