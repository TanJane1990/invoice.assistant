import React, { useState, useEffect } from "react";
import { InvoiceData, InvoiceCategory } from "../types";
import { numberToRMB } from "../utils/numberToRMB";
import { X, Save, Edit3 } from "lucide-react";

interface InvoiceDetailModalProps {
  invoice: InvoiceData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedInvoice: InvoiceData) => void;
  theme?: "light" | "dark";
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !invoice) return null;

  const [form, setForm] = useState<InvoiceData>({ ...invoice });

  useEffect(() => {
    if (invoice) {
      setForm({ ...invoice });
    }
  }, [invoice]);

  const categories: InvoiceCategory[] = [
    "餐饮费",
    "交通费",
    "住宿费",
    "办公用品",
    "通讯费",
    "会议费",
    "软件服务",
    "培训费",
    "租金",
    "其他",
  ];

  const handleAmountChange = (newAmt: number) => {
    const withoutTax = Math.round(newAmt * 0.94 * 100) / 100;
    const tax = Math.round((newAmt - withoutTax) * 100) / 100;

    setForm((prev) => ({
      ...prev,
      totalAmountWithTax: newAmt,
      totalAmountWithoutTax: withoutTax,
      totalTaxAmount: tax,
      totalAmountWithTaxCN: numberToRMB(newAmt),
      items: prev.items && prev.items.length > 0
        ? prev.items.map((it) => ({ ...it, amount: newAmt }))
        : [{ id: `item-mod-${Date.now()}`, name: `*${prev.category || "其他"}*物品/服务`, amount: newAmt, quantity: 1 }],
    }));
  };

  const handleSave = () => {
    const finalAmount = Number(form.totalAmountWithTax || 0);
    const withoutTax = form.totalAmountWithoutTax || Math.round(finalAmount * 0.94 * 100) / 100;
    const tax = form.totalTaxAmount || Math.round((finalAmount - withoutTax) * 100) / 100;

    const updatedItems = form.items && form.items.length > 0
      ? form.items.map((it) => ({ ...it, amount: finalAmount }))
      : [{ id: `item-save-${Date.now()}`, name: `*${form.category || "其他"}*物品/服务`, amount: finalAmount, quantity: 1 }];

    const finalInvoice: InvoiceData = {
      ...form,
      id: form.id || `custom-${Date.now()}`,
      invoiceType: form.invoiceType || "增值税电子普通发票",
      invoiceCode: form.invoiceCode || "",
      invoiceNumber: form.invoiceNumber || `N${Date.now().toString().slice(-8)}`,
      issueDate: form.issueDate || new Date().toISOString().split("T")[0],
      buyerName: form.buyerName || "个人",
      sellerName: form.sellerName || "出票服务单位",
      totalAmountWithoutTax: withoutTax,
      totalTaxAmount: tax,
      totalAmountWithTax: finalAmount,
      totalAmountWithTaxCN: form.totalAmountWithTaxCN || numberToRMB(finalAmount),
      category: form.category || "其他",
      selectedForPrint: true,
      duplicateWarning: false,
      remarks: form.remarks || "手动新建发票",
      importTime: form.importTime || new Date().toLocaleString("zh-CN", { hour12: false }),
      items: updatedItems,
    };
    onSave(finalInvoice);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8 flex flex-col">
        {/* Modal Header (1:1 Match to Image 2) */}
        <div className="modal-dark-header flex items-center justify-between px-6 py-4 bg-[#0E172B] text-white border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-[#E8000A]" style={{ color: "#E8000A" }} />
            <h3 className="font-extrabold text-base tracking-wide text-white" style={{ color: "#ffffff !important" }}>
              修改/编辑发票详情
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (1:1 Pure White Background with Crisp Black Text - Match Image 2) */}
        <div className="p-6 space-y-4.5 max-h-[75vh] overflow-y-auto text-xs bg-white" style={{ color: "#0f172a" }}>
          {/* Row 1: Invoice Type & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-extrabold block mb-1.5 text-slate-900" style={{ color: "#0f172a" }}>
                发票类型 (支持下拉选择)
              </label>
              <select
                value={form.invoiceType || "电子发票(普通发票)"}
                onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}
                style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-bold cursor-pointer"
              >
                <option value="电子发票(普通发票)" style={{ color: "#0f172a" }}>电子发票（普通发票）</option>
                <option value="电子发票(专用发票)" style={{ color: "#0f172a" }}>电子发票（专用发票）</option>
                <option value="增值税电子普通发票" style={{ color: "#0f172a" }}>增值税电子普通发票</option>
                <option value="增值税电子专用发票" style={{ color: "#0f172a" }}>增值税电子专用发票</option>
                <option value="增值税普通发票(纸质)" style={{ color: "#0f172a" }}>增值税普通发票（纸质）</option>
                <option value="增值税专用发票(纸质)" style={{ color: "#0f172a" }}>增值税专用发票（纸质）</option>
                <option value="铁路电子客票" style={{ color: "#0f172a" }}>铁路电子客票</option>
                <option value="航空运输电子客票行程单" style={{ color: "#0f172a" }}>航空运输电子客票行程单</option>
                <option value="道路通行费电子普通发票" style={{ color: "#0f172a" }}>道路通行费电子普通发票</option>
                <option value="通用定额发票" style={{ color: "#0f172a" }}>通用定额发票</option>
                <option value="海关缴款书" style={{ color: "#0f172a" }}>海关缴款书</option>
                <option value="其他发票" style={{ color: "#0f172a" }}>其他发票</option>
              </select>
            </div>

            <div>
              <label className="font-extrabold block mb-1.5 text-slate-900" style={{ color: "#0f172a" }}>
                费用分类
              </label>
              <select
                value={form.category || "办公用品"}
                onChange={(e) => setForm({ ...form, category: e.target.value as InvoiceCategory })}
                style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-bold cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c} style={{ color: "#0f172a" }}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Code, Number & Issue Date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-extrabold block mb-1.5 text-slate-900" style={{ color: "#0f172a" }}>
                发票代码
              </label>
              <input
                type="text"
                value={form.invoiceCode || ""}
                onChange={(e) => setForm({ ...form, invoiceCode: e.target.value })}
                placeholder="无代码可留空"
                style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-extrabold block mb-1.5 text-slate-900" style={{ color: "#0f172a" }}>
                发票号码
              </label>
              <input
                type="text"
                value={form.invoiceNumber || ""}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                placeholder="8-20位数字号码"
                style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-extrabold text-[#E8000A]"
              />
            </div>

            <div>
              <label className="font-extrabold block mb-1.5 text-slate-900" style={{ color: "#0f172a" }}>
                开票日期
              </label>
              <input
                type="date"
                value={form.issueDate || new Date().toISOString().split("T")[0]}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold cursor-pointer"
              />
            </div>
          </div>

          {/* Row 3: Buyer & Seller */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-extrabold block mb-1.5 text-slate-900" style={{ color: "#0f172a" }}>
                购买方名称 (抬头)
              </label>
              <input
                type="text"
                value={form.buyerName || ""}
                onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                placeholder="请输入购买方抬头名称"
                style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="font-extrabold block mb-1.5 text-slate-900" style={{ color: "#0f172a" }}>
                销售方名称 (出票商户)
              </label>
              <input
                type="text"
                value={form.sellerName || ""}
                onChange={(e) => setForm({ ...form, sellerName: e.target.value })}
                placeholder="请输入销售方或商家名称"
                style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
              />
            </div>
          </div>

          {/* Red Highlighted Price Summary Box (1:1 Match to Image 2) */}
          <div className="p-4 rounded-2xl border-2 border-red-200 bg-red-50/30 grid grid-cols-2 gap-4">
            <div>
              <label className="font-extrabold block mb-1.5 text-[#E8000A]" style={{ color: "#E8000A" }}>
                价税合计金额 (小写元)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.totalAmountWithTax || 0}
                onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                style={{ color: "#E8000A", backgroundColor: "#ffffff" }}
                className="w-full p-2.5 border border-red-300 rounded-xl font-mono font-black text-sm text-[#E8000A] focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="font-extrabold block mb-1.5 text-[#E8000A]" style={{ color: "#E8000A" }}>
                大写人民币 (自动生成)
              </label>
              <input
                type="text"
                readOnly
                value={form.totalAmountWithTaxCN || numberToRMB(form.totalAmountWithTax || 0)}
                style={{ color: "#991b1b", backgroundColor: "#fef2f2" }}
                className="w-full p-2.5 border border-red-200 rounded-xl font-serif font-bold text-sm text-red-900"
              />
            </div>
          </div>

          {/* Row 5: Remarks */}
          <div>
            <label className="font-extrabold block mb-1.5 text-slate-900" style={{ color: "#0f172a" }}>
              备注信息/开票事由
            </label>
            <input
              type="text"
              value={form.remarks || ""}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="手动新建发票"
              style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
            />
          </div>
        </div>

        {/* Modal Footer (1:1 Match to Image 2) */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
            style={{ color: "#334155" }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-[#E8000A] hover:bg-[#C80009] text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4 text-white" />
            <span className="text-white font-bold">保存更新</span>
          </button>
        </div>
      </div>
    </div>
  );
};
