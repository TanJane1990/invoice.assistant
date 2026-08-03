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
  onLoadSamples: () => void;
  settings?: SystemSettings;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onAddInvoices,
  settings,
}) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#0E1422] rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0B0F19] text-white border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-red-500" />
            <h3 className="font-extrabold text-base">批量导入发票文件</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtitle Bar */}
        <div className="bg-slate-50 dark:bg-[#131B2E] px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center justify-between">
          <span className="flex items-center space-x-1.5 text-red-600 dark:text-red-400 font-extrabold">
            <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span>批量导入发票文件 (支持 PDF / JPG / PNG / WEBP / OFD)</span>
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            智能全票面字段识别与查重
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6">
          <div>
            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 bg-[#F8FAFC] dark:bg-[#0A0E1A] rounded-2xl p-10 text-center cursor-pointer transition-all group"
            >
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/70 group-hover:bg-red-100 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3 transition-colors shadow-2xs">
                <Upload className="w-7 h-7" />
              </div>
              <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mb-1.5">
                点击或拖拽发票文件 (PDF、JPG、PNG、OFD) 到此处
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                支持多选批量上传，系统自动智能识别全票面字段与自动查重
              </p>
            </div>

            {/* Upload Progress & Logs */}
            {uploadLogs.length > 0 && (
              <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-[#131B2E] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
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
                  <span className="font-mono text-slate-500 dark:text-slate-400">
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

                <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
                  {uploadLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between text-xs p-2 rounded-lg border transition-colors ${
                        log.status === "processing"
                          ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                          : log.status === "success"
                          ? "bg-white dark:bg-[#0E1422] border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                          : log.status === "error"
                          ? "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
                          : "bg-slate-100/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-400"
                      }`}
                    >
                      <span className="truncate max-w-[240px] font-medium text-slate-700 dark:text-slate-300">
                        {idx + 1}. {log.name}
                      </span>
                      <div className="flex items-center space-x-1">
                        {log.status === "waiting" && (
                          <span className="text-slate-400 font-medium text-[11px]">
                            等待识别
                          </span>
                        )}
                        {log.status === "processing" && (
                          <span className="flex items-center space-x-1 text-amber-700 dark:text-amber-300 font-bold">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{log.message || "识别中..."}</span>
                          </span>
                        )}
                        {log.status === "success" && (
                          <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{log.message}</span>
                          </span>
                        )}
                        {log.status === "error" && (
                          <span className="flex items-center space-x-1 text-red-600 dark:text-red-400 font-semibold">
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
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-[#0B0F19] px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>支持多页PDF与格式防错补全</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
          >
            关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
};
