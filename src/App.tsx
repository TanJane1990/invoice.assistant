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
  defaultCompany: "北京云启智创科技有限公司",
  defaultDepartment: "研发部",
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
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return (localStorage.getItem("app_theme_v1") as "light" | "dark") || "light";
    } catch {
      return "light";
    }
  });
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
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [invoices, setInvoices] = useState<InvoiceData[]>(() => {
    const saved = localStorage.getItem("invoice_app_data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
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

  // 自动将皮肤与发票数据持久化到本地
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

  useEffect(() => {
    if (settings.autoSaveInvoices) {
      try {
        localStorage.setItem("invoice_app_data", JSON.stringify(invoices));
        localStorage.setItem("system_settings_v1", JSON.stringify(settings));
      } catch (e) {
        console.warn("Save failed:", e);
      }
    }
  }, [invoices, settings]);

  // 更新排版参数
  const handleUpdateConfig = (newCfg: Partial<PrintConfig>) => {
    setPrintConfig((prev) => ({ ...prev, ...newCfg }));
  };

  // 切换暗黑/白天模式
  const handleToggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };

  // 批量导入与台账操作
  const handleAddInvoices = (newInvs: InvoiceData[]) => {
    setInvoices((prev) => [...newInvs, ...prev]);
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  const handleToggleSelectForPrint = (id: string) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, selectedForPrint: !inv.selectedForPrint } : inv))
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setInvoices((prev) => prev.map((inv) => ({ ...inv, selectedForPrint: select })));
  };

  // 计算排版所需的全局选中发票与合计
  const selectedInvoices = useMemo(
    () => invoices.filter((i) => i.selectedForPrint),
    [invoices]
  );

  const totalAmount = useMemo(
    () => selectedInvoices.reduce((sum, i) => sum + i.totalAmountWithTax, 0),
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

  const itemsPerPage = parseInt(printConfig.gridMode, 10) || 4;
  const totalPages = Math.ceil(selectedInvoices.length / itemsPerPage) || 1;

  // 高精矢量防错打印
  const handlePrint = async () => {
    setActiveTab("layout");
    setTimeout(async () => {
      const mainEl = document.querySelector<HTMLElement>("main");
      if (mainEl) {
        await generateAndPrintPdf(mainEl);
      } else {
        window.print();
      }
    }, 200);
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors ${
        theme === "dark" ? "dark bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
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
        onExportExcel={() => exportInvoicesToExcel(invoices, settings)}
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
            totalPages={totalPages}
            totalAmount={totalAmount}
            onResetOrder={() => handleUpdateConfig({ sortBy: "category" })}
          />
          <main className={`flex-1 overflow-auto transition-colors ${theme === "dark" ? "bg-slate-950" : "bg-slate-100"}`}>
            {printConfig.includeCoverPage && selectedInvoices.length > 0 && (
              <div className="pt-6">
                <ReimbursementCover
                  invoices={invoices}
                  defaultSettings={settings}
                  config={printConfig}
                  theme={theme}
                  onOpenBatchImport={() => setIsImportOpen(true)}
                />
              </div>
            )}
            <A4PagePreview
              invoices={selectedInvoices}
              config={printConfig}
              zoom={zoom}
              theme={theme}
              showCropLines={printConfig.showCropLines}
              onEditInvoice={(inv) => setEditingInvoice(inv)}
              onDeleteInvoice={handleDeleteInvoice}
              onOpenBatchImport={() => setIsImportOpen(true)}
            />
          </main>
        </>
      )}

      {activeTab === "ledger" && (
        <main className={`flex-1 overflow-auto py-4 transition-colors ${theme === "dark" ? "bg-slate-950" : "bg-slate-100"}`}>
          <InvoiceLedgerTable
            invoices={invoices}
            systemSettings={settings}
            theme={theme}
            onToggleSelectForPrint={handleToggleSelectForPrint}
            onToggleSelectAll={handleToggleSelectAll}
            onDeleteInvoice={handleDeleteInvoice}
            onEditInvoice={(inv) => setEditingInvoice(inv)}
            onAddCustomInvoice={() => {
              const newInv: InvoiceData = {
                id: `custom-${Date.now()}`,
                invoiceType: "电子发票(普通发票)",
                invoiceNumber: String(Math.floor(Math.random() * 89999999 + 10000000)),
                issueDate: new Date().toISOString().split("T")[0],
                buyerName: settings.defaultCompany || "北京云启智创科技有限公司",
                sellerName: "新建手工发票商户",
                totalAmountWithoutTax: 94.34,
                totalTaxAmount: 5.66,
                totalAmountWithTax: 100,
                totalAmountWithTaxCN: "壹佰元整",
                category: "其他",
                selectedForPrint: true,
                items: [],
              };
              setInvoices([newInv, ...invoices]);
              setEditingInvoice(newInv);
            }}
          />
        </main>
      )}

      {activeTab === "cover" && (
        <main className={`flex-1 overflow-auto py-4 transition-colors ${theme === "dark" ? "bg-slate-950" : "bg-slate-100"}`}>
          <ReimbursementCover
            invoices={invoices}
            defaultSettings={settings}
            config={printConfig}
            theme={theme}
            onOpenBatchImport={() => setIsImportOpen(true)}
          />
        </main>
      )}

      {/* 3. 弹窗组件群 */}
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
    </div>
  );
};

export default App;
