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
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white my-8">
        {/* 1. 顶部 Header (深黑背景，1:1 匹配图 1) */}
        <div className="px-6 py-4 bg-[#0E172B] text-white border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-extrabold text-base tracking-wide flex items-center space-x-2 text-white">
            <Upload className="w-5 h-5 text-[#E8000A]" />
            <span>批量导入发票文件</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. 规则提示 Sub-Header (白底+红色高亮提示) */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-[#E8000A]">
            <FileText className="w-4 h-4 text-[#E8000A]" />
            <span>批量导入发票文件 (支持 PDF / JPG / PNG / WEBP / OFD)</span>
          </div>
          <span className="text-slate-400 text-xs font-medium">
            智能 AI 全票面字段识别与查重
          </span>
        </div>

        {/* 3. 拖拽文件上传区域 Dropzone (红虚线框+红图标) */}
        <div className="p-6 bg-white">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
            }}
            className="p-10 rounded-3xl border-2 border-dashed border-[#E8000A] bg-white text-center cursor-pointer transition-all hover:bg-red-50/20"
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-full bg-red-100/80 text-[#E8000A] flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-[#E8000A]" />
            </div>
            <h4 className="text-base font-extrabold text-slate-900 mb-1.5">
              点击或拖拽发票文件 (PDF、JPG、PNG、OFD) 到此处
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              支持多选批量上传，系统自动调用智能AI进行全票面字段提取与自动防重预警
            </p>
          </div>

          {/* 4. 识别进度与日志条 */}
          {uploadLogs.length > 0 && (
            <div className="mt-4 border border-slate-200 rounded-2xl p-4 space-y-2.5 bg-slate-50">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center space-x-1.5">
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#E8000A]" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#009966]" />
                  )}
                  <span>
                    {isUploading
                      ? `识别中 (第 ${currentProcessingIndex + 1} / ${uploadLogs.length} 张)`
                      : `批量识别完成 (${uploadLogs.filter((l) => l.status === "success").length} / ${uploadLogs.length} 张)`}
                  </span>
                </span>
                <span className="font-mono text-slate-500">
                  {Math.round(
                    (uploadLogs.filter((l) => l.status === "success" || l.status === "error").length /
                      uploadLogs.length) *
                      100
                  )}
                  %
                </span>
              </div>

              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#E8000A] h-full transition-all duration-300"
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
                    className={`flex items-center justify-between text-xs p-2.5 rounded-xl border transition-colors ${
                      log.status === "processing"
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : log.status === "success"
                        ? "bg-white border-slate-200 text-slate-800"
                        : log.status === "error"
                        ? "bg-red-50 border-red-200 text-red-900"
                        : "bg-white border-slate-200 text-slate-500"
                    }`}
                  >
                    <span className="truncate max-w-[240px] font-medium">
                      {idx + 1}. {log.name}
                    </span>
                    <div className="flex items-center space-x-1">
                      {log.status === "waiting" && <span className="text-slate-400 text-[11px]">等待识别</span>}
                      {log.status === "processing" && (
                        <span className="flex items-center space-x-1 text-amber-600 font-bold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{log.message || "识别中..."}</span>
                        </span>
                      )}
                      {log.status === "success" && (
                        <span className="flex items-center space-x-1 text-[#009966] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{log.message}</span>
                        </span>
                      )}
                      {log.status === "error" && (
                        <span className="flex items-center space-x-1 text-red-600 font-semibold">
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

        {/* 5. 弹窗 Footer 按钮区 (1:1 匹配图 1) */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">
            支持多页PDF与格式防错补全
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
};
