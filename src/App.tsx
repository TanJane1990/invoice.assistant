/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { InvoiceData, PrintConfig, SystemSettings } from "./types";
import { SAMPLE_INVOICES } from "./data/sampleInvoices";
import { numberToRMB } from "./utils/numberToRMB";
import { Header } from "./components/Header";
import { PrintLayoutToolbar } from "./components/PrintLayoutToolbar";
import { A4PagePreview } from "./components/A4PagePreview";
import { InvoiceLedgerTable } from "./components/InvoiceLedgerTable";
import { ReimbursementCover } from "./components/ReimbursementCover";
import { BatchImportModal } from "./components/BatchImportModal";
import { InvoiceDetailModal } from "./components/InvoiceDetailModal";
import { SettingsModal } from "./components/SettingsModal";
import { exportInvoicesToExcel } from "./utils/exportExcel";

const DEFAULT_SETTINGS: SystemSettings = {
  aiApiKey: "",
  baiduApiKey: "",
  baiduSecretKey: "",
  defaultCompany: "会钓鱼的猫",
  defaultDepartment: "猫粮研发部",
  defaultApplicant: "张喵喵",
  defaultApprover: "李喵喵",
  defaultFinanceAuditor: "陈喵喵",
  defaultCashier: "王喵喵",
  autoSaveInvoices: true,
  exportPassword: "",
  protectExportedExcel: false,
};

export default function App() {
  // Load initial settings
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem("system_settings_v1");
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Load initial invoices from localStorage if autoSave is on, starting with clean selection on session open
  const [invoices, setInvoices] = useState<InvoiceData[]>(() => {
    try {
      const savedInvoices = localStorage.getItem("invoice_ledger_data_v1");
      if (savedInvoices) {
        const parsed = JSON.parse(savedInvoices);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Keep historical records, but start clean (selectedForPrint = false) on new session
          return parsed.map((inv) => ({ ...inv, selectedForPrint: false }));
        }
      }
    } catch (e) {
      console.warn("Failed to read localStorage invoices:", e);
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<"layout" | "ledger" | "cover">(
    "layout"
  );

  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    gridMode: "4", // Default 4张/页 2x2 grid
    paperType: "A4",
    orientation: "landscape", // Auto set landscape for 2x2 grid
    showCropLines: true,
    showCategoryBadge: true,
    marginSize: "normal",
    includeCoverPage: false,
    sortBy: "invoice_type",
  });

  const [zoom, setZoom] = useState(1.0);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(
    null
  );

  // Theme skin state ("light" | "dark")
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return (localStorage.getItem("app_theme_v1") as "light" | "dark") || "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("app_theme_v1", theme);
    } catch {}
    if (theme === "dark") {
      document.body.classList.add("theme-dark");
      document.body.classList.remove("theme-light");
    } else {
      document.body.classList.add("theme-light");
      document.body.classList.remove("theme-dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  // Requirement 6: 自动保存台账表格（追加模式），加入导入发票的时间
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const nowStr = new Date().toLocaleString("zh-CN", { hour12: false });
        const invoicesWithImportTime = invoices.map((inv) => ({
          ...inv,
          importTime: inv.importTime || nowStr,
        }));

        // Read existing append history
        const existingStr = localStorage.getItem("invoice_ledger_history_v1");
        let existing: InvoiceData[] = [];
        if (existingStr) {
          try {
            existing = JSON.parse(existingStr);
          } catch {}
        }

        // Merge without duplicating IDs
        const existingIds = new Set(existing.map((item) => item.id));
        const newItems = invoicesWithImportTime.filter((item) => !existingIds.has(item.id));
        const mergedHistory = [...newItems, ...existing];

        localStorage.setItem("invoice_ledger_history_v1", JSON.stringify(mergedHistory));
        localStorage.setItem("invoice_ledger_data_v1", JSON.stringify(invoicesWithImportTime));
      } catch (err) {
        console.warn("Failed to auto-save ledger on unload", err);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [invoices]);

  // Persist invoices to localStorage when updated
  useEffect(() => {
    if (systemSettings.autoSaveInvoices) {
      try {
        const nowStr = new Date().toLocaleString("zh-CN", { hour12: false });
        const invoicesWithTime = invoices.map((inv) => ({
          ...inv,
          importTime: inv.importTime || nowStr,
        }));
        localStorage.setItem("invoice_ledger_data_v1", JSON.stringify(invoicesWithTime));
      } catch (err) {
        console.warn("Failed to persist invoices to localStorage", err);
      }
    }
  }, [invoices, systemSettings.autoSaveInvoices]);

  // Persist settings
  const handleSaveSettings = (newSettings: SystemSettings) => {
    setSystemSettings(newSettings);
    try {
      localStorage.setItem("system_settings_v1", JSON.stringify(newSettings));
    } catch (e) {
      console.warn("Failed to save settings", e);
    }
  };

  // 优化 #10: 查重逻辑改为 useMemo，避免 useEffect+setInvoices 的潜在循环
  const invoicesWithDuplicateCheck = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach((inv) => {
      const key = `${inv.invoiceCode || ""}_${inv.invoiceNumber}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return invoices.map((inv) => ({
      ...inv,
      duplicateWarning: (counts[`${inv.invoiceCode || ""}_${inv.invoiceNumber}`] || 0) > 1,
    }));
  }, [invoices]);

  const handleConfigChange = (newConfig: Partial<PrintConfig>) => {
    setPrintConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const handleAddInvoices = (newInvoices: InvoiceData[]) => {
    const nowStr = new Date().toLocaleString("zh-CN", { hour12: false });
    const formatted = newInvoices.map((inv) => ({
      ...inv,
      importTime: inv.importTime || nowStr,
      selectedForPrint: true,
    }));
    setInvoices((prev) => [...formatted, ...prev]);
  };

  const handleLoadSamples = () => {
    const nowStr = new Date().toLocaleString("zh-CN", { hour12: false });
    const samples = SAMPLE_INVOICES.map((inv) => ({
      ...inv,
      importTime: inv.importTime || nowStr,
      selectedForPrint: true,
    }));
    setInvoices((prev) => [...samples, ...prev]);
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  const handleToggleSelectForPrint = (id: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, selectedForPrint: !inv.selectedForPrint } : inv
      )
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setInvoices((prev) =>
      prev.map((inv) => ({ ...inv, selectedForPrint: select }))
    );
  };

  const handleSaveInvoice = (updated: InvoiceData) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updated.id ? updated : inv))
    );
  };

  const handleAddCustomInvoice = () => {
    const newInv: InvoiceData = {
      id: `inv-custom-${Date.now()}`,
      invoiceType: "增值税电子普通发票",
      invoiceCode: "011002300" + Math.floor(Math.random() * 899 + 100),
      invoiceNumber: String(Math.floor(Math.random() * 89999999 + 10000000)),
      issueDate: new Date().toISOString().split("T")[0],
      buyerName: "北京云启智创科技有限公司",
      buyerTaxId: "91110108MA0192837X",
      sellerName: "新增销售商户",
      totalAmountWithoutTax: 94.34,
      totalTaxAmount: 5.66,
      totalAmountWithTax: 100.0,
      totalAmountWithTaxCN: numberToRMB(100.0),
      category: "办公用品",
      remarks: "手动新建发票",
      selectedForPrint: true,
      items: [
        {
          id: `item-custom-${Date.now()}`,
          name: "*办公用品*物品报销",
          amount: 100.0,
          quantity: 1,
        },
      ],
    };

    setInvoices((prev) => [newInv, ...prev]);
    setEditingInvoice(newInv);
  };

  const handleExportExcel = () => {
    exportInvoicesToExcel(invoices, systemSettings);
  };

  const selectedInvoices = invoicesWithDuplicateCheck.filter((i) => i.selectedForPrint);
  const itemsPerPage = parseInt(printConfig.gridMode, 10);
  const totalPages = Math.ceil(selectedInvoices.length / itemsPerPage);
  const totalAmount = selectedInvoices.reduce(
    (sum, i) => sum + i.totalAmountWithTax,
    0
  );
  const duplicateCount = invoicesWithDuplicateCheck.filter((i) => i.duplicateWarning).length;

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-red-100 selection:text-red-900 ${
      theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-100/80 text-slate-900"
    }`}>
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenBatchImport={() => setIsImportModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onLoadSamples={handleLoadSamples}
        onPrint={() => window.print()}
        onExportExcel={handleExportExcel}
        selectedCount={selectedInvoices.length}
        duplicateCount={duplicateCount}
      />

      {/* Main View Area */}
      {activeTab === "layout" && (
        <main className="flex-1 flex flex-col">
          <PrintLayoutToolbar
            config={printConfig}
            onChangeConfig={handleConfigChange}
            zoom={zoom}
            setZoom={setZoom}
            totalInvoices={selectedInvoices.length}
            totalPages={totalPages}
            totalAmount={totalAmount}
            onResetOrder={() =>
              setPrintConfig((p) => ({ ...p, sortBy: "date_asc" }))
            }
          />

          {/* Optional Reimbursement Cover included before A4 invoices */}
          {printConfig.includeCoverPage && selectedInvoices.length > 0 && (
            <div className="pt-8">
              <ReimbursementCover
                invoices={invoices}
                defaultSettings={systemSettings}
                config={printConfig}
                onOpenBatchImport={() => setIsImportModalOpen(true)}
              />
            </div>
          )}

          {/* A4 Live Layout Preview */}
          <A4PagePreview
            invoices={selectedInvoices}
            config={printConfig}
            zoom={zoom}
            onEditInvoice={(inv) => setEditingInvoice(inv)}
            onDeleteInvoice={handleDeleteInvoice}
            onOpenBatchImport={() => setIsImportModalOpen(true)}
          />
        </main>
      )}

      {activeTab === "ledger" && (
        <main className="flex-1 py-4">
          <InvoiceLedgerTable
            invoices={invoices}
            systemSettings={systemSettings}
            onToggleSelectForPrint={handleToggleSelectForPrint}
            onToggleSelectAll={handleToggleSelectAll}
            onDeleteInvoice={handleDeleteInvoice}
            onEditInvoice={(inv) => setEditingInvoice(inv)}
            onAddCustomInvoice={handleAddCustomInvoice}
          />
        </main>
      )}

      {activeTab === "cover" && (
        <main className="flex-1 py-4">
          <ReimbursementCover
            invoices={invoices}
            defaultSettings={systemSettings}
            onOpenBatchImport={() => setIsImportModalOpen(true)}
          />
        </main>
      )}

      {/* Modals */}
      <BatchImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onAddInvoices={handleAddInvoices}
        onLoadSamples={handleLoadSamples}
        settings={systemSettings}
      />

      <InvoiceDetailModal
        isOpen={!!editingInvoice}
        invoice={editingInvoice}
        onClose={() => setEditingInvoice(null)}
        onSave={handleSaveInvoice}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={systemSettings}
        onSaveSettings={handleSaveSettings}
        invoices={invoices}
        onImportInvoicesJson={(imported) => setInvoices(imported)}
        onClearSavedInvoices={() => {
          setInvoices([]);
          localStorage.removeItem("invoice_ledger_data_v1");
        }}
      />
    </div>
  );
}
