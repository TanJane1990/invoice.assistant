import React, { useState } from "react";
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
  theme = "dark",
}) => {
  const isDark = theme === "dark";
  if (!isOpen || !invoice) return null;

  const [form, setForm] = useState<InvoiceData>({ ...invoice });

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
    }));
  };

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className={`rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border my-8 ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "bg-slate-950 text-white border-slate-800" : "bg-slate-50/50 text-slate-900 border-slate-100"}`}>
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-base">修改/编辑发票详情</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${isDark ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          {/* Row 1: Type & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                发票类型 (支持选择或自定义输入)
              </label>
              <input
                type="text"
                list="invoice-types-list"
                value={form.invoiceType}
                onChange={(e) =>
                  setForm({ ...form, invoiceType: e.target.value })
                }
                placeholder="选择或输入中国标准发票种类"
                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 font-medium ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-slate-50 text-slate-900 border-slate-300"}`}
              />
              <datalist id="invoice-types-list">
                <option value="电子发票（普通发票）" />
                <option value="电子发票（专用发票）" />
                <option value="增值税电子普通发票" />
                <option value="增值税电子专用发票" />
                <option value="铁路电子客票" />
                <option value="航空运输电子客票行程单" />
                <option value="道路通行费电子普通发票" />
                <option value="增值税普通发票（纸质）" />
                <option value="增值税专用发票（纸质）" />
                <option value="通用定额发票" />
              </datalist>
            </div>
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                费用分类
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as InvoiceCategory })
                }
                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 cursor-pointer ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-slate-50 text-slate-900 border-slate-300"}`}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Code, Number, Date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                发票代码
              </label>
              <input
                type="text"
                value={form.invoiceCode || ""}
                onChange={(e) =>
                  setForm({ ...form, invoiceCode: e.target.value })
                }
                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 font-mono ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-slate-50 text-slate-900 border-slate-300"}`}
              />
            </div>
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                发票号码
              </label>
              <input
                type="text"
                value={form.invoiceNumber}
                onChange={(e) =>
                  setForm({ ...form, invoiceNumber: e.target.value })
                }
                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 font-mono font-bold ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-slate-50 text-slate-900 border-slate-300"}`}
              />
            </div>
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                开票日期
              </label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-slate-50 text-slate-900 border-slate-300"}`}
              />
            </div>
          </div>

          {/* Row 3: Buyer & Seller */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                购买方名称 (抬头)
              </label>
              <input
                type="text"
                value={form.buyerName}
                onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-slate-50 text-slate-900 border-slate-300"}`}
              />
            </div>
            <div>
              <label className={`font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                销售方名称 (出票商户)
              </label>
              <input
                type="text"
                value={form.sellerName}
                onChange={(e) =>
                  setForm({ ...form, sellerName: e.target.value })
                }
                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 ${isDark ? "bg-slate-800 text-slate-100 border-slate-700" : "bg-slate-50 text-slate-900 border-slate-300"}`}
              />
            </div>
          </div>

          {/* Row 4: Total Amount & RMB capital auto calculation */}
          <div className={`grid grid-cols-2 gap-4 p-3 rounded-xl border ${isDark ? "bg-red-950/40 border-red-900" : "bg-red-50/50 border-red-200"}`}>
            <div>
              <label className={`font-bold block mb-1 ${isDark ? "text-red-300" : "text-red-900"}`}>
                价税合计金额 (小写元)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.totalAmountWithTax}
                onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 font-mono text-sm font-bold ${isDark ? "bg-slate-900 border-red-800 text-red-400" : "bg-white border-red-300 text-red-700"}`}
              />
            </div>
            <div>
              <label className={`font-bold block mb-1 ${isDark ? "text-red-300" : "text-red-900"}`}>
                大写金额 (自动转换)
              </label>
              <input
                type="text"
                readOnly
                value={form.totalAmountWithTaxCN}
                className={`w-full p-2 border rounded-lg font-serif font-bold cursor-not-allowed ${isDark ? "bg-red-900/60 border-red-800 text-red-200" : "bg-red-100/60 border-red-200 text-red-900"}`}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
          <span className="text-xs text-slate-400">
            自动算计不含税金额与税额
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 font-medium text-xs rounded-xl cursor-pointer border transition-colors ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"}`}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>保存修改</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
