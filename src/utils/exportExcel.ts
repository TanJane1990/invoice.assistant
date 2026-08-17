import * as XLSX from "xlsx";
import { InvoiceData, SystemSettings } from "../types";

export interface ExportExcelResult {
  success: boolean;
  totalCount: number;
  totalAmount: number;
  isProtected: boolean;
  password?: string;
  filename: string;
}

export const exportInvoicesToExcel = (
  invoices: InvoiceData[],
  settings?: SystemSettings,
  customFilename?: string,
  onNotify?: (result: ExportExcelResult) => void
): ExportExcelResult | null => {
  if (!invoices || invoices.length === 0) {
    if (onNotify) {
      onNotify({
        success: false,
        totalCount: 0,
        totalAmount: 0,
        isProtected: false,
        filename: "",
      });
    }
    return null;
  }

  const exportData = invoices.map((inv, idx) => ({
    序号: idx + 1,
    开票日期: inv.issueDate,
    发票类型: inv.invoiceType,
    发票代码: inv.invoiceCode || "-",
    发票号码: inv.invoiceNumber,
    校验码: inv.checkCode || "-",
    购买方名称: inv.buyerName,
    购买方税号: inv.buyerTaxId || "-",
    销售方名称: inv.sellerName,
    销售方税号: inv.sellerTaxId || "-",
    不含税金额: inv.totalAmountWithoutTax,
    税率: inv.taxRate || "-",
    税额: inv.totalTaxAmount,
    "价税合计": inv.totalAmountWithTax,
    商品明细: inv.itemsSummary || inv.remarks || "-",
    备注: inv.remarks || "-",
    导入时间: inv.importTime || new Date().toLocaleString("zh-CN", { hour12: false }),
    文件路径包含: inv.fileName || "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Apply SheetJS Worksheet Protection if configured
  const isProtected = Boolean(
    settings?.protectExportedExcel ||
      (settings?.exportPassword && settings.exportPassword.trim() !== "")
  );
  const password =
    settings?.exportPassword && settings.exportPassword.trim() !== ""
      ? settings.exportPassword.trim()
      : "123456";

  if (isProtected) {
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

  const fileName =
    customFilename ||
    (() => {
      const d = new Date();
      return `发票台账明细表_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}.xlsx`;
    })();

  XLSX.writeFile(workbook, fileName);

  const totalAmount = invoices.reduce((acc, curr) => acc + (curr.totalAmountWithTax || 0), 0);

  const result: ExportExcelResult = {
    success: true,
    totalCount: invoices.length,
    totalAmount,
    isProtected,
    password: isProtected ? password : undefined,
    filename: fileName,
  };

  if (onNotify) {
    onNotify(result);
  }

  return result;
};
