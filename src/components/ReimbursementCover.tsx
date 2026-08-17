import React, { useState } from "react";
import { InvoiceData, SystemSettings } from "../types";
import { FileText, Edit2, Printer } from "lucide-react";
import { numberToRMB } from "../utils/numberToRMB";

interface ReimbursementCoverProps {
  selectedInvoices: InvoiceData[];
  settings: SystemSettings;
  theme?: "light" | "dark";
  onPrintCover?: () => void;
}

export const ReimbursementCover: React.FC<ReimbursementCoverProps> = ({
  selectedInvoices,
  settings,
  theme = "dark",
  onPrintCover,
}) => {
  const isDark = theme === "dark";

  const [formData, setFormData] = useState({
    companyName: settings.defaultCompany || "示例单位名称",
    department: settings.defaultDepartment || "猫粮研发部",
    applicant: settings.defaultApplicant || "张喵喵",
    reimbursementNo: `BX-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-001`,
    date: new Date().toISOString().split("T")[0],
    approver: settings.defaultApprover || "李喵喵",
    financeAuditor: settings.defaultFinanceAuditor || "陈喵喵",
    cashier: settings.defaultCashier || "王喵喵",
    reason: "三季度客户拜访与办公用品出差报销",
  });

  const [isEditing, setIsEditing] = useState(false);

  // Group invoices by category and calculate total
  const categorySummary = selectedInvoices.reduce((acc, inv) => {
    const cat = inv.category || "其他";
    acc[cat] = (acc[cat] || 0) + inv.totalAmountWithTax;
    return acc;
  }, {} as Record<string, number>);

  const grandTotal = selectedInvoices.reduce(
    (sum, inv) => sum + inv.totalAmountWithTax,
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
              可作为发票贴单最上层的报销封面单，已选包含 {selectedInvoices.length} 张发票，总金额 ¥
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

      {/* Printable Paper Voucher (1:1 Match to Image 3) */}
      <div
        className="a4-print-page bg-white text-slate-900 p-8 rounded-xl shadow-xl border border-slate-200 mx-auto font-sans"
        style={{ width: "210mm", boxSizing: "border-box", color: "#0f172a" }}
      >
        {/* Title (Matching Image 3) */}
        <div className="text-center mb-4">
          <h2
            className="text-2xl font-extrabold tracking-[0.2em] font-serif text-slate-900 border-b-2 border-slate-900 pb-2 inline-block px-4"
            style={{ color: "#0f172a" }}
          >
            费 用 报 销 凭 证 单
          </h2>
        </div>

        {/* Sub-header info (Matching Image 3) */}
        <div className="flex items-center justify-between text-xs font-semibold mb-3 border-b border-slate-800 pb-2" style={{ color: "#0f172a" }}>
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

        {/* Top Summary Table (Matching Image 3) */}
        <table className="w-full text-xs border-collapse border border-slate-800 mb-4" style={{ borderColor: "#1e293b", color: "#0f172a" }}>
          <tbody>
            <tr className="border-b border-slate-800" style={{ borderColor: "#1e293b" }}>
              <td className="p-2 border-r border-slate-800 font-bold text-center bg-slate-100 w-20" style={{ borderColor: "#1e293b", color: "#0f172a" }}>
                报销人
              </td>
              <td className="p-2 border-r border-slate-800 text-left font-bold w-48" style={{ borderColor: "#1e293b", color: "#0f172a" }}>
                {formData.applicant}
              </td>
              <td className="p-2 border-r border-slate-800 font-bold text-center bg-slate-100 w-28" style={{ borderColor: "#1e293b", color: "#0f172a" }}>
                附发票张数
              </td>
              <td className="p-2 text-left font-bold text-[#E8000A]" style={{ color: "#E8000A" }}>
                {selectedInvoices.length} 张
              </td>
            </tr>
            <tr>
              <td className="p-2 border-r border-slate-800 font-bold text-center bg-slate-100" style={{ borderColor: "#1e293b", color: "#0f172a" }}>
                报销事由
              </td>
              <td colSpan={3} className="p-2 text-left font-medium" style={{ color: "#0f172a" }}>
                {formData.reason}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Category Breakdown Table (Matching Image 3) */}
        <div className="border border-slate-800 mb-4" style={{ borderColor: "#1e293b" }}>
          <div className="bg-slate-100 text-center py-1.5 font-bold text-xs border-b border-slate-800 tracking-wider" style={{ borderColor: "#1e293b", color: "#0f172a" }}>
            费 用 分 类 销 账 明 细 汇 总
          </div>
          <table className="w-full text-xs border-collapse" style={{ color: "#0f172a" }}>
            <thead>
              <tr className="border-b border-slate-800 bg-slate-50 font-bold" style={{ borderColor: "#1e293b", color: "#0f172a" }}>
                <th className="p-2 text-left border-r border-slate-800" style={{ borderColor: "#1e293b", color: "#0f172a" }}>费用类别</th>
                <th className="p-2 text-center border-r border-slate-800 w-32" style={{ borderColor: "#1e293b", color: "#0f172a" }}>包含笔数</th>
                <th className="p-2 text-right w-36" style={{ color: "#0f172a" }}>小计金额 (元)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(categorySummary).map(([cat, amt]) => {
                const count = selectedInvoices.filter((i) => i.category === cat).length;
                return (
                  <tr key={cat} className="border-b border-slate-800 last:border-b-0" style={{ borderColor: "#1e293b", color: "#0f172a" }}>
                    <td className="p-2 font-bold border-r border-slate-800" style={{ borderColor: "#1e293b", color: "#0f172a" }}>{cat}</td>
                    <td className="p-2 text-center font-mono border-r border-slate-800" style={{ borderColor: "#1e293b", color: "#0f172a" }}>{count} 笔</td>
                    <td className="p-2 text-right font-mono font-bold" style={{ color: "#0f172a" }}>¥{amt.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Grand Total Bar (Matching Image 3) */}
        <div className="border-2 border-slate-900 p-2.5 flex items-center justify-between text-xs font-bold mb-5 bg-white" style={{ borderColor: "#0f172a", color: "#0f172a" }}>
          <div>
            <span>报销金额合计 (大写): </span>
            <span className="text-[#E8000A] font-serif text-sm ml-1" style={{ color: "#E8000A" }}>
              {numberToRMB(grandTotal)}
            </span>
          </div>
          <div className="text-base font-mono font-extrabold" style={{ color: "#0f172a" }}>
            ¥{grandTotal.toFixed(2)}
          </div>
        </div>

        {/* Attachment Invoice Itemization Table (Matching Image 3) */}
        <div className="mb-6 space-y-1">
          <div className="text-[11px] font-bold text-slate-700" style={{ color: "#334155" }}>
            附件发票明细清单:
          </div>
          <table className="w-full text-[11px] border-collapse border border-slate-300" style={{ color: "#0f172a" }}>
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold" style={{ color: "#0f172a" }}>
                <th className="p-1.5 text-left border-r border-slate-300">发票号码</th>
                <th className="p-1.5 text-left border-r border-slate-300 w-24">开票日期</th>
                <th className="p-1.5 text-left border-r border-slate-300">开票单位</th>
                <th className="p-1.5 text-center border-r border-slate-300 w-16">类别</th>
                <th className="p-1.5 text-right w-20">金额 (元)</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-200 font-mono text-[11px]" style={{ color: "#0f172a" }}>
                  <td className="p-1.5 border-r border-slate-200 font-bold">{inv.invoiceNumber}</td>
                  <td className="p-1.5 border-r border-slate-200">{inv.issueDate}</td>
                  <td className="p-1.5 border-r border-slate-200 font-sans truncate max-w-[180px]">{inv.sellerName || "-"}</td>
                  <td className="p-1.5 border-r border-slate-200 text-center font-sans">{inv.category}</td>
                  <td className="p-1.5 text-right font-bold">¥{inv.totalAmountWithTax.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Approval Signatures Footer (Matching Image 3) */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-800 text-xs font-semibold text-slate-800" style={{ color: "#1e293b" }}>
          <div>
            <span>主管审批: </span>
            <span className="font-bold underline" style={{ color: "#0f172a" }}>{formData.approver}</span>
          </div>
          <div>
            <span>财务复核: </span>
            <span className="font-bold underline" style={{ color: "#0f172a" }}>{formData.financeAuditor}</span>
          </div>
          <div>
            <span>出纳或经办人: </span>
            <span className="font-bold underline" style={{ color: "#0f172a" }}>{formData.cashier}</span>
          </div>
          <div>
            <span>报销人签章: </span>
            <span className="font-bold underline" style={{ color: "#0f172a" }}>{formData.applicant}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
