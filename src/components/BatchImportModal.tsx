import React, { useState, useRef } from "react";
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { InvoiceData, SystemSettings } from "../types";
import { processInvoiceFileUnified } from "../utils/unifiedInvoiceOcrPipeline";

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddInvoices: (newInvoices: InvoiceData[]) => void;
  onLoadSamples?: () => void;
  settings?: SystemSettings;
  theme?: "light" | "dark";
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onAddInvoices,
  settings,
  theme = "dark",
}) => {
  const isDark = theme === "dark";
  const [isUploading, setIsUploading] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);
  const [uploadLogs, setUploadLogs] = useState<
    { name: string; status: "waiting" | "processing" | "success" | "error"; message?: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process uploaded files silently with clean status
  const handleFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setCurrentProcessingIndex(0);

    const fileList = Array.from(files);
    const newLogs = fileList.map((f, idx) => ({
      name: f.name,
      status: (idx === 0 ? "processing" : "waiting") as "waiting" | "processing" | "success" | "error",
      message: idx === 0 ? "正在识别..." : "排队等待",
    }));
    setUploadLogs(newLogs);

    const parsedInvoices: InvoiceData[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setCurrentProcessingIndex(i);

      setUploadLogs((prev) =>
        prev.map((log, idx) =>
          idx === i
            ? { ...log, status: "processing", message: `正在识别 (第 ${i + 1}/${fileList.length} 张)...` }
            : log
        )
      );

      try {
        const reader = new FileReader();
        const fileBase64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const fileBase64 = await fileBase64Promise;
        const mimeType = file.type || "image/png";

        // 静默调用统一管线识别
        const { invoice } = await processInvoiceFileUnified(
          fileBase64,
          mimeType,
          file.name,
          i,
          settings
        );

        parsedInvoices.push(invoice);

        setUploadLogs((prev) =>
          prev.map((log, idx) =>
            idx === i
              ? {
                  ...log,
                  status: "success",
                  message: `已识别 (¥${invoice.totalAmountWithTax.toFixed(2)})`,
                }
              : idx === i + 1
              ? { ...log, status: "processing", message: "准备识别..." }
              : log
          )
        );
      } catch (err: any) {
        console.warn("Error processing invoice file:", err);
      }
    }

    setIsUploading(false);
    if (parsedInvoices.length > 0) {
      onAddInvoices(parsedInvoices);
      setTimeout(() => {
        onClose();
      }, 700);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all ${
          isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* 弹窗 Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <h3 className="font-bold text-base flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
            <span>批量导入电子发票</span>
          </h3>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 拖拽文件上传区域 (Dropzone) */}
        <div className="p-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
            }}
            className={`p-8 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${
              isDark
                ? "border-slate-700 bg-slate-950/40 hover:border-red-500 hover:bg-red-500/5"
                : "border-slate-300 bg-slate-50/50 hover:border-red-500 hover:bg-red-50/30"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/70 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Upload className="w-6 h-6" />
            </div>
            <p className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              点击或将发票文件 (PDF/图片) 拖拽至此处
            </p>
            <p className="text-xs text-slate-400 mt-1">支持自动解析发票全票面信息与金额</p>
          </div>

          {/* 进度与日志 */}
          {uploadLogs.length > 0 && (
            <div
              className={`mt-4 border rounded-xl p-3 space-y-2 ${
                isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center space-x-1.5">
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>
                    {isUploading
                      ? `识别中 (第 ${currentProcessingIndex + 1} / ${uploadLogs.length} 张)`
                      : `批量识别完成 (${uploadLogs.filter((l) => l.status === "success").length} / ${uploadLogs.length} 张)`}
                  </span>
                </span>
                <span className="font-mono text-slate-400">
                  {Math.round(
                    (uploadLogs.filter((l) => l.status === "success" || l.status === "error").length /
                      uploadLogs.length) *
                      100
                  )}
                  %
                </span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-red-600 h-full transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      (uploadLogs.filter((l) => l.status === "success" || l.status === "error").length /
                        uploadLogs.length) *
                        100
                    )}%`,
                  }}
                ></div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
                {uploadLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between text-xs p-2 rounded-lg border transition-colors ${
                      log.status === "processing"
                        ? isDark ? "bg-amber-950/60 border-amber-800 text-amber-200" : "bg-amber-50 border-amber-300 text-amber-900"
                        : log.status === "success"
                        ? isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                        : log.status === "error"
                        ? isDark ? "bg-red-950/60 border-red-800 text-red-200" : "bg-red-50 border-red-200 text-red-900"
                        : "bg-slate-800/40 border-slate-700 text-slate-400"
                    }`}
                  >
                    <span className="truncate max-w-[220px] font-medium">
                      {idx + 1}. {log.name}
                    </span>
                    <div className="flex items-center space-x-1">
                      {log.status === "waiting" && <span className="text-slate-400 text-[11px]">等待识别</span>}
                      {log.status === "processing" && (
                        <span className="flex items-center space-x-1 text-amber-500 font-bold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{log.message || "识别中..."}</span>
                        </span>
                      )}
                      {log.status === "success" && (
                        <span className="flex items-center space-x-1 text-emerald-500 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{log.message}</span>
                        </span>
                      )}
                      {log.status === "error" && (
                        <span className="flex items-center space-x-1 text-red-500 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>识别失败</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 弹窗 Footer 按钮区 */}
        <div
          className={`px-6 py-4 border-t flex justify-end space-x-3 ${
            isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
              isDark
                ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                : "border-slate-200 hover:bg-slate-100 text-slate-700"
            }`}
          >
            取消
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer"
          >
            确认完成
          </button>
        </div>
      </div>
    </div>
  );
};
