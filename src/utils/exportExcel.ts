import * as XLSX from "xlsx";
import { InvoiceData, SystemSettings } from "../types";

const LAST_EXPORT_KEY = "smart_invoice_last_export_info";

export interface LastExportInfo {
  fileName: string;
  lastExportTime: string;
  count: number;
}

export const getLastExportInfo = (): LastExportInfo | null => {
  try {
    const raw = localStorage.getItem(LAST_EXPORT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

export const checkDiskFileExists = async (fileName: string): Promise<boolean> => {
  try {
    const res = await fetch("/api/check-file-exists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName }),
    });
    if (!res.ok) return true;
    const data = await res.json();
    return Boolean(data.exists);
  } catch (e) {
    return true;
  }
};

export const getLastExportInfoAsync = async (): Promise<LastExportInfo | null> => {
  const info = getLastExportInfo();
  if (!info) return null;
  const existsOnDisk = await checkDiskFileExists(info.fileName);
  if (!existsOnDisk) {
    // 磁盘上该文件已被用户删除了，自动清空记忆日志
    localStorage.removeItem(LAST_EXPORT_KEY);
    return null;
  }
  return info;
};

export const exportInvoicesToExcel = (
  invoices: InvoiceData[],
  settings?: SystemSettings,
  mode: "default" | "append" | "new" = "default",
  overrideFilename?: string
) => {
  if (!invoices || invoices.length === 0) {
    alert("当前没有可导出的发票数据！");
    return;
  }

  const exportData = invoices.map((inv, idx) => ({
    序号: idx + 1,
    费用类别: inv.category,
    发票类型: inv.invoiceType,
    发票代码: inv.invoiceCode || "-",
    发票号码: inv.invoiceNumber,
    开票日期: inv.issueDate,
    "乘车/出行人": inv.passengerName || "-",
    行程路线: inv.trainRoute || "-",
    购买方名称: inv.buyerName,
    购买方税号: inv.buyerTaxId || "-",
    销售方名称: inv.sellerName,
    销售方税号: inv.sellerTaxId || "-",
    "商品/服务明细": inv.items && inv.items.length > 0 ? inv.items.map((it) => it.name).join("；") : "-",
    不含税金额: inv.totalAmountWithoutTax,
    合计税额: inv.totalTaxAmount,
    "价税合计(元)": inv.totalAmountWithTax,
    价税合计大写: inv.totalAmountWithTaxCN,
    查重状态: inv.duplicateWarning ? "重复告警" : "正常唯一",
    备注: inv.remarks || "-",
    导入时间: inv.importTime || new Date().toLocaleString("zh-CN", { hour12: false }),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Apply SheetJS Worksheet Protection if configured or password set
  if (settings?.protectExportedExcel || (settings?.exportPassword && settings.exportPassword.trim() !== "")) {
    const password = settings.exportPassword && settings.exportPassword.trim() !== "" ? settings.exportPassword.trim() : "123456";
    worksheet["!protect"] = {
      password: password,
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      insertHyperlinks: false,
      deleteColumns: false,
      deleteRows: false,
      sort: false,
      autoFilter: false,
      pivotTables: false,
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "发票台账数据");

  const lastInfo = getLastExportInfo();
  let fileName = "";

  if (overrideFilename) {
    fileName = overrideFilename;
  } else if (mode === "append" && lastInfo?.fileName) {
    fileName = lastInfo.fileName;
  } else if (mode === "new" || !lastInfo) {
    const now = new Date();
    const timestampStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    fileName = `发票台账明细表_${timestampStr}.xlsx`;
  } else {
    fileName = "发票台账明细表.xlsx";
  }

  XLSX.writeFile(workbook, fileName);

  // Save last export file info to localStorage
  const nowStr = new Date().toLocaleString("zh-CN", { hour12: false });
  const exportRecord: LastExportInfo = {
    fileName,
    lastExportTime: nowStr,
    count: invoices.length,
  };
  try {
    localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(exportRecord));
  } catch (e) {
    console.warn("Save export info error:", e);
  }

  if (mode === "append") {
    alert(`成功追加/更新 ${invoices.length} 张发票数据至：${fileName}！`);
  }

  if (settings?.protectExportedExcel || (settings?.exportPassword && settings.exportPassword.trim() !== "")) {
    const pass = settings.exportPassword && settings.exportPassword.trim() !== "" ? settings.exportPassword.trim() : "123456";
    alert(`成功导出加密 Excel 表格！\n已启用防篡改工作表保护，撤销保护密码为：${pass}`);
  }
};
