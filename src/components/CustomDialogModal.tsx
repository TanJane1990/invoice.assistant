import React from "react";
import { CheckCircle2, AlertTriangle, FileSpreadsheet, Lock, X } from "lucide-react";

export interface DialogOptions {
  isOpen: boolean;
  type: "success" | "warning" | "info" | "confirm_export";
  title: string;
  message: string;
  subMessage?: string;
  passwordNotice?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  extraButtons?: Array<{
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "danger" | "emerald";
  }>;
}

interface CustomDialogModalProps {
  options: DialogOptions | null;
  onClose: () => void;
}

export const CustomDialogModal: React.FC<CustomDialogModalProps> = ({ options, onClose }) => {
  if (!options || !options.isOpen) return null;

  const {
    type,
    title,
    message,
    subMessage,
    passwordNotice,
    onConfirm,
    onCancel,
    confirmText = "确定",
    cancelText = "取消",
    extraButtons = [],
  } = options;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col my-8">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#0E172B] text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            {type === "info" && <FileSpreadsheet className="w-5 h-5 text-blue-400" />}
            {type === "confirm_export" && <FileSpreadsheet className="w-5 h-5 text-[#E8000A]" />}
            <h3 className="font-extrabold text-sm tracking-wide text-white" style={{ color: "#ffffff" }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 bg-white space-y-3" style={{ color: "#0f172a" }}>
          <div className="font-bold text-sm leading-relaxed" style={{ color: "#0f172a" }}>
            {message}
          </div>

          {subMessage && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium space-y-1" style={{ color: "#334155" }}>
              <p style={{ color: "#334155" }}>{subMessage}</p>
            </div>
          )}

          {passwordNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center space-x-2">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{passwordNotice}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2.5 flex-wrap gap-y-2">
          {onCancel && (
            <button
              onClick={() => {
                onCancel();
                onClose();
              }}
              style={{ color: "#334155", backgroundColor: "#ffffff" }}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-100 transition-all cursor-pointer"
            >
              {cancelText}
            </button>
          )}

          {extraButtons.map((btn, idx) => (
            <button
              key={idx}
              onClick={() => {
                btn.onClick();
                onClose();
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs ${
                btn.variant === "emerald"
                  ? "bg-[#009966] hover:bg-[#007A52] text-white"
                  : btn.variant === "primary"
                  ? "bg-[#E8000A] hover:bg-[#C80009] text-white"
                  : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-300"
              }`}
            >
              {btn.label}
            </button>
          ))}

          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2 text-xs font-bold text-white bg-[#E8000A] hover:bg-[#C80009] rounded-xl shadow-md transition-all cursor-pointer"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
