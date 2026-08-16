import React, { useState, useEffect } from "react";
import { InvoiceData, ReimbursementCoverData, SystemSettings, PrintConfig } from "../types";
import { numberToRMB } from "../utils/numberToRMB";
import { Printer, Edit2, Save, FileText } from "lucide-react";

interface ReimbursementCoverProps {
  invoices: InvoiceData[];
  defaultSettings?: SystemSettings;
  config?: PrintConfig;
  onOpenBatchImport?: () => void;
  theme?: "light" | "dark";
}

export const ReimbursementCover: React.FC<ReimbursementCoverProps> = ({
  invoices,
  defaultSettings,
  onOpenBatchImport,
  theme = "dark",
}) => {
  const isDark = theme === "dark";
  const selectedInvoices = invoices.filter((i) => i.selectedForPrint);

  const [formData, setFormData] = useState<ReimbursementCoverData>({
    companyName: defaultSettings?.defaultCompany || "会钓鱼的猫",
    department: defaultSettings?.defaultDepartment || "猫粮研发部",
    applicant: defaultSettings?.defaultApplicant || "张喵喵",
    reimbursementNo: `BX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`,
    date: new Date().toISOString().split("T")[0],
    reason: "三季度客户拜访与办公用品出差报销",
    approver: defaultSettings?.defaultApprover || "李喵喵",
    financeAuditor: defaultSettings?.defaultFinanceAuditor || "陈喵喵",
    cashier: defaultSettings?.defaultCashier || "王喵喵",
  });

  useEffect(() => {
    if (defaultSettings) {
      setFormData((prev) => ({
        ...prev,
        companyName: defaultSettings.defaultCompany || prev.companyName,
        department: defaultSettings.defaultDepartment || prev.department,
        applicant: defaultSettings.defaultApplicant || prev.applicant,
        approver: defaultSettings.defaultApprover || prev.approver,
        financeAuditor: defaultSettings.defaultFinanceAuditor || prev.financeAuditor,
        cashier: defaultSettings.defaultCashier || prev.cashier,
      }));
    }
  }, [defaultSettings]);

  const [isEditing, setIsEditing] = useState(false);

  // Group by category summary
  const categorySummary = selectedInvoices.reduce((acc, inv) => {
    acc[inv.category] = (acc[inv.category] || 0) + inv.totalAmountWithTax;
    return acc;
  }, {} as Record<string, number>);

  const grandTotal = selectedInvoices.reduce(
    (sum, inv) => sum + inv.totalAmountWithTax,
    0
  );

  if (selectedInvoices.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className={`flex flex-col items-center justify-center min-h-[55vh] p-8 text-center rounded-2xl border-2 border-dashed my-4 transition-all ${
          isDark
            ? "bg-slate-900/50 border-slate-800 text-slate-400"
            : "bg-white/80 border-slate-200 text-slate-500 shadow-2xs"
        }`}>
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4 shadow-xs">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className={`text-lg font-bold mb-1 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            报销汇总封面单为空
          </h3>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            尚无勾选或识别的发票。请批量上传电子发票文件或在发票台账勾选发票，系统将自动汇总并生成专业报销封面。
          </p>
          {onOpenBatchImport && (
            <button
              onClick={onOpenBatchImport}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              立即批量导入发票
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Top Controls (hidden in print) */}
      <div className={`no-print p-4 rounded-xl border shadow-2xs mb-6 flex items-center justify-between ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        <div>
          <h3 className={`font-bold text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>
            企业费用报销凭证汇总单
          </h3>
          <p className="text-xs text-slate-400">
            可作为发票贴单最上层的报销封面单，已选包含 {selectedInvoices.length}{" "}
            张发票，总金额 ¥{grandTotal.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"}`}
          >
            {isEditing ? (
              <>
                <Save className={`w-3.5 h-3.5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                <span>保存信息</span>
              </>
            ) : (
              <>
                <Edit2 className="w-3.5 h-3.5" />
                <span>编辑封面信息</span>
              </>
            )}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>打印此封面单</span>
          </button>
        </div>
      </div>

      {/* Editable Form Modal / Drawer if isEditing */}
      {isEditing && (
        <div className={`no-print p-4 rounded-xl border mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
          <div>
            <label className={`block mb-1 font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>公司/单位名称</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) =>
                setFormData({ ...formData, companyName: e.target.value })
              }
              className={`w-full p-2 border rounded-lg ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-300"}`}
            />
          </div>
          <div>
            <label className={`block mb-1 font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>报销部门</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) =>
                setFormData({ ...formData, department: e.target.value })
              }
              className={`w-full p-2 border rounded-lg ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-300"}`}
            />
          </div>
          <div>
            <label className={`block mb-1 font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>报销人</label>
            <input
              type="text"
              value={formData.applicant}
              onChange={(e) =>
                setFormData({ ...formData, applicant: e.target.value })
              }
              className={`w-full p-2 border rounded-lg ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-300"}`}
            />
          </div>
          <div>
            <label className={`block mb-1 font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>报销单号</label>
            <input
              type="text"
              value={formData.reimbursementNo}
              onChange={(e) =>
                setFormData({ ...formData, reimbursementNo: e.target.value })
              }
              className={`w-full p-2 border rounded-lg font-mono ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-300"}`}
            />
          </div>
          <div>
            <label className={`block mb-1 font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>主管审批人</label>
            <input
              type="text"
              value={formData.approver}
              onChange={(e) =>
                setFormData({ ...formData, approver: e.target.value })
              }
              className={`w-full p-2 border rounded-lg ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-300"}`}
            />
          </div>
          <div>
            <label className={`block mb-1 font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>财务复核人</label>
            <input
              type="text"
              value={formData.financeAuditor}
              onChange={(e) =>
                setFormData({ ...formData, financeAuditor: e.target.value })
              }
              className={`w-full p-2 border rounded-lg ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-300"}`}
            />
          </div>
          <div>
            <label className={`block mb-1 font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>出纳或经办人</label>
            <input
              type="text"
              value={formData.cashier}
              onChange={(e) =>
                setFormData({ ...formData, cashier: e.target.value })
              }
              className={`w-full p-2 border rounded-lg ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-300"}`}
            />
          </div>
        </div>
      )}

      {/* Printable Paper Voucher */}
      <div className="a4-print-page bg-white text-slate-900 p-8 rounded-xl shadow-xl border border-slate-200">
        {/* Paper Voucher Title */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
          <h2 className="text-2xl font-extrabold tracking-widest font-serif text-slate-900">
            {formData.companyName} 费用报销汇总单
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1">
            单号: {formData.reimbursementNo} | 日期: {formData.date}
          </p>
        </div>

        {/* Voucher Info Fields */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-xs border-b border-slate-200 pb-4">
          <div>
            <span className="text-slate-500">报销部门: </span>
            <span className="font-bold text-slate-800">{formData.department}</span>
          </div>
          <div>
            <span className="text-slate-500">报销申请人: </span>
            <span className="font-bold text-slate-800">{formData.applicant}</span>
          </div>
          <div>
            <span className="text-slate-500">附发票张数: </span>
            <span className="font-bold text-red-700 font-mono text-sm">
              {selectedInvoices.length} 张
            </span>
          </div>
        </div>

        {/* Category breakdown table */}
        <table className="w-full text-xs border-collapse border border-slate-300 mb-6">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <th className="border border-slate-300 p-2 text-center w-12">序号</th>
              <th className="border border-slate-300 p-2 text-left">费用大类</th>
              <th className="border border-slate-300 p-2 text-right">包含发票张数</th>
              <th className="border border-slate-300 p-2 text-right">小计金额 (元)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(categorySummary).map(([cat, amt], idx) => {
              const count = selectedInvoices.filter((i) => i.category === cat).length;
              return (
                <tr key={cat} className="border-b border-slate-200">
                  <td className="border border-slate-300 p-2 text-center font-mono">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-300 p-2 font-bold text-slate-800">
                    {cat}
                  </td>
                  <td className="border border-slate-300 p-2 text-right font-mono">
                    {count} 张
                  </td>
                  <td className="border border-slate-300 p-2 text-right font-mono font-bold">
                    ¥{(amt as number).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-bold border-t-2 border-slate-400">
              <td colSpan={2} className="border border-slate-300 p-2.5 text-center text-slate-800">
                报销金额合计 (大写)
              </td>
              <td colSpan={2} className="border border-slate-300 p-2.5 text-right font-serif text-sm text-[#E8000A]">
                {numberToRMB(grandTotal)}
              </td>
            </tr>
            <tr className="bg-slate-50 font-bold">
              <td colSpan={2} className="border border-slate-300 p-2.5 text-center text-slate-800">
                报销金额合计 (小写)
              </td>
              <td colSpan={2} className="border border-slate-300 p-2.5 text-right font-mono text-base text-[#E8000A] font-extrabold">
                ¥{grandTotal.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Approval Signatures */}
        <div className="grid grid-cols-4 gap-2 pt-6 text-xs text-slate-600 font-medium">
          <div>
            <span>主管审批: </span>
            <span className="font-bold underline text-slate-900">{formData.approver}</span>
          </div>
          <div>
            <span>财务复核: </span>
            <span className="font-bold underline text-slate-900">{formData.financeAuditor}</span>
          </div>
          <div>
            <span>出纳领款: </span>
            <span className="font-bold underline text-slate-900">{formData.cashier}</span>
          </div>
          <div>
            <span>报销人签章: </span>
            <span className="font-bold underline text-slate-900">{formData.applicant}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
