import React, { useState, useEffect } from "react";
import { Printer, Sparkles } from "lucide-react";

export const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setFadeOut(true);
    }, 650);

    const timer2 = setTimeout(() => {
      onFinish();
    }, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0A0F1D] text-white transition-opacity duration-300 select-none ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="relative flex flex-col items-center px-6">
        {/* Glowing Logo Icon */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-red-600/40 to-sky-500/30 blur-xl animate-pulse" />
          <div className="relative w-20 h-20 bg-gradient-to-br from-[#E8000A] to-[#991B1B] rounded-2xl flex items-center justify-center shadow-2xl border border-red-500/30">
            <Printer className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* App Title */}
        <h1 className="text-2xl font-black tracking-wider text-white mb-2">
          智能发票管理助手
        </h1>
        <p className="text-xs font-semibold text-slate-400 tracking-wide mb-8">
          专为财务与报销打造的智能打印排版系统
        </p>

        {/* Dynamic Glowing Progress Bar */}
        <div className="w-60 h-1.5 bg-slate-800/80 rounded-full overflow-hidden mb-3 relative">
          <div className="h-full w-full bg-gradient-to-r from-[#E8000A] via-amber-400 to-sky-400 rounded-full animate-pulse" />
        </div>

        {/* Loading text */}
        <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>正在极速就绪发票数据库与排版引擎...</span>
        </div>
      </div>
    </div>
  );
};
