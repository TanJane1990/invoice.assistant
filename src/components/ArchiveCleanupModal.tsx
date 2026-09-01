import React, { useState } from "react";
import {
  ShieldAlert,
  Archive,
  Download,
  Trash2,
  Lock,
  CheckCircle2,
  X,
  FileArchive,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { InvoiceData, SystemSettings } from "../types";
import { createInvoiceArchiveZip, triggerDownloadBlob } from "../utils/backupZip";

interface ArchiveCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedInvoices: InvoiceData[];
  settings?: SystemSettings;
  onConfirmCleanup: (deletedIds: string[]) => void;
}

export const ArchiveCleanupModal: React.FC<ArchiveCleanupModalProps> = ({
  isOpen,
  onClose,
  archivedInvoices,
  settings,
  onConfirmCleanup,
}) => {
  const [selectedAction, setSelectedAction] = useState<"backup_and_clear" | "backup_only" | "clear_only">("backup_and_clear");
  const [passwordInput, setPasswordInput] = useState("");
  const [phraseInput, setPhraseInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  const hasPassword = Boolean(settings?.exportPassword && settings.exportPassword.trim());
  const totalAmount = archivedInvoices.reduce((sum, inv) => sum + inv.totalAmountWithTax, 0);

  // 校验密码或防呆口令是否合法
  const isAuthorized = (): boolean => {
    if (selectedAction === "backup_only") return true;
    if (hasPassword) {
      return passwordInput.trim() === (settings?.exportPassword || "").trim();
    }
    return phraseInput.trim() === "确认清空";
  };

  const handleExecute = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    // 1. 仅备份模式
    if (selectedAction === "backup_only") {
      try {
        setIsProcessing(true);
        const { zipBlob, fileName } = await createInvoiceArchiveZip(
          archivedInvoices,
          settings,
          "发票台账历史归档备份"
        );
        triggerDownloadBlob(zipBlob, fileName);
        setSuccessMessage(`已成功生成并下载备份包：${fileName}`);
      } catch (err: any) {
        setErrorMessage(`生成备份包失败: ${err?.message || "未知错误"}`);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // 2. 校验安全权限
    if (!isAuthorized()) {
      if (hasPassword) {
        setErrorMessage("管理密码错误，无法执行清空操作！");
      } else {
        setErrorMessage("请输入正确的确认口令「确认清空」以继续！");
      }
      return;
    }

    try {
      setIsProcessing(true);

      // 如果包含备份，先导出 ZIP
      if (selectedAction === "backup_and_clear") {
        const { zipBlob, fileName } = await createInvoiceArchiveZip(
          archivedInvoices,
          settings,
          "发票台账历史归档备份"
        );
        triggerDownloadBlob(zipBlob, fileName);
      }

      // 执行清空已归档发票
      const deletedIds = archivedInvoices.map((i) => i.id);
      onConfirmCleanup(deletedIds);

      alert(`已成功清空 ${deletedIds.length} 张已归档历史发票！\n新导入待报销的发票已 100% 完整保留。`);
      onClose();
    } catch (err: any) {
      setErrorMessage(`执行操作失败: ${err?.message || "未知错误"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="no-print print:hidden fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0E172B] text-white border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Archive className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-base tracking-wide text-white">
              历史归档发票管理与安全封存
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs bg-white text-slate-800">
          {/* 归档发票状态横幅 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500">当前已归档发票状态</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-slate-900">{archivedInvoices.length}</span>
                <span className="text-xs font-bold text-slate-600">张发票</span>
                <span className="text-xs font-mono font-black text-emerald-700">
                  (合计: ¥{totalAmount.toFixed(2)})
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
              已导出入账
            </span>
          </div>

          {/* 三种操作方式卡片 */}
          <div className="space-y-2.5">
            <label className="block font-bold text-slate-900">请选择操作方式：</label>

            {/* 选项 1: 备份并清空 */}
            <div
              onClick={() => setSelectedAction("backup_and_clear")}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start space-x-3 ${
                selectedAction === "backup_and_clear"
                  ? "border-emerald-600 bg-emerald-50/50 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="archiveAction"
                checked={selectedAction === "backup_and_clear"}
                onChange={() => setSelectedAction("backup_and_clear")}
                className="mt-0.5 accent-emerald-600 cursor-pointer"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-slate-900">🛡️ 导出完整备份 ZIP 并清空已归档</span>
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-200 text-emerald-900">
                    强烈推荐
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  将所有已归档发票（含高清原图 + Excel 台账 + 还原快照）打包为 ZIP 保存至电脑。确认保存成功后，安全清空已归档数据，让台账轻装上阵。
                </p>
              </div>
            </div>

            {/* 选项 2: 仅导出备份 */}
            <div
              onClick={() => setSelectedAction("backup_only")}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start space-x-3 ${
                selectedAction === "backup_only"
                  ? "border-sky-600 bg-sky-50/50 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="archiveAction"
                checked={selectedAction === "backup_only"}
                onChange={() => setSelectedAction("backup_only")}
                className="mt-0.5 accent-sky-600 cursor-pointer"
              />
              <div className="flex-1 space-y-1">
                <span className="font-extrabold text-slate-900">📦 仅导出完整备份 ZIP 包（不清空数据）</span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  仅生成并下载全量发票 ZIP 备份文件，当前软件内的发票保持原样，不作任何删除。
                </p>
              </div>
            </div>

            {/* 选项 3: 直接清空 */}
            <div
              onClick={() => setSelectedAction("clear_only")}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start space-x-3 ${
                selectedAction === "clear_only"
                  ? "border-red-600 bg-red-50/50 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="archiveAction"
                checked={selectedAction === "clear_only"}
                onChange={() => setSelectedAction("clear_only")}
                className="mt-0.5 accent-red-600 cursor-pointer"
              />
              <div className="flex-1 space-y-1">
                <span className="font-extrabold text-red-900">🗑️ 直接清空已归档数据（不备份）</span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  已保存在外部 Excel 台账中，直接从助手数据库释放空间。（不可撤销）
                </p>
              </div>
            </div>
          </div>

          {/* 安全密码/口令验证区（仅在涉及清空时显示） */}
          {selectedAction !== "backup_only" && (
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>安全授权验证（防止误操作）</span>
              </div>

              {hasPassword ? (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-amber-900">
                    请输入系统管理密码：
                  </label>
                  <input
                    type="password"
                    placeholder="输入系统设置中的管理密码"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-amber-900">
                    为防止手滑误删，请输入口令 <strong className="text-red-700">"确认清空"</strong>：
                  </label>
                  <input
                    type="text"
                    placeholder="请输入 确认清空"
                    value={phraseInput}
                    onChange={(e) => setPhraseInput(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <p className="text-[10px] text-amber-800">
                🛡️ 隔离保护：仅清理【已归档】历史发票，未导出的【✨ 新导入发票】100% 受到隔离保护。
              </p>
            </div>
          )}

          {/* 错误与成功提示 */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-100 text-red-900 text-xs font-bold flex items-center space-x-2 border border-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center space-x-2 border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            取消
          </button>

          <button
            onClick={handleExecute}
            disabled={isProcessing || (selectedAction !== "backup_only" && !isAuthorized())}
            className={`px-5 py-2 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5 ${
              isProcessing || (selectedAction !== "backup_only" && !isAuthorized())
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : selectedAction === "clear_only"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isProcessing ? (
              <span>正在处理中...</span>
            ) : selectedAction === "backup_and_clear" ? (
              <>
                <FileArchive className="w-4 h-4" />
                <span>备份并清空已归档</span>
              </>
            ) : selectedAction === "backup_only" ? (
              <>
                <Download className="w-4 h-4" />
                <span>导出 ZIP 备份包</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>确认清空已归档</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
