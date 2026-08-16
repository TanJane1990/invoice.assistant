import React, { useState } from "react";
import {
  X,
  Settings,
  Building2,
  Save,
  Cpu,
  Key,
  ExternalLink,
  Check,
  Database,
  FileSpreadsheet,
  Upload,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { SystemSettings, InvoiceData } from "../types";
import { exportInvoicesToExcel } from "../utils/exportExcel";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
  invoices: InvoiceData[];
  onImportInvoicesJson: (invoices: InvoiceData[]) => void;
  onClearSavedInvoices: () => void;
  theme?: "light" | "dark";
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
  const [currentPassVerification, setCurrentPassVerification] = useState("");
  const [newPassInput, setNewPassInput] = useState("");
  const [confirmPassInput, setConfirmPassInput] = useState("");
  const [passError, setPassError] = useState("");

  if (!isOpen) return null;

  const hasExistingPassword = Boolean((settings.exportPassword || "").trim());

  const handleSave = () => {
    setPassError("");
    const newSettings = { ...formData };

    if (newPassInput || confirmPassInput) {
      if (hasExistingPassword && currentPassVerification !== settings.exportPassword) {
        setPassError("当前原密码输入错误，无法设置新密码！");
        return;
      }
      if (newPassInput !== confirmPassInput) {
        setPassError("两次输入的新密码不一致，请核对！");
        return;
      }
      newSettings.exportPassword = newPassInput;
    }

    onSaveSettings(newSettings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleImportLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          onImportInvoicesJson(parsed);
          alert(`成功从备份导入 ${parsed.length} 张发票台账数据！`);
        } else {
          alert("导入的 JSON 文件格式有误，需为发票列表数组！");
        }
      } catch (err) {
        alert("解析文件失败，请确保选择有效的 JSON / Excel 备份文件。");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0E172B] text-white border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-red-500" />
            <h3 className="font-extrabold text-base tracking-wide text-white">智能发票助手 - 系统设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto text-xs bg-white" style={{ color: "#0f172a" }}>
          {/* Section 1: AI Key Configuration */}
          <div className="space-y-3 bg-slate-50 p-4.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-black text-sm" style={{ color: "#0f172a" }}>
                <Key className="w-4 h-4 text-amber-500" />
                <span className="font-black text-slate-900" style={{ color: "#0f172a" }}>智能 AI 识别 API 密钥配置</span>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-slate-600" style={{ color: "#475569" }}>
              默认使用内置OCR算法，您也可以填入自定义 AI 大模型 API Key 提升处理分析速度。
            </p>
            <div>
              <label className="block font-bold mb-1 text-slate-800" style={{ color: "#1e293b" }}>
                通用 AI 大模型 API Key
              </label>
              <input
                type="password"
                placeholder="sk-..."
                value={formData.aiApiKey || ""}
                onChange={(e) =>
                  setFormData({ ...formData, aiApiKey: e.target.value })
                }
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          {/* Section 2: Baidu Cloud OCR API Configuration */}
          <div className="space-y-3 bg-slate-50 p-4.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-black text-sm" style={{ color: "#0f172a" }}>
                <Cpu className="w-4 h-4 text-purple-600" />
                <span className="font-black text-slate-900" style={{ color: "#0f172a" }}>百度 OCR 增值税发票识别 API 配置</span>
              </div>
              <a
                href="https://console.bce.baidu.com/ai/#/ai/ocr/overview/index"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg border border-purple-200 transition-colors cursor-pointer"
              >
                <span>申请百度OCR API</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[11px] font-semibold text-slate-600" style={{ color: "#475569" }}>
              配置百度智能云文字识别（增值税发票识别接口）API ，实现发票全票面高精精准识别。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1 text-slate-800" style={{ color: "#1e293b" }}>
                  百度云 API Key (AK)
                </label>
                <input
                  type="password"
                  placeholder="填入百度云 API Key"
                  value={formData.baiduApiKey || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, baiduApiKey: e.target.value })
                  }
                  style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>
              <div>
                <label className="block font-bold mb-1 text-slate-800" style={{ color: "#1e293b" }}>
                  百度云 Secret Key (SK)
                </label>
                <input
                  type="password"
                  placeholder="填入百度云 Secret Key"
                  value={formData.baiduSecretKey || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, baiduSecretKey: e.target.value })
                  }
                  style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Default Company & Approver Info */}
          <div className="space-y-3 bg-slate-50 p-4.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-black text-sm" style={{ color: "#0f172a" }}>
                <Building2 className="w-4 h-4 text-blue-500" />
                <span className="font-black text-slate-900" style={{ color: "#0f172a" }}>默认报销抬头与审批人员预设</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium" style={{ color: "#64748b" }}>
                (更改后自动作为报销封面预设值)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 font-bold text-slate-800" style={{ color: "#1e293b" }}>默认单位名称</label>
                <input
                  type="text"
                  value={formData.defaultCompany}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultCompany: e.target.value })
                  }
                  style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-800" style={{ color: "#1e293b" }}>默认报销部门</label>
                <input
                  type="text"
                  value={formData.defaultDepartment}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultDepartment: e.target.value })
                  }
                  style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-800" style={{ color: "#1e293b" }}>默认报销人</label>
                <input
                  type="text"
                  value={formData.defaultApplicant}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultApplicant: e.target.value })
                  }
                  style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-800" style={{ color: "#1e293b" }}>主管审批人</label>
                <input
                  type="text"
                  value={formData.defaultApprover}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultApprover: e.target.value })
                  }
                  style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-800" style={{ color: "#1e293b" }}>财务复核人</label>
                <input
                  type="text"
                  value={formData.defaultFinanceAuditor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultFinanceAuditor: e.target.value,
                    })
                  }
                  style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-800" style={{ color: "#1e293b" }}>出纳或经办人</label>
                <input
                  type="text"
                  value={formData.defaultCashier}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultCashier: e.target.value })
                  }
                  style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Local Storage & Table Data Management */}
          <div className="space-y-3 bg-slate-50 p-4.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-black text-sm" style={{ color: "#0f172a" }}>
                <Database className="w-4 h-4 text-emerald-600" />
                <span className="font-black text-slate-900" style={{ color: "#0f172a" }}>发票数据本地电脑存储与表格管理</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                已保存在本地 {invoices.length} 张发票
              </span>
            </div>

            <p className="text-[11px] font-semibold text-slate-600 leading-relaxed" style={{ color: "#475569" }}>
              所有发票自动保存在当前电脑浏览器本地数据库中。您可随时将发票台账导出为 Excel 表格，或从本地电脑选择 Excel / 备份文件进行导入还原。
            </p>

            <div className="space-y-3 pt-1">
              <label className="flex items-center space-x-2 cursor-pointer font-bold text-xs text-slate-800" style={{ color: "#1e293b" }}>
                <input
                  type="checkbox"
                  checked={formData.autoSaveInvoices}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      autoSaveInvoices: e.target.checked,
                    })
                  }
                  className="accent-red-600 rounded cursor-pointer w-4 h-4"
                />
                <span style={{ color: "#1e293b" }}>自动实时保存发票台账至本地</span>
              </label>

              <div className="flex items-center space-x-3 pt-1">
                <button
                  onClick={() => exportInvoicesToExcel(invoices, settings)}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#009966] hover:bg-[#007A52] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-white" />
                  <span className="text-white font-bold">导出 Excel 发票台账表格</span>
                </button>

                <label className="flex items-center space-x-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition-all cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span className="text-slate-800 font-bold" style={{ color: "#1e293b" }}>从本地电脑选择文件导入 (.xlsx / .json)</span>
                  <input
                    type="file"
                    accept=".json,.xlsx"
                    onChange={handleImportLocalFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Section 5: Excel Export Password Protection & Anti-Tamper Security */}
          <div className="space-y-3 bg-slate-50 p-4.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-black text-sm" style={{ color: "#0f172a" }}>
                <Lock className="w-4 h-4 text-indigo-600" />
                <span className="font-black text-slate-900" style={{ color: "#0f172a" }}>导出 Excel 台账工作表密码保护与防篡改设置</span>
              </div>
              {hasExistingPassword ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-600" />
                  <span>管理员密码已锁定保护</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  未设定保护密码
                </span>
              )}
            </div>

            <p className="text-[11px] font-semibold text-slate-600 leading-relaxed" style={{ color: "#475569" }}>
              设置导出 Excel 台账工作表的锁表保护密码。开启后导出的表格在 Excel/WPS 中打开时将锁定所有单元格，防止未经授权的修改或篡改财务发票数据。
            </p>

            {passError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold flex items-center space-x-1.5">
                <X className="w-4 h-4 text-red-600 shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <label className="flex items-center space-x-2 cursor-pointer font-bold text-xs text-slate-800" style={{ color: "#1e293b" }}>
                <input
                  type="checkbox"
                  checked={formData.protectExportedExcel || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      protectExportedExcel: e.target.checked,
                    })
                  }
                  className="accent-indigo-600 rounded cursor-pointer w-4 h-4"
                />
                <span className="flex items-center space-x-1" style={{ color: "#1e293b" }}>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span style={{ color: "#1e293b" }}>导出 Excel 时自动开启工作表锁定防篡改</span>
                </span>
              </label>

              {hasExistingPassword ? (
                <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-300">
                  <p className="text-xs font-bold text-slate-800" style={{ color: "#1e293b" }}>修改或撤销现有的财务保护密码：</p>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ color: "#334155" }}>
                      1. 输入当前原保护密码 (修改必填)：
                    </label>
                    <input
                      type="password"
                      placeholder="验证当前原密码"
                      value={currentPassVerification}
                      onChange={(e) => setCurrentPassVerification(e.target.value)}
                      style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ color: "#334155" }}>
                        2. 输入新保护密码：
                      </label>
                      <input
                        type="password"
                        placeholder="输入新密码 (若清空则留空)"
                        value={newPassInput}
                        onChange={(e) => setNewPassInput(e.target.value)}
                        style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ color: "#334155" }}>
                        3. 再次确认新密码：
                      </label>
                      <input
                        type="password"
                        placeholder="重复确认新密码"
                        value={confirmPassInput}
                        onChange={(e) => setConfirmPassInput(e.target.value)}
                        style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-slate-300">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ color: "#334155" }}>
                      设置防篡改工作表保护密码：
                    </label>
                    <input
                      type="password"
                      placeholder="设置自定义密码 (例如 123456)"
                      value={newPassInput}
                      onChange={(e) => setNewPassInput(e.target.value)}
                      style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ color: "#334155" }}>
                      再次确认密码：
                    </label>
                    <input
                      type="password"
                      placeholder="再次确认新密码"
                      value={confirmPassInput}
                      onChange={(e) => setConfirmPassInput(e.target.value)}
                      style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 text-xs text-slate-600 font-medium" style={{ color: "#475569" }}>
            <span>设置保存后即刻生效</span>
            <span className="border-l border-slate-300 pl-3">
              智能发票管理助手 v1.0
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              style={{ color: "#334155", backgroundColor: "#f1f5f9" }}
              className="px-4 py-2 font-bold text-xs rounded-xl cursor-pointer transition-colors hover:bg-slate-200 border border-slate-200"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-5 py-2 bg-[#E8000A] hover:bg-[#C80009] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer min-w-[130px] justify-center"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span className="text-white font-bold">已保存设置!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-white" />
                  <span className="text-white font-bold">保存系统设置</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
