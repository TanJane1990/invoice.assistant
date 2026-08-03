import React, { useState, useEffect } from "react";
import { InvoiceData, ReimbursementCoverData, SystemSettings, PrintConfig } from "../types";
import { numberToRMB } from "../utils/numberToRMB";
import { Printer, Edit2, Save, FileText, FilePlus2 } from "lucide-react";

interface ReimbursementCoverProps {
  invoices: InvoiceData[];
  defaultSettings?: SystemSettings;
  config?: PrintConfig;
  onOpenBatchImport?: () => void;
}

export const ReimbursementCover: React.FC<ReimbursementCoverProps> = ({
  invoices,
  defaultSettings,
  config,
  onOpenBatchImport,
}) => {
  const selectedInvoices = invoices.filter((i) => i.selectedForPrint);

  const [formData, setFormData] = useState<ReimbursementCoverData>({
    companyName: defaultSettings?.defaultCompany || "会钓鱼的猫",
    department: defaultSettings?.defaultDepartment || "猫粮研发部",
    applicant: defaultSettings?.defaultApplicant || "张喵喵",
    reimbursementNo: (() => { const d = new Date(); return `BX-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-001`; })(),
    date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })(),
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
        <div className="flex flex-col items-center justify-center min-h-[55vh] p-8 text-center bg-slate-100/60 rounded-2xl border-2 border-dashed border-slate-300 my-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-4 shadow-2xs">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">
            报销汇总封面单为空
          </h3>
          <p className="text-sm text-slate-500 max-w-md mb-6">
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
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">
            企业费用报销凭证汇总单
          </h3>
          <p className="text-xs text-slate-500">
            可作为发票贴单最上层的报销封面单，已选包含 {selectedInvoices.length}{" "}
            张发票，总金额 ¥{grandTotal.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            {isEditing ? (
              <>
                <Save className="w-3.5 h-3.5 text-emerald-600" />
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
        <div className="no-print bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-500 block mb-1">公司/单位名称</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) =>
                setFormData({ ...formData, companyName: e.target.value })
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">报销部门</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) =>
                setFormData({ ...formData, department: e.target.value })
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">报销人</label>
            <input
              type="text"
              value={formData.applicant}
              onChange={(e) =>
                setFormData({ ...formData, applicant: e.target.value })
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">报销单号</label>
            <input
              type="text"
              value={formData.reimbursementNo}
              onChange={(e) =>
                setFormData({ ...formData, reimbursementNo: e.target.value })
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">主管审批人</label>
            <input
              type="text"
              value={formData.approver}
              onChange={(e) =>
                setFormData({ ...formData, approver: e.target.value })
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">财务复核人</label>
            <input
              type="text"
              value={formData.financeAuditor}
              onChange={(e) =>
                setFormData({ ...formData, financeAuditor: e.target.value })
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">出纳或经办人</label>
            <input
              type="text"
              value={formData.cashier}
              onChange={(e) =>
                setFormData({ ...formData, cashier: e.target.value })
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">填单日期</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="text-slate-500 block mb-1">事由/项目说明</label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Printable Voucher Paper - Dynamically sized to match landscape or portrait paper orientation */}
      <div
        className="a4-print-page bg-white p-8 border border-slate-300 shadow-lg font-serif text-slate-900 rounded-sm"
        style={{
          width: config?.orientation === "landscape" ? "297mm" : "210mm",
          minHeight: config?.orientation === "landscape" ? "210mm" : "297mm",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div className="text-center border-b-2 border-slate-900 pb-3 mb-6">
          <h2 className="text-xs font-sans tracking-widest text-slate-500 uppercase mb-1">
            {formData.companyName}
          </h2>
          <h1 className="text-2xl font-bold tracking-widest text-slate-900">
            费 用 报 销 凭 证 单
          </h1>
          <div className="flex justify-between items-center text-xs font-sans mt-3 text-slate-600">
            <span>报销部门: {formData.department}</span>
            <span>报销单号: {formData.reimbursementNo}</span>
            <span>填单日期: {formData.date}</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="border border-slate-900 text-xs font-sans mb-6">
          <div className="grid grid-cols-4 divide-x divide-slate-900 border-b border-slate-900">
            <div className="p-2 bg-slate-100 font-bold text-center">报销人</div>
            <div className="p-2 font-mono">{formData.applicant}</div>
            <div className="p-2 bg-slate-100 font-bold text-center">附发票张数</div>
            <div className="p-2 font-mono font-bold text-red-700">
              {selectedInvoices.length} 张
            </div>
          </div>

          <div className="grid grid-cols-4 divide-x divide-slate-900 border-b border-slate-900">
            <div className="p-2 bg-slate-100 font-bold text-center">报销事由</div>
            <div className="p-2 col-span-3">{formData.reason}</div>
          </div>
        </div>

        {/* Expense Category Breakdown Table */}
        <div className="border border-slate-900 text-xs font-sans mb-6">
          <div className="bg-slate-100 p-2 font-bold text-center border-b border-slate-900">
            费 用 分 类 销 账 明 细 汇 总
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-900 text-slate-700 bg-slate-50">
                <th className="p-2 text-left border-r border-slate-900">费用类别</th>
                <th className="p-2 text-center border-r border-slate-900">包含笔数</th>
                <th className="p-2 text-right">小计金额 (元)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 font-mono">
              {Object.entries(categorySummary).map(([cat, amt]) => {
                const count = selectedInvoices.filter((i) => i.category === cat).length;
                const totalAmt = Number(amt || 0);
                return (
                  <tr key={cat}>
                    <td className="p-2 font-sans border-r border-slate-900 font-semibold">
                      {cat}
                    </td>
                    <td className="p-2 text-center border-r border-slate-900">
                      {count} 笔
                    </td>
                    <td className="p-2 text-right font-bold">
                      ¥{totalAmt.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Grand Total Box */}
        <div className="border-2 border-slate-900 p-3 bg-slate-50 font-sans text-xs mb-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold mr-2">报销金额合计 (大写):</span>
              <span className="font-bold text-sm text-red-900 font-serif">
                {numberToRMB(grandTotal)}
              </span>
            </div>
            <div className="font-mono text-base font-bold text-slate-900">
              ¥{grandTotal.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Detailed Itemized Ledger Sheet for Finance Attachment */}
        <div className="border-t border-dashed border-slate-400 pt-4 mb-8">
          <h4 className="text-xs font-bold font-sans text-slate-600 mb-2">
            附件发票明细清单:
          </h4>
          <table className="w-full text-[10px] font-sans text-left border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-1 border-r border-slate-300">发票号码</th>
                <th className="p-1 border-r border-slate-300">开票日期</th>
                <th className="p-1 border-r border-slate-300">开票单位</th>
                <th className="p-1 border-r border-slate-300">类别</th>
                <th className="p-1 text-right">金额 (元)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {selectedInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="p-1 border-r border-slate-300">{inv.invoiceNumber}</td>
                  <td className="p-1 border-r border-slate-300">{inv.issueDate}</td>
                  <td className="p-1 border-r border-slate-300 font-sans truncate max-w-[160px]">
                    {inv.sellerName}
                  </td>
                  <td className="p-1 border-r border-slate-300 font-sans">{inv.category}</td>
                  <td className="p-1 text-right font-bold">
                    ¥{inv.totalAmountWithTax.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures Footer */}
        <div className="grid grid-cols-4 gap-4 text-xs font-sans pt-4 border-t border-slate-900 text-slate-800">
          <div className="flex items-center space-x-1">
            <span className="font-bold whitespace-nowrap">主管审批: </span>
            <input
              type="text"
              value={formData.approver}
              onChange={(e) =>
                setFormData({ ...formData, approver: e.target.value })
              }
              className="underline decoration-slate-400 bg-transparent border-none outline-none font-medium w-full focus:bg-amber-50 rounded px-1"
            />
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-bold whitespace-nowrap">财务复核: </span>
            <input
              type="text"
              value={formData.financeAuditor}
              onChange={(e) =>
                setFormData({ ...formData, financeAuditor: e.target.value })
              }
              className="underline decoration-slate-400 bg-transparent border-none outline-none font-medium w-full focus:bg-amber-50 rounded px-1"
            />
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-bold whitespace-nowrap">出纳或经办人: </span>
            <input
              type="text"
              value={formData.cashier}
              onChange={(e) =>
                setFormData({ ...formData, cashier: e.target.value })
              }
              className="underline decoration-slate-400 bg-transparent border-none outline-none font-medium w-full focus:bg-amber-50 rounded px-1"
            />
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-bold whitespace-nowrap">报销人签章: </span>
            <input
              type="text"
              value={formData.applicant}
              onChange={(e) =>
                setFormData({ ...formData, applicant: e.target.value })
              }
              className="underline decoration-slate-400 bg-transparent border-none outline-none font-medium w-full focus:bg-amber-50 rounded px-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
