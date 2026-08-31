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
import { exportInvoicesToExcel, getLastExportInfoAsync, LastExportInfo } from "./utils/exportExcel";
import { ExcelExportDialog } from "./components/ExcelExportDialog";
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
  // 1. 所有 useState Hooks 统一在最顶层声明（避免 React Hook 顺序错乱异常）
  const [activeTab, setActiveTab] = useState<"layout" | "ledger" | "cover">("layout");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [zoom, setZoom] = useState<number>(0.9);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);
  const [isTopNavExportDialogOpen, setIsTopNavExportDialogOpen] = useState(false);
  const [topNavLastExportInfo, setTopNavLastExportInfo] = useState<LastExportInfo | null>(null);

  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    gridMode: "4",
    paperType: "A4",
    orientation: "landscape", // 4张/页 (2×2 横向) 默认锁定为横向 (Landscape)
    showCropLines: true,
    showCategoryBadge: true,
    marginSize: "normal",
    sortBy: "date_asc", // 默认排序：按开票时间 (升序)
    includeCoverPage: false,
    grayscale: false,
  });

  // 2. 核心状态：系统设置 & 发票台账列表
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem("system_settings_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
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

  // 3. 发票列表状态：开机加载本地台账数据，排版勾选状态默认重置为 false（启动时保持干净的排版就绪状态，台账数据 100% 完整保留）
  const [invoices, setInvoices] = useState<InvoiceData[]>(() => {
    try {
      const saved = localStorage.getItem("saved_invoices_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((inv) => ({
            ...inv,
            selectedForPrint: false, // 每次重新打开软件时，默认不勾选任何旧发票，保持排版区干净
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // 自动将发票台账数据持久化存入本地，保证数据永久保存
  useEffect(() => {
    try {
      localStorage.setItem("saved_invoices_v1", JSON.stringify(invoices));
    } catch {}
  }, [invoices]);

  // 自动将系统设置（密码、企业默认抬头等）持久化到本地
  useEffect(() => {
    try {
      localStorage.setItem("system_settings_v1", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // 自动将皮肤与设置持久化到本地
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

  // 更新排版参数 (4张/页 自动绑定横向 Landscape，1/2张/页 自动绑定纵向 Portrait)
  const handleUpdateConfig = (newCfg: Partial<PrintConfig>) => {
    setPrintConfig((prev) => {
      const next = { ...prev, ...newCfg };
      if (newCfg.gridMode === "4") {
        next.orientation = "landscape";
      } else if (newCfg.gridMode === "2" || newCfg.gridMode === "1") {
        next.orientation = "portrait";
      }
      return next;
    });
  };

  // 切换暗黑/白天模式
  const handleToggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };

  // 批量导入与台账操作：新导入的发票自动选中以方便直接排版，并标记为未导出
  const handleAddInvoices = (newInvs: InvoiceData[]) => {
    const markedInvs = newInvs.map((inv) => ({ ...inv, selectedForPrint: true, exported: false }));
    setInvoices((prev) => [...markedInvs, ...prev]);
  };

  const handleExportSuccess = (exportedIds: string[]) => {
    setInvoices((prev) =>
      prev.map((inv) => (exportedIds.includes(inv.id) ? { ...inv, exported: true } : inv))
    );
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
    const counts: Record<string, number> = {};
    invoices.forEach((i) => {
      const numStr = (i.invoiceNumber || "").trim();
      const checkStr = (i.checkCode || "").trim();
      const amtStr = Number((i.totalAmountWithTax || 0).toFixed(2)).toString();
      if (numStr) {
        const key = checkStr ? `${numStr}_${checkStr}_${amtStr}` : `${numStr}_${amtStr}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.values(counts)
      .filter((c) => c > 1)
      .reduce((sum, c) => sum + c, 0);
  }, [invoices]);

  const itemsPerPage = parseInt(printConfig.gridMode, 10) || 4;
  const totalPages = useMemo(() => {
    if (printConfig.sortBy === "category") {
      // 按票种分类时，每个分类独立分页，总页数 = 各分类页数之和
      const grouped: Record<string, number> = {};
      selectedInvoices.forEach((inv) => {
        const cat = inv.category || "其他";
        grouped[cat] = (grouped[cat] || 0) + 1;
      });
      return Object.values(grouped).reduce(
        (sum, count) => sum + Math.ceil(count / itemsPerPage),
        0
      ) || 1;
    }
    return Math.ceil(selectedInvoices.length / itemsPerPage) || 1;
  }, [selectedInvoices, itemsPerPage, printConfig.sortBy]);

  const handleTopNavExportExcel = async () => {
    const historicalInfo = await getLastExportInfoAsync();
    if (!historicalInfo) {
      exportInvoicesToExcel(invoices, settings, "default", undefined, handleExportSuccess);
    } else {
      setTopNavLastExportInfo(historicalInfo);
      setIsTopNavExportDialogOpen(true);
    }
  };

  // 调起 100% 所见即所得高清 PDF 打印与导出
  const handlePrint = async () => {
    if (activeTab === "layout" || activeTab === "cover") {
      await generateAndPrintPdf(document.body, undefined, undefined, !!printConfig.grayscale);
    } else {
      setActiveTab("layout");
      setTimeout(async () => {
        await generateAndPrintPdf(document.body, undefined, undefined, !!printConfig.grayscale);
      }, 400);
    }
  };

  // 独立打印报销封面单：切到 cover Tab 后调起高清所见即所得打印
  const handlePrintCover = async () => {
    if (activeTab === "cover") {
      await generateAndPrintPdf(document.body, undefined, undefined, !!printConfig.grayscale);
    } else {
      setActiveTab("cover");
      setTimeout(async () => {
        await generateAndPrintPdf(document.body, undefined, undefined, !!printConfig.grayscale);
      }, 400);
    }
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
        onExportExcel={handleTopNavExportExcel}
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
            onResetOrder={() => handleUpdateConfig({ sortBy: "date_asc" })}
          />
          <main className={`flex-1 overflow-auto transition-colors ${theme === "dark" ? "bg-[#0A0F1D]" : "bg-[#F1F5F9]"}`}>
            {printConfig.includeCoverPage && selectedInvoices.length > 0 && (
              <div className="a4-print-cover-wrapper pt-6 print:pt-0 print:m-0 print:p-0">
                <ReimbursementCover
                  selectedInvoices={selectedInvoices}
                  invoices={invoices}
                  settings={settings}
                  defaultSettings={settings}
                  config={printConfig}
                  theme={theme}
                  onOpenBatchImport={() => setIsImportOpen(true)}
                  onPrintCover={handlePrintCover}
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
              onDeleteInvoice={handleToggleSelectForPrint}
              onOpenBatchImport={() => setIsImportOpen(true)}
            />
          </main>
        </>
      )}

      {activeTab === "ledger" && (
        <main className={`flex-1 overflow-auto py-4 transition-colors ${theme === "dark" ? "bg-[#0A0F1D]" : "bg-[#F1F5F9]"}`}>
          <InvoiceLedgerTable
            invoices={invoices}
            systemSettings={settings}
            theme={theme}
            onToggleSelectForPrint={handleToggleSelectForPrint}
            onToggleSelectAll={handleToggleSelectAll}
            onDeleteInvoice={handleDeleteInvoice}
            onEditInvoice={(inv) => setEditingInvoice(inv)}
            onExportSuccess={handleExportSuccess}
            onManualCreate={() => {
              const newInv: InvoiceData = {
                id: `custom-${Date.now()}`,
                invoiceType: "电子发票(普通发票)",
                invoiceNumber: String(Math.floor(Math.random() * 89999999 + 10000000)),
                issueDate: new Date().toISOString().split("T")[0],
                buyerName: settings.defaultCompany || "示例单位名称",
                sellerName: "新建手工发票商户",
                totalAmountWithoutTax: 94.34,
                totalTaxAmount: 5.66,
                totalAmountWithTax: 100,
                totalAmountWithTaxCN: "壹佰元整",
                category: "其他",
                selectedForPrint: true,
                items: [],
              };
              // 仅打开编辑草稿弹窗，不提前将未提交的发票写入台账
              setEditingInvoice(newInv);
            }}
          />
        </main>
      )}

      {activeTab === "cover" && (
        <main className={`flex-1 overflow-auto py-4 transition-colors ${theme === "dark" ? "bg-[#0A0F1D]" : "bg-[#F1F5F9]"}`}>
          <ReimbursementCover
            selectedInvoices={selectedInvoices}
            invoices={invoices}
            settings={settings}
            defaultSettings={settings}
            config={printConfig}
            theme={theme}
            onOpenBatchImport={() => setIsImportOpen(true)}
            onPrintCover={handlePrintCover}
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
          // 仅在用户明确点击【保存】按钮时，才真正插入或更新台账发票
          setInvoices((prev) => {
            const exists = prev.some((i) => i.id === updated.id);
            if (exists) {
              return prev.map((i) => (i.id === updated.id ? updated : i));
            }
            return [updated, ...prev];
          });
          setEditingInvoice(null);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          try {
            localStorage.setItem("system_settings_v1", JSON.stringify(newSettings));
          } catch {}
        }}
        invoices={invoices}
        onImportInvoicesJson={(imported) => setInvoices(imported)}
        theme={theme}
        onClearSavedInvoices={() => {
          setInvoices([]);
          localStorage.removeItem("invoice_app_data");
        }}
      />

      <ExcelExportDialog
        isOpen={isTopNavExportDialogOpen}
        onClose={() => setIsTopNavExportDialogOpen(false)}
        lastExportInfo={topNavLastExportInfo}
        currentCount={invoices.length}
        unexportedCount={invoices.filter((i) => !i.exported).length}
        onAppendToExisting={() => exportInvoicesToExcel(invoices, settings, "append", undefined, handleExportSuccess)}
        onSaveNewFile={() => exportInvoicesToExcel(invoices, settings, "new", undefined, handleExportSuccess)}
      />
    </div>
  );
};

export default App;
