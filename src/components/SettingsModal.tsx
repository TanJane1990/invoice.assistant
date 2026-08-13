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
} from "lucide-react";
import { SystemSettings, InvoiceData } from "../types";

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
}) => {
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0B0F19] text-white border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-red-500" />
            <h3 className="font-extrabold text-base tracking-wide">智能发票助手 - 系统设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto text-xs text-slate-900 bg-white">
          {/* Section 1: AI Key Configuration */}
          <div className="space-y-3 bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm">
                <Key className="w-4 h-4 text-amber-500" />
                <span>智能 AI 识别 API 密钥配置</span>
              </div>
            </div>
            <p className="text-slate-500 text-[11px]">
              默认使用内置OCR算法，您也可以填入自定义 AI 大模型 API Key 提升处理分析速度。
            </p>
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                通用 AI 大模型 API Key
              </label>
              <input
                type="password"
                placeholder="sk-..."
                value={formData.aiApiKey || ""}
                onChange={(e) =>
                  setFormData({ ...formData, aiApiKey: e.target.value })
                }
                className="w-full p-2.5 bg-white text-slate-900 border border-slate-200/90 rounded-xl font-mono focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          {/* Section 2: Baidu Cloud OCR API Configuration */}
          <div className="space-y-3 bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>百度 OCR 增值税发票识别 API 配置</span>
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
            <p className="text-slate-500 text-[11px]">
              配置百度智能云文字识别（增值税发票识别接口）API ，实现发票全票面高精精准识别。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-800 font-bold mb-1">
                  百度云 API Key (AK)
                </label>
                <input
                  type="password"
                  placeholder="填入百度云 API Key"
                  value={formData.baiduApiKey || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, baiduApiKey: e.target.value })
                  }
                  className="w-full p-2 bg-white text-slate-900 border border-slate-200/90 rounded-xl font-mono focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-slate-800 font-bold mb-1">
                  百度云 Secret Key (SK)
                </label>
                <input
                  type="password"
                  placeholder="填入百度云 Secret Key"
                  value={formData.baiduSecretKey || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, baiduSecretKey: e.target.value })
                  }
                  className="w-full p-2 bg-white text-slate-900 border border-slate-200/90 rounded-xl font-mono focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Default Company & Approver Info */}
          <div className="space-y-3 bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm">
                <Building2 className="w-4 h-4 text-blue-500" />
                <span>默认报销抬头与审批人员预设</span>
              </div>
              <span className="text-[10px] text-slate-400">
                (更改后自动作为报销封面预设值)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-800 mb-1 font-bold">默认单位名称</label>
                <input
                  type="text"
                  value={formData.defaultCompany}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultCompany: e.target.value })
                  }
                  className="w-full p-2 bg-white text-slate-900 border border-slate-200/90 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1 font-bold">默认报销部门</label>
                <input
                  type="text"
                  value={formData.defaultDepartment}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultDepartment: e.target.value })
                  }
                  className="w-full p-2 bg-white text-slate-900 border border-slate-200/90 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1 font-bold">默认报销人</label>
                <input
                  type="text"
                  value={formData.defaultApplicant}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultApplicant: e.target.value })
                  }
                  className="w-full p-2 bg-white text-slate-900 border border-slate-200/90 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1 font-bold">主管审批人</label>
                <input
                  type="text"
                  value={formData.defaultApprover}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultApprover: e.target.value })
                  }
                  className="w-full p-2 bg-white text-slate-900 border border-slate-200/90 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1 font-bold">财务复核人</label>
                <input
                  type="text"
                  value={formData.defaultFinanceAuditor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultFinanceAuditor: e.target.value,
                    })
                  }
                  className="w-full p-2 bg-white text-slate-900 border border-slate-200/90 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1 font-bold">出纳或经办人</label>
                <input
                  type="text"
                  value={formData.defaultCashier}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultCashier: e.target.value })
                  }
                  className="w-full p-2 bg-white text-slate-900 border border-slate-200/90 rounded-xl font-medium focus:ring-2 focus:ring-red-500 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium">
            <span>设置保存后即刻生效</span>
            <span className="border-l border-slate-300 pl-3">
              软件开发：会钓鱼的猫
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 font-bold text-xs rounded-xl cursor-pointer transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-5 py-2 bg-[#e60023] hover:bg-[#cc001f] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer min-w-[130px] justify-center"
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
