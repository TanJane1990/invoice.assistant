import React, { useState } from "react";
import {
  X,
  Settings,
  Building2,
  Database,
  Save,
  Upload,
  Cpu,
  FileSpreadsheet,
  Lock,
  ShieldCheck,
  ExternalLink,
  Check,
} from "lucide-react";
import { SystemSettings, InvoiceData } from "../types";
import { exportInvoicesToExcel } from "../utils/exportExcel";
import * as XLSX from "xlsx";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
  invoices: InvoiceData[];
  onImportInvoicesJson: (invoices: InvoiceData[]) => void;
  onClearSavedInvoices: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  invoices,
  onImportInvoicesJson,
}) => {
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Password verification states for financial security
  const [currentPassVerification, setCurrentPassVerification] = useState("");
  const [newPassInput, setNewPassInput] = useState("");
  const [confirmPassInput, setConfirmPassInput] = useState("");
  const [passError, setPassError] = useState("");

  if (!isOpen) return null;

  const hasExistingPassword = Boolean(settings.exportPassword && settings.exportPassword.trim() !== "");

  const handleSave = () => {
    setPassError("");

    let updatedPassword = formData.exportPassword || "";

    // Security check if altering an existing password
    if (hasExistingPassword) {
      if (newPassInput || currentPassVerification || formData.protectExportedExcel !== settings.protectExportedExcel) {
        if (currentPassVerification !== settings.exportPassword) {
          setPassError("原保护密码输入错误！拒绝修改或覆写财务锁定配置。");
          return;
        }
      }

      if (newPassInput) {
        if (newPassInput !== confirmPassInput) {
          setPassError("两次输入的【新密码】不一致，请重新核对！");
          return;
        }
        updatedPassword = newPassInput.trim();
      }
    } else {
      if (newPassInput) {
        if (newPassInput !== confirmPassInput) {
          setPassError("两次输入的【密码】不一致，请重新核对！");
          return;
        }
        updatedPassword = newPassInput.trim();
      }
    }

    const finalSettings: SystemSettings = {
      ...formData,
      exportPassword: updatedPassword,
    };

    onSaveSettings(finalSettings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  // Export as Excel Table (.xlsx)
  const handleExportExcel = () => {
    exportInvoicesToExcel(invoices, formData);
  };

  // Import from local computer file (.xlsx or .json)
  const handleImportLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            onImportInvoicesJson(parsed);
            alert(`成功从本地电脑文件导入了 ${parsed.length} 张发票！`);
          } else {
            alert("无效的备份 JSON 文件格式！");
          }
        } catch (err) {
          alert("读取 JSON 备份文件失败！");
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

          const importedInvoices: InvoiceData[] = jsonData.map((row, idx) => {
            const totalAmt = parseFloat(row["价税合计(元)"] || row["金额"] || row["价税合计"]) || 100;
            return {
              id: `imported-excel-${Date.now()}-${idx}`,
              invoiceType: row["发票类型"] || "电子发票(普通发票)",
              invoiceCode: row["发票代码"] || "",
              invoiceNumber: String(row["发票号码"] || Math.floor(Math.random() * 89999999 + 10000000)),
              issueDate: row["开票日期"] || new Date().toISOString().split("T")[0],
              buyerName: row["购买方名称"] || row["购买方"] || "个人",
              buyerTaxId: row["购买方税号"] || "",
              sellerName: row["销售方名称"] || row["销售方"] || "开票单位",
              sellerTaxId: row["销售方税号"] || "",
              totalAmountWithoutTax: Math.round(totalAmt * 0.94 * 100) / 100,
              totalTaxAmount: Math.round(totalAmt * 0.06 * 100) / 100,
              totalAmountWithTax: totalAmt,
              totalAmountWithTaxCN: row["大写金额"] || "",
              category: row["费用大类"] || "其他",
              items: [],
              remarks: row["备注"] || "Excel导入",
              selectedForPrint: true,
            };
          });

          onImportInvoicesJson(importedInvoices);
          alert(`成功从 Excel 表格导入了 ${importedInvoices.length} 条发票数据！`);
        } catch (err) {
          alert("读取 Excel 表格数据失败！");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-base">系统与识别偏好设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs text-slate-900 dark:text-slate-100">
          {/* Section 1: AI Key Configuration */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
                <Cpu className="w-4 h-4 text-red-500" />
                <span>智能 AI 识别 API 密钥配置</span>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              默认使用内置OCR算法，您也可以填入自定义 AI 大模型 API Key 提升处理分析速度。
            </p>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                通用 AI 大模型 API Key
              </label>
              <input
                type="password"
                placeholder="sk-..."
                value={formData.aiApiKey || ""}
                onChange={(e) =>
                  setFormData({ ...formData, aiApiKey: e.target.value })
                }
                className="w-full p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg font-mono focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 2: Baidu Cloud OCR API Configuration */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>百度 OCR 增值税发票识别 API 配置</span>
              </div>
              <a
                href="https://console.bce.baidu.com/ai/#/ai/ocr/overview/index"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 text-xs text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/80 hover:bg-purple-100 px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
              >
                <span>申请百度OCR API</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              配置百度智能云文字识别（增值税发票识别接口）API ，实现发票全票面高精精准识别。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  百度云 API Key (AK)
                </label>
                <input
                  type="password"
                  placeholder="填入百度云 API Key"
                  value={formData.baiduApiKey || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, baiduApiKey: e.target.value })
                  }
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  百度云 Secret Key (SK)
                </label>
                <input
                  type="password"
                  placeholder="填入百度云 Secret Key"
                  value={formData.baiduSecretKey || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, baiduSecretKey: e.target.value })
                  }
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Default Company & Approver Info */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
                <Building2 className="w-4 h-4 text-blue-500" />
                <span>默认报销抬头与审批人员预设</span>
              </div>
              <span className="text-[10px] text-slate-400">
                (更改后自动作为报销封面预设值)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">默认单位名称</label>
                <input
                  type="text"
                  value={formData.defaultCompany}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultCompany: e.target.value })
                  }
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">默认报销部门</label>
                <input
                  type="text"
                  value={formData.defaultDepartment}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultDepartment: e.target.value })
                  }
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">默认报销人</label>
                <input
                  type="text"
                  value={formData.defaultApplicant}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultApplicant: e.target.value })
                  }
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">主管审批人</label>
                <input
                  type="text"
                  value={formData.defaultApprover}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultApprover: e.target.value })
                  }
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">财务复核人</label>
                <input
                  type="text"
                  value={formData.defaultFinanceAuditor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultFinanceAuditor: e.target.value,
                    })
                  }
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">出纳或经办人</label>
                <input
                  type="text"
                  value={formData.defaultCashier}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultCashier: e.target.value })
                  }
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Data Storage & Local Computer File Export/Import */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
                <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>发票数据本地电脑存储与表格管理</span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                已保存在本地 {invoices.length} 张发票
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>导出 Excel 发票台账表格</span>
              </button>

              <label className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-lg cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>从本地电脑选择文件导入 (.xlsx / .json)</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.json"
                  onChange={handleImportLocalFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Section 5: Excel Export Password Protection */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>导出 Excel 台账工作表密码保护与防篡改设置</span>
              </div>
              {hasExistingPassword ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>管理员密码已锁定保护</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  未设定保护密码
                </span>
              )}
            </div>

            {passError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs font-semibold flex items-center space-x-1.5">
                <X className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  设置防篡改工作表保护密码：
                </label>
                <input
                  type="password"
                  placeholder="设置自定义密码"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  再次确认密码：
                </label>
                <input
                  type="password"
                  placeholder="再次确认新密码"
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              设置保存后即刻生效
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium border-l border-slate-300 dark:border-slate-700 pl-3">
              软件开发：会钓鱼的猫
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-xl cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer min-w-[110px] justify-center"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>已保存设置!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>保存系统设置</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
