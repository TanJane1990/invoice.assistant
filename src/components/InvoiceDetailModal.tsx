import React, { useState, useEffect } from "react";
import { InvoiceData, InvoiceCategory } from "../types";
import { numberToRMB } from "../utils/numberToRMB";
import { X, Save, Plus, Trash2, Edit3 } from "lucide-react";

interface InvoiceDetailModalProps {
  invoice: InvoiceData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedInvoice: InvoiceData) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !invoice) return null;

  const [form, setForm] = useState<InvoiceData>({ ...invoice });

  // 修复 #29: 当 invoice prop 变化时（切换编辑不同发票），同步更新表单状态
  useEffect(() => {
    if (invoice) setForm({ ...invoice });
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
    // 修复 #28: 动态读取发票明细中的税率，而非硬编码 6%
    const taxRateStr = form.items?.[0]?.taxRate || "6%";
    const taxRateVal = parseFloat(taxRateStr.replace("%", "")) / 100 || 0.06;
    const withoutTax = Math.round((newAmt / (1 + taxRateVal)) * 100) / 100;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 my-8">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-base">修改/编辑发票详情</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Row 1: Type & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-600 font-semibold block mb-1">
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
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium"
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
              <label className="text-slate-600 font-semibold block mb-1">
                费用分类
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as InvoiceCategory })
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 cursor-pointer"
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
              <label className="text-slate-600 font-semibold block mb-1">
                发票代码
              </label>
              <input
                type="text"
                value={form.invoiceCode || ""}
                onChange={(e) =>
                  setForm({ ...form, invoiceCode: e.target.value })
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-600 font-semibold block mb-1">
                发票号码
              </label>
              <input
                type="text"
                value={form.invoiceNumber}
                onChange={(e) =>
                  setForm({ ...form, invoiceNumber: e.target.value })
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-slate-600 font-semibold block mb-1">
                开票日期
              </label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Row 3: Buyer & Seller */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-600 font-semibold block mb-1">
                购买方名称 (抬头)
              </label>
              <input
                type="text"
                value={form.buyerName}
                onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="text-slate-600 font-semibold block mb-1">
                销售方名称 (出票商户)
              </label>
              <input
                type="text"
                value={form.sellerName}
                onChange={(e) =>
                  setForm({ ...form, sellerName: e.target.value })
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Row 4: Total Amount & RMB capital auto calculation */}
          <div className="grid grid-cols-2 gap-4 bg-red-50/50 p-3 rounded-xl border border-red-200">
            <div>
              <label className="text-red-900 font-bold block mb-1">
                价税合计金额 (小写元)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.totalAmountWithTax}
                onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                className="w-full p-2 bg-white border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 font-mono text-sm font-bold text-red-700"
              />
            </div>
            <div>
              <label className="text-red-900 font-bold block mb-1">
                大写人民币 (自动生成)
              </label>
              <input
                type="text"
                readOnly
                value={form.totalAmountWithTaxCN}
                className="w-full p-2 bg-red-100/60 border border-red-200 rounded-lg font-serif font-bold text-red-900"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="text-slate-600 font-semibold block mb-1">
              备注信息/开票事由
            </label>
            <input
              type="text"
              value={form.remarks || ""}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>保存更新</span>
          </button>
        </div>
      </div>
    </div>
  );
};
