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
import { exportInvoicesToExcel } from "./utils/exportExcel";
import { generateAndPrintPdf } from "./utils/exportPdf";

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
    sortBy: "category",
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
      document.documentElement.classList.add("dark");
      document.body.classList.add("theme-dark", "dark");
      document.body.classList.remove("theme-light");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.add("theme-light");
      document.body.classList.remove("theme-dark", "dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  // 自动保存台账表格
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        if (systemSettings.autoSaveInvoices && invoices.length > 0) {
          localStorage.setItem("invoice_ledger_data_v1", JSON.stringify(invoices));
        }
      } catch (e) {
        console.warn("Failed to write localStorage on unload:", e);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [invoices, systemSettings.autoSaveInvoices]);

  // Save settings change
  const handleSaveSettings = (newSettings: SystemSettings) => {
    setSystemSettings(newSettings);
    try {
      localStorage.setItem("system_settings_v1", JSON.stringify(newSettings));
    } catch (e) {
      console.warn("Failed to save system settings:", e);
    }
  };

  // Toggle selection for single invoice
  const handleToggleSelectForPrint = (id: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, selectedForPrint: !inv.selectedForPrint } : inv
      )
    );
  };

  // Toggle selection for ALL invoices
  const handleToggleSelectAll = (select: boolean) => {
    setInvoices((prev) =>
      prev.map((inv) => ({ ...inv, selectedForPrint: select }))
    );
  };

  // Add new parsed invoices
  const handleAddInvoices = (newInvoices: InvoiceData[]) => {
    setInvoices((prev) => {
      const updated = [...newInvoices, ...prev];
      if (systemSettings.autoSaveInvoices) {
        try {
          localStorage.setItem("invoice_ledger_data_v1", JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  // Add custom manual blank invoice
  const handleAddCustomInvoice = () => {
    const newInv: InvoiceData = {
      id: `manual-invoice-${Date.now()}`,
      invoiceType: "增值税普通发票（纸质）",
      invoiceCode: "",
      invoiceNumber: String(Math.floor(Math.random() * 89999999 + 10000000)),
      issueDate: new Date().toISOString().split("T")[0],
      buyerName: systemSettings.defaultCompany || "个人",
      buyerTaxId: "",
      sellerName: "新建销售商户",
      sellerTaxId: "",
      totalAmountWithoutTax: 94.34,
      totalTaxAmount: 5.66,
      totalAmountWithTax: 100.0,
      totalAmountWithTaxCN: "壹佰圆整",
      category: "办公用品",
      items: [],
      remarks: "手动新建补录发票",
      selectedForPrint: true,
    };
    setInvoices((prev) => [newInv, ...prev]);
    setEditingInvoice(newInv);
  };

  // Update existing invoice
  const handleSaveInvoice = (updated: InvoiceData) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updated.id ? updated : inv))
    );
    setEditingInvoice(null);
  };

  // Delete invoice
  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => {
      const filtered = prev.filter((inv) => inv.id !== id);
      if (systemSettings.autoSaveInvoices) {
        try {
          localStorage.setItem("invoice_ledger_data_v1", JSON.stringify(filtered));
        } catch {}
      }
      return filtered;
    });
  };

  // Load sample invoices
  const handleLoadSamples = () => {
    setInvoices(SAMPLE_INVOICES);
  };

  // Config change handler
  const handleConfigChange = (newPartial: Partial<PrintConfig>) => {
    setPrintConfig((prev) => {
      const nextConfig = { ...prev, ...newPartial };

      if (newPartial.gridMode === "4" && !newPartial.orientation) {
        nextConfig.orientation = "landscape";
      } else if (
        (newPartial.gridMode === "1" || newPartial.gridMode === "2") &&
        !newPartial.orientation
      ) {
        nextConfig.orientation = "portrait";
      }

      return nextConfig;
    });
  };

  // Selected invoices array for preview & cover
  const selectedInvoices = useMemo(
    () => invoices.filter((inv) => inv.selectedForPrint),
    [invoices]
  );

  // Stats calculation
  const totalAmount = useMemo(
    () => selectedInvoices.reduce((sum, inv) => sum + inv.totalAmountWithTax, 0),
    [selectedInvoices]
  );

  const duplicateCount = useMemo(() => {
    const numCounts: Record<string, number> = {};
    invoices.forEach((i) => {
      const numStr = (i.invoiceNumber || "").trim();
      if (numStr) numCounts[numStr] = (numCounts[numStr] || 0) + 1;
    });
    return Object.values(numCounts).filter((c) => c > 1).length;
  }, [invoices]);

  const itemsPerPage =
    printConfig.gridMode === "1"
      ? 1
      : printConfig.gridMode === "2"
      ? 2
      : printConfig.gridMode === "4"
      ? 4
      : 2;

  const totalPages = Math.ceil(selectedInvoices.length / itemsPerPage) || 1;

  // Export Excel
  const handleExportExcel = () => {
    exportInvoicesToExcel(invoices, systemSettings);
  };

  // Export & Print High-Precision Vector PDF Engine
  const handleExportPdf = async () => {
    setActiveTab("layout");
    setTimeout(async () => {
      const mainEl = document.querySelector<HTMLElement>("main");
      if (mainEl) {
        await generateAndPrintPdf(mainEl);
      }
    }, 200);
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-red-100 selection:text-red-900 ${
        theme === "dark" ? "bg-slate-950 text-slate-100 dark" : "bg-slate-100/80 text-slate-900"
      }`}
    >
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenBatchImport={() => setIsImportModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onLoadSamples={handleLoadSamples}
        onPrint={() => {
          setActiveTab("layout");
          setTimeout(() => {
            window.print();
          }, 120);
        }}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
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
              setPrintConfig((p) => ({ ...p, sortBy: "category" }))
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
            showCropLines={printConfig.showCropLines}
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
