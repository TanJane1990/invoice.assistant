import React, { useState } from "react";
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

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Action Header */}
      <div
        className={`no-print p-4 rounded-2xl border flex items-center justify-between shadow-md transition-colors ${
          isDark
            ? "border-[#1E293B] bg-[#121827] text-white"
            : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-red-500" />
          <div>
            <h3 className="font-extrabold text-sm text-white" style={{ color: "#ffffff" }}>
              企业费用报销凭证汇总单
            </h3>
            <p className="text-xs text-slate-400 font-medium" style={{ color: "#94a3b8" }}>
              可作为发票贴单最上层的报销封面单，已选包含 {activeInvoices.length} 张发票，总金额 ¥
              {grandTotal.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center space-x-1 px-3.5 py-1.5 rounded-xl border font-bold transition cursor-pointer ${
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
              className="flex items-center space-x-1 px-4 py-1.5 bg-[#E8000A] hover:bg-[#C80009] text-white font-bold rounded-xl shadow-sm transition cursor-pointer"
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
          className={`no-print p-5 rounded-2xl border space-y-4 text-xs ${
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

      {/* Printable Paper Voucher (Strict Portrait A4 Page - Natural Block Flow) */}
      <div
        className="a4-print-page a4-print-cover-page bg-white text-slate-900 shadow-2xl border border-slate-300 mx-auto font-sans relative"
        style={{
          width: "210mm",
          height: "auto",
          minHeight: "270mm",
          padding: "10mm 12mm",
          boxSizing: "border-box",
          color: "#000000",
          backgroundColor: "#ffffff",
          pageBreakInside: "avoid",
          breakInside: "avoid",
          pageBreakAfter: "always",
          breakAfter: "page",
        }}
      >
        {/* Title */}
        <div className="text-center mb-3">
          <h2
            className="text-xl font-extrabold tracking-[0.2em] font-serif text-slate-900 border-b-2 border-slate-900 pb-1.5 inline-block px-6"
            style={{ color: "#000000" }}
          >
            费 用 报 销 凭 证 单
          </h2>
        </div>

        {/* Sub-header info */}
        <div className="flex items-center justify-between text-xs font-semibold mb-2.5 border-b border-slate-800 pb-1.5" style={{ color: "#000000" }}>
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
            <span className="font-mono font-bold">{formData.date}</span>
          </div>
        </div>

        {/* Top Summary Table */}
        <table className="w-full text-xs border-collapse border border-slate-900 mb-2.5" style={{ borderColor: "#000000", color: "#000000" }}>
          <tbody>
            <tr className="border-b border-slate-900" style={{ borderColor: "#000000" }}>
              <td className="py-1 px-2 border-r border-slate-900 font-bold text-center bg-slate-100 w-20" style={{ borderColor: "#000000", color: "#000000" }}>
                报销人
              </td>
              <td className="py-1 px-2 border-r border-slate-900 text-left font-bold w-48" style={{ borderColor: "#000000", color: "#000000" }}>
                {formData.applicant}
              </td>
              <td className="py-1 px-2 border-r border-slate-900 font-bold text-center bg-slate-100 w-28" style={{ borderColor: "#000000", color: "#000000" }}>
                附发票张数
              </td>
              <td className="py-1 px-2 text-left font-bold" style={{ color: "#000000" }}>
                {activeInvoices.length} 张
              </td>
            </tr>
            <tr>
              <td className="py-1 px-2 border-r border-slate-900 font-bold text-center bg-slate-100" style={{ borderColor: "#000000", color: "#000000" }}>
                报销事由
              </td>
              <td colSpan={3} className="py-1 px-2 text-left font-medium" style={{ color: "#000000" }}>
                {formData.reason}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Category Breakdown Table */}
        <div className="border border-slate-900 mb-2.5" style={{ borderColor: "#000000" }}>
          <div className="bg-slate-100 text-center py-1 font-bold text-xs border-b border-slate-900 tracking-wider" style={{ borderColor: "#000000", color: "#000000" }}>
            费 用 分 类 销 账 明 细 汇 总
          </div>
          <table className="w-full text-xs border-collapse" style={{ color: "#000000" }}>
            <thead>
              <tr className="border-b border-slate-900 bg-slate-50 font-bold" style={{ borderColor: "#000000", color: "#000000" }}>
                <th className="py-1 px-2 text-left border-r border-slate-900" style={{ borderColor: "#000000", color: "#000000" }}>费用类别</th>
                <th className="py-1 px-2 text-center border-r border-slate-900 w-32" style={{ borderColor: "#000000", color: "#000000" }}>包含笔数</th>
                <th className="py-1 px-2 text-right w-36" style={{ color: "#000000" }}>小计金额 (元)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(categorySummary).map(([cat, amt]) => {
                const count = activeInvoices.filter((i) => i.category === cat).length;
                return (
                  <tr key={cat} className="border-b border-slate-900 last:border-b-0" style={{ borderColor: "#000000", color: "#000000" }}>
                    <td className="py-1 px-2 font-bold border-r border-slate-900" style={{ borderColor: "#000000", color: "#000000" }}>{cat}</td>
                    <td className="py-1 px-2 text-center font-mono border-r border-slate-900" style={{ borderColor: "#000000", color: "#000000" }}>{count} 笔</td>
                    <td className="py-1 px-2 text-right font-mono font-bold" style={{ color: "#000000" }}>¥{Number(amt).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Grand Total Bar */}
        <div className="border-2 border-slate-900 py-1.5 px-3 flex items-center justify-between text-xs font-bold mb-3 bg-white" style={{ borderColor: "#000000", color: "#000000" }}>
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
        <div className="border-b border-dashed border-slate-500 my-2.5" style={{ borderColor: "#64748b" }} />
        <div className="mb-4 space-y-1">
          <div className="text-[11px] font-bold" style={{ color: "#000000" }}>
            附件发票明细清单:
          </div>
          <table className="w-full text-[11px] border-collapse border border-slate-900" style={{ borderColor: "#000000", color: "#000000" }}>
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900 font-bold" style={{ borderColor: "#000000", color: "#000000" }}>
                <th className="py-1 px-1.5 text-left border-r border-slate-900">发票号码</th>
                <th className="py-1 px-1.5 text-left border-r border-slate-900 w-24">开票日期</th>
                <th className="py-1 px-1.5 text-left border-r border-slate-900">开票单位</th>
                <th className="py-1 px-1.5 text-center border-r border-slate-900 w-16">类别</th>
                <th className="py-1 px-1.5 text-right w-20">金额 (元)</th>
              </tr>
            </thead>
            <tbody>
              {activeInvoices.length === 0 ? (
                <tr className="border-b border-slate-900 font-sans text-[11px]" style={{ color: "#000000" }}>
                  <td colSpan={5} className="py-2 px-2 text-center text-slate-600 font-medium">
                    （暂未勾选发票，请在【发票台账与查重】中勾选发票后自动在此列出明细）
                  </td>
                </tr>
              ) : (
                activeInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-900 last:border-b-0 font-mono text-[11px]" style={{ borderColor: "#000000", color: "#000000" }}>
                    <td className="py-1 px-1.5 border-r border-slate-900 font-bold" style={{ borderColor: "#000000" }}>{inv.invoiceNumber}</td>
                    <td className="py-1 px-1.5 border-r border-slate-900" style={{ borderColor: "#000000" }}>{inv.issueDate}</td>
                    <td className="py-1 px-1.5 border-r border-slate-900 font-sans truncate max-w-[180px]" style={{ borderColor: "#000000" }}>{inv.sellerName || "-"}</td>
                    <td className="py-1 px-1.5 border-r border-slate-900 text-center font-sans" style={{ borderColor: "#000000" }}>{inv.category}</td>
                    <td className="py-1 px-1.5 text-right font-bold">¥{inv.totalAmountWithTax.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Approval Signatures Footer (Natural Flow directly beneath Attachment Table) */}
        <div className="grid grid-cols-4 gap-2 pt-3 border-t-2 border-slate-900 text-xs font-semibold" style={{ borderColor: "#000000", color: "#000000" }}>
          <div>
            <span>主管审批: </span>
            <span className="font-bold underline" style={{ color: "#000000" }}>{formData.approver}</span>
          </div>
          <div>
            <span>财务复核: </span>
            <span className="font-bold underline" style={{ color: "#000000" }}>{formData.financeAuditor}</span>
          </div>
          <div>
            <span>出纳或经办人: </span>
            <span className="font-bold underline" style={{ color: "#000000" }}>{formData.cashier}</span>
          </div>
          <div>
            <span>报销人签章: </span>
            <span className="font-bold underline" style={{ color: "#000000" }}>{formData.applicant}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
