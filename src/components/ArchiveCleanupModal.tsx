import React, { useState, useMemo } from "react";
import {
  Archive,
  Download,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  FileArchive,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { InvoiceData, SystemSettings } from "../types";
import { createInvoiceArchiveZip, triggerDownloadBlob } from "../utils/backupZip";

interface ArchiveCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices?: InvoiceData[];
  archivedInvoices?: InvoiceData[];
  systemSettings?: SystemSettings;
  settings?: SystemSettings;
  onCleanupSuccess?: (deletedIds: string[]) => void;
  onConfirmCleanup?: (deletedIds: string[]) => void;
}

export const ArchiveCleanupModal: React.FC<ArchiveCleanupModalProps> = ({
  isOpen,
  onClose,
  invoices,
  archivedInvoices,
  systemSettings,
  settings,
  onCleanupSuccess,
  onConfirmCleanup,
}) => {
  const [selectedAction, setSelectedAction] = useState<"backup_and_clear" | "backup_only" | "clear_only">("backup_and_clear");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phraseInput, setPhraseInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const actualSettings = systemSettings || settings;

  const actualArchived = useMemo(() => {
    if (archivedInvoices && Array.isArray(archivedInvoices)) {
      return archivedInvoices;
    }
    if (invoices && Array.isArray(invoices)) {
      return invoices.filter((i) => !!i.exported);
    }
    return [];
  }, [archivedInvoices, invoices]);

  if (!isOpen) return null;

  const hasPassword = Boolean(actualSettings?.exportPassword && actualSettings.exportPassword.trim());
  const totalAmount = actualArchived.reduce((sum, inv) => sum + (inv.totalAmountWithTax || 0), 0);
  const totalCount = actualArchived.length;

  // 校验密码或防呆口令是否合法
  const isAuthorized = (): boolean => {
    if (selectedAction === "backup_only") return true;
    if (hasPassword) {
      return passwordInput.trim() === (actualSettings?.exportPassword || "").trim();
    }
    return phraseInput.trim() === "确认清空";
  };

  const handleExecute = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (totalCount === 0) {
      setErrorMessage("当前没有已归档的发票数据可供操作。");
      return;
    }

    // 1. 仅备份模式
    if (selectedAction === "backup_only") {
      try {
        setIsProcessing(true);
        const { zipBlob, fileName } = await createInvoiceArchiveZip(
          actualArchived,
          actualSettings,
          "历史已归档发票备份包"
        );
        triggerDownloadBlob(zipBlob, fileName);
        setSuccessMessage(`🎉 成功导出 ${totalCount} 张历史发票完整备份包！`);
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err: any) {
        setErrorMessage(`导出备份失败: ${err?.message || "未知错误"}`);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // 2. 备份并清空已归档模式
    if (selectedAction === "backup_and_clear") {
      try {
        setIsProcessing(true);
        const { zipBlob, fileName } = await createInvoiceArchiveZip(
          actualArchived,
          actualSettings,
          "历史已归档发票安全清空前备份包"
        );
        triggerDownloadBlob(zipBlob, fileName);

        const deletedIds = actualArchived.map((inv) => inv.id);
        if (onCleanupSuccess) onCleanupSuccess(deletedIds);
        if (onConfirmCleanup) onConfirmCleanup(deletedIds);

        setSuccessMessage(`🎉 备份包已成功下载，且已安全清空 ${totalCount} 条已归档数据！`);
        setTimeout(() => {
          onClose();
        }, 1800);
      } catch (err: any) {
        setErrorMessage(`处理失败: ${err?.message || "未知错误"}`);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // 3. 直接清空模式 (不备份)
    if (selectedAction === "clear_only") {
      try {
        setIsProcessing(true);
        const deletedIds = actualArchived.map((inv) => inv.id);
        if (onCleanupSuccess) onCleanupSuccess(deletedIds);
        if (onConfirmCleanup) onConfirmCleanup(deletedIds);

        setSuccessMessage(`🗑️ 已成功清空 ${totalCount} 条已归档发票数据！`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } catch (err: any) {
        setErrorMessage(`清空失败: ${err?.message || "未知错误"}`);
      } finally {
        setIsProcessing(false);
      }
      return;
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="no-print print:hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto font-sans"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col my-auto max-h-[88vh] animate-in fade-in zoom-in-95 duration-200"
        style={{ backgroundColor: "#ffffff" }}
      >
        {/* Header - 固定置顶 */}
        <div
          className="modal-dark-header shrink-0 flex items-center justify-between px-6 py-4 bg-[#0E172B] text-white border-b border-slate-800"
          style={{ backgroundColor: "#0E172B" }}
        >
          <div className="flex items-center space-x-2.5">
            <Archive className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-base tracking-wide text-white" style={{ color: "#ffffff !important" }}>
              历史归档发票管理与安全封存
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="关闭窗口"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - 内部弹性平滑滚动 */}
        <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-3.5 font-sans text-xs bg-white" style={{ color: "#0f172a" }}>
          {/* 状态统计卡 */}
          <div
            className="p-3.5 rounded-2xl border flex items-center justify-between"
            style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}
          >
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold" style={{ color: "#64748b" }}>
                当前已归档发票状态
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black" style={{ color: "#0f172a" }}>
                  {totalCount}
                </span>
                <span className="font-bold" style={{ color: "#475569" }}>
                  张发票
                </span>
                <span className="text-xs font-mono font-bold" style={{ color: "#059669" }}>
                  (合计: ¥{totalAmount.toFixed(2)})
                </span>
              </div>
            </div>
            <span
              className="px-2.5 py-1 text-xs font-black rounded-lg border"
              style={{ backgroundColor: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0" }}
            >
              已导出入库
            </span>
          </div>

          {/* 操作模式选择 */}
          <div className="space-y-2">
            <label className="block text-xs font-black" style={{ color: "#0f172a" }}>
              请选择操作方式：
            </label>

            {/* 选项 1: 备份并清空 (强烈推荐) */}
            <div
              onClick={() => setSelectedAction("backup_and_clear")}
              className="p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start space-x-3 relative"
              style={{
                backgroundColor: selectedAction === "backup_and_clear" ? "#ecfdf5" : "#ffffff",
                borderColor: selectedAction === "backup_and_clear" ? "#059669" : "#cbd5e1",
              }}
            >
              <input
                type="radio"
                name="archiveAction"
                checked={selectedAction === "backup_and_clear"}
                onChange={() => setSelectedAction("backup_and_clear")}
                className="mt-1 accent-emerald-600 cursor-pointer"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-black text-xs" style={{ color: "#064e3b" }}>
                    🛡️ 导出完整备份 ZIP 并清空已归档
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-600 text-white rounded-md shadow-2xs">
                    强烈推荐
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "#047857" }}>
                  将所有已归档发票（含高清原图 + Excel 台账 + 还原快照）打包为 ZIP 保存至电脑。确认保存成功后，安全清空已归档数据，让台账轻装上阵。
                </p>
              </div>
            </div>

            {/* 选项 2: 仅导出备份 */}
            <div
              onClick={() => setSelectedAction("backup_only")}
              className="p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start space-x-3"
              style={{
                backgroundColor: selectedAction === "backup_only" ? "#f0f9ff" : "#ffffff",
                borderColor: selectedAction === "backup_only" ? "#0284c7" : "#cbd5e1",
              }}
            >
              <input
                type="radio"
                name="archiveAction"
                checked={selectedAction === "backup_only"}
                onChange={() => setSelectedAction("backup_only")}
                className="mt-1 accent-sky-600 cursor-pointer"
              />
              <div className="flex-1 space-y-1">
                <span className="font-extrabold text-xs block" style={{ color: "#0f172a" }}>
                  📦 仅导出完整备份 ZIP 包（不清空数据）
                </span>
                <p className="text-[11px] leading-relaxed" style={{ color: "#475569" }}>
                  仅生成并下载全量发票 ZIP 备份文件，当前软件内的发票保持原样，不作任何删除。
                </p>
              </div>
            </div>

            {/* 选项 3: 直接清空 */}
            <div
              onClick={() => setSelectedAction("clear_only")}
              className="p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start space-x-3"
              style={{
                backgroundColor: selectedAction === "clear_only" ? "#fef2f2" : "#ffffff",
                borderColor: selectedAction === "clear_only" ? "#dc2626" : "#cbd5e1",
              }}
            >
              <input
                type="radio"
                name="archiveAction"
                checked={selectedAction === "clear_only"}
                onChange={() => setSelectedAction("clear_only")}
                className="mt-1 accent-red-600 cursor-pointer"
              />
              <div className="flex-1 space-y-1">
                <span className="font-extrabold text-xs block" style={{ color: "#991b1b" }}>
                  🗑️ 直接清空已归档数据（不备份）
                </span>
                <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>
                  数据已保存在外部 Excel 台账中，直接从助手数据库释放空间。（此操作不可撤销）
                </p>
              </div>
            </div>
          </div>

          {/* 安全密码/口令验证区（仅在涉及清空时显示） */}
          {selectedAction !== "backup_only" && (
            <div
              className="p-3.5 rounded-2xl border space-y-2 shadow-2xs"
              style={{ backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}
            >
              <div className="flex items-center space-x-1.5 font-black text-xs" style={{ color: "#78350f" }}>
                <Lock className="w-4 h-4" style={{ color: "#b45309" }} />
                <span>安全授权验证（防止误操作）</span>
              </div>

              {hasPassword ? (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold" style={{ color: "#78350f" }}>
                    请输入系统管理密码：
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="输入系统设置中的管理密码"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      autoComplete="off"
                      autoFocus
                      style={{
                        backgroundColor: "#ffffff",
                        color: "#0f172a",
                        caretColor: "#0f172a",
                        borderColor: "#f59e0b",
                        userSelect: "text",
                        WebkitUserSelect: "text",
                      }}
                      className="w-full p-2.5 pr-10 bg-white border rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-text select-text"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                      title={showPassword ? "隐藏密码明文" : "显示密码明文"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 text-amber-700" /> : <Eye className="w-4 h-4 text-amber-700" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold" style={{ color: "#78350f" }}>
                      为防止手滑误删，请输入口令 <strong style={{ color: "#b91c1c" }}>"确认清空"</strong>：
                    </label>
                    <button
                      type="button"
                      onClick={() => setPhraseInput("确认清空")}
                      className="text-[10px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded transition cursor-pointer"
                    >
                      一键填入口令
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="请输入 确认清空"
                    value={phraseInput}
                    onChange={(e) => setPhraseInput(e.target.value)}
                    autoComplete="off"
                    autoFocus
                    style={{
                      backgroundColor: "#ffffff",
                      color: "#0f172a",
                      caretColor: "#0f172a",
                      borderColor: phraseInput.trim() === "确认清空" ? "#10b981" : "#f59e0b",
                      userSelect: "text",
                      WebkitUserSelect: "text",
                    }}
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-text select-text"
                  />
                </div>
              )}

              <p className="text-[10px] font-medium leading-relaxed" style={{ color: "#92400e" }}>
                🛡️ 隔离保护说明：仅清理【已归档】历史发票，未导出的【✨ 新导入发票】受到物理保护，绝对不会被删除。
              </p>
            </div>
          )}

          {/* 错误与成功提示 */}
          {errorMessage && (
            <div
              className="p-3 rounded-xl text-xs font-bold flex items-center space-x-2 border"
              style={{ backgroundColor: "#fee2e2", color: "#991b1b", borderColor: "#fca5a5" }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#dc2626" }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              className="p-3 rounded-xl text-xs font-bold flex items-center space-x-2 border"
              style={{ backgroundColor: "#d1fae5", color: "#065f46", borderColor: "#6ee7b7" }}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#059669" }} />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer - 固定底部 */}
        <div
          className="shrink-0 px-6 py-4 border-t flex items-center justify-end space-x-3 bg-slate-50"
          style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}
        >
          <button
            onClick={onClose}
            style={{ backgroundColor: "#ffffff", color: "#334155", borderColor: "#cbd5e1" }}
            className="px-4 py-2 border rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            取消
          </button>

          <button
            onClick={handleExecute}
            disabled={isProcessing || (selectedAction !== "backup_only" && !isAuthorized())}
            style={{
              backgroundColor:
                isProcessing || (selectedAction !== "backup_only" && !isAuthorized())
                  ? "#cbd5e1"
                  : selectedAction === "clear_only"
                  ? "#dc2626"
                  : "#059669",
              color:
                isProcessing || (selectedAction !== "backup_only" && !isAuthorized())
                  ? "#64748b"
                  : "#ffffff",
            }}
            className={`px-5 py-2 rounded-xl text-xs font-black shadow-sm transition-all flex items-center space-x-1.5 ${
              !isProcessing && (selectedAction === "backup_only" || isAuthorized())
                ? "hover:opacity-90 cursor-pointer shadow-md"
                : "cursor-not-allowed opacity-60"
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
