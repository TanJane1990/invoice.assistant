/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { InvoiceData, PrintConfig, SystemSettings } from "./types";
import { SAMPLE_INVOICES } from "./data/sampleInvoices";
import { Header } from "./components/Header";
import { PrintLayoutToolbar } from "./components/PrintLayoutToolbar";
import { A4PagePreview } from "./components/A4PagePreview";
import { InvoiceLedgerTable } from "./components/InvoiceLedgerTable";
import { ReimbursementCover } from "./components/ReimbursementCover";
import { BatchImportModal } from "./components/BatchImportModal";
import { InvoiceDetailModal } from "./components/InvoiceDetailModal";
import { SettingsModal } from "./components/SettingsModal";
import { CustomDialogModal, DialogOptions } from "./components/CustomDialogModal";
import { exportInvoicesToExcel } from "./utils/exportExcel";
import { generateAndPrintPdf } from "./utils/exportPdf";

const DEFAULT_SETTINGS: SystemSettings = {
  aiApiKey: "",
  baiduApiKey: "",
  baiduSecretKey: "",
  defaultCompany: "",
  defaultDepartment: "财务部",
  defaultApplicant: "张三",
  defaultApprover: "李四",
  defaultFinanceAuditor: "王五",
  defaultCashier: "赵六",
  autoSaveInvoices: true,
  protectExportedExcel: false,
  exportPassword: "",
};

export const App: React.FC = () => {
  // 1. 核心状态：当前 Tab、皮肤主题、打印/排版配置
  const [activeTab, setActiveTab] = useState<"layout" | "ledger" | "cover">("layout");
  // 锁死为唯一的暗系主题 (#0E172B)
  const [theme] = useState<"light" | "dark">("dark");
  const [zoom, setZoom] = useState<number>(0.9);

  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    gridMode: "4",
    paperType: "A4",
    orientation: "landscape",
    showCropLines: true,
    showCategoryBadge: true,
    marginSize: "normal",
    sortBy: "category",
    includeCoverPage: false,
  });

  // 2. 核心状态：系统设置 & 发票台账列表
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem("system_settings_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        // 自动强行清除浏览器 localStorage 中残留的历史公司名称
        if (parsed.defaultCompany && (parsed.defaultCompany.includes("云启智创") || parsed.defaultCompany.includes("北京"))) {
          parsed.defaultCompany = "";
          localStorage.setItem("system_settings_v1", JSON.stringify(parsed));
        }
        return parsed;
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [invoices, setInvoices] = useState<InvoiceData[]>(() => {
    const saved = localStorage.getItem("invoice_app_data");
    if (saved) {
      try {
        const parsed: InvoiceData[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 自动强行清除台账列表中残留的历史公司名称
          const cleaned = parsed.map((inv) => ({
            ...inv,
            buyerName: (inv.buyerName || "").includes("云启智创") ? "" : inv.buyerName,
          }));
          localStorage.setItem("invoice_app_data", JSON.stringify(cleaned));
          return cleaned;
        }
      } catch (e) {
        /* ignore */
      }
    }
    return [];
  });

  // 3. 模态框/弹窗控制状态
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);

  // 自动将发票数据持久化到本地
  useEffect(() => {
    try {
      localStorage.setItem("app_theme_v1", theme);
    } catch {}
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("theme-dark", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("theme-dark", "dark");
    }
  }, [theme]);

  useEffect(() => {
    if (settings.autoSaveInvoices) {
      try {
        localStorage.setItem("invoice_app_data", JSON.stringify(invoices));
      } catch (e) {
        console.error("保存发票台账至本地失败:", e);
      }
    }
  }, [invoices, settings.autoSaveInvoices]);

  // 计算重复发票数量
  const duplicateCount = useMemo(() => {
    const numCounts = new Map<string, number>();
    invoices.forEach((inv) => {
      if (inv.invoiceNumber) {
        numCounts.set(inv.invoiceNumber, (numCounts.get(inv.invoiceNumber) || 0) + 1);
      }
    });
    return invoices.filter((inv) => inv.invoiceNumber && (numCounts.get(inv.invoiceNumber) || 0) > 1).length;
  }, [invoices]);

  // 计算当前拼页选择的发票列表
  const selectedInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.selected !== false);
  }, [invoices]);

  // 业务处理器 handlers
  const handleToggleTheme = () => {};

  const handleUpdateConfig = (newConfig: Partial<PrintConfig>) => {
    setPrintConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const handleAddInvoices = (newInvoices: InvoiceData[]) => {
    setInvoices((prev) => [...newInvoices, ...prev]);
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  const handleToggleSelectInvoice = (id: string) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setInvoices((prev) => prev.map((i) => ({ ...i, selected: select })));
  };

  const handleExportExcel = () => {
    exportInvoicesToExcel(invoices, settings, undefined, (result) => {
      if (!result.success) {
        setDialogOptions({
          isOpen: true,
          type: "warning",
          title: "导出提示",
          message: "当前没有可导出的发票数据！请先批量导入发票文件。",
          onConfirm: () => setDialogOptions(null),
          confirmText: "我知道了",
        });
        return;
      }

      setDialogOptions({
        isOpen: true,
        type: "success",
        title: "发票台账 Excel 导出成功",
        message: `✅ 已成功导出 ${result.totalCount} 条发票台账明细至 "${result.filename}"！`,
        subMessage: `💰 价税合计总额: ¥${result.totalAmount.toFixed(2)} | ✓ 发票全量自动校验正常`,
        passwordNotice: result.isProtected
          ? `🔒 已开启工作表防篡改锁定保护 (撤销保护密码: ${result.password})`
          : undefined,
        onConfirm: () => setDialogOptions(null),
        confirmText: "确定",
      });
    });
  };

  const handlePrint = () => {
    if (selectedInvoices.length === 0) {
      setDialogOptions({
        isOpen: true,
        type: "warning",
        title: "打印提示",
        message: "未找到排版页面，请先在台账中勾选需要打印排版的发票！",
        onConfirm: () => setDialogOptions(null),
        confirmText: "我知道了",
      });
      return;
    }
    setActiveTab("layout");
    setTimeout(async () => {
      const mainEl = document.querySelector<HTMLElement>("main");
      if (mainEl) {
        await generateAndPrintPdf(mainEl, `发票拼页排版_A4_${new Date().toISOString().split("T")[0]}.pdf`, printConfig.orientation);
      } else {
        window.print();
      }
    }, 200);
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors ${
        theme === "dark" ? "dark bg-[#0E172B] text-slate-100" : "bg-[#F3F5F9] text-slate-900"
      }`}
    >
      {/* 1. 顶部主导航栏 */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenBatchImport={() => setIsImportOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLoadSamples={() => setInvoices(SAMPLE_INVOICES)}
        onPrint={handlePrint}
        onExportExcel={handleExportExcel}
        selectedCount={selectedInvoices.length}
        duplicateCount={duplicateCount}
      />

      {/* 2. 主排版/台账/报销单视图区域 */}
      {activeTab === "layout" && (
        <>
          <PrintLayoutToolbar
            config={printConfig}
            theme={theme}
            onChangeConfig={handleUpdateConfig}
            zoom={zoom}
            setZoom={setZoom}
            totalInvoices={selectedInvoices.length}
            totalPages={Math.ceil(selectedInvoices.length / parseInt(printConfig.gridMode || "4", 10)) || 1}
            totalAmount={selectedInvoices.reduce((acc, curr) => acc + curr.totalAmountWithTax, 0)}
            onResetOrder={() => handleUpdateConfig({ sortBy: "category" })}
          />
          <main className="flex-1 overflow-auto p-4 flex justify-center bg-[#0E172B]">
            <A4PagePreview
              invoices={selectedInvoices}
              config={printConfig}
              zoom={zoom}
              theme={theme}
              onEditInvoice={(inv) => setEditingInvoice(inv)}
              onDeleteInvoice={handleDeleteInvoice}
            />
          </main>
        </>
      )}

      {activeTab === "ledger" && (
        <main className="flex-1 overflow-auto p-6 bg-[#0E172B]">
          <InvoiceLedgerTable
            invoices={invoices}
            onToggleSelect={handleToggleSelectInvoice}
            onToggleSelectAll={handleToggleSelectAll}
            onDelete={handleDeleteInvoice}
            onEdit={(inv) => setEditingInvoice(inv)}
            onOpenBatchImport={() => setIsImportOpen(true)}
            onLoadSamples={() => setInvoices(SAMPLE_INVOICES)}
            systemSettings={settings}
            theme={theme}
          />
        </main>
      )}

      {activeTab === "cover" && (
        <main className="flex-1 overflow-auto p-6 bg-[#0E172B]">
          <ReimbursementCover
            selectedInvoices={selectedInvoices}
            settings={settings}
            theme={theme}
            onPrintCover={handlePrint}
          />
        </main>
      )}

      {/* 3. 全局模态框弹窗集合 */}
      <BatchImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onAddInvoices={handleAddInvoices}
        onLoadSamples={() => setInvoices(SAMPLE_INVOICES)}
        settings={settings}
        theme={theme}
      />

      <InvoiceDetailModal
        isOpen={Boolean(editingInvoice)}
        invoice={editingInvoice}
        onClose={() => setEditingInvoice(null)}
        theme={theme}
        onSave={(updated) => {
          setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          setEditingInvoice(null);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
        invoices={invoices}
        onImportInvoicesJson={(imported) => setInvoices(imported)}
        theme={theme}
        onClearSavedInvoices={() => {
          setInvoices([]);
          localStorage.removeItem("invoice_app_data");
        }}
      />

      <CustomDialogModal
        options={dialogOptions}
        onClose={() => setDialogOptions(null)}
      />
    </div>
  );
};

export default App;
