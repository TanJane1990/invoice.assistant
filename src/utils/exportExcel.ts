import * as XLSX from "xlsx";
import { InvoiceData, SystemSettings } from "../types";

export const exportInvoicesToExcel = (
  invoices: InvoiceData[],
  settings?: SystemSettings,
  customFilename?: string
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
    导入时间: inv.importTime || new Date().toLocaleString("zh-CN", { hour12: false }),
    购买方名称: inv.buyerName,
    购买方税号: inv.buyerTaxId || "-",
    销售方名称: inv.sellerName,
    销售方税号: inv.sellerTaxId || "-",
    "乘车/出行人": inv.passengerName || "-",
    乘车人证件号: inv.passengerId || "-",
    行程路线: inv.trainRoute || "-",
    不含税金额: inv.totalAmountWithoutTax,
    合计税额: inv.totalTaxAmount,
    "价税合计(元)": inv.totalAmountWithTax,
    价税合计大写: inv.totalAmountWithTaxCN,
    查重告警状态: inv.duplicateWarning ? "重复告警" : "正常唯一",
    防篡改保护: settings?.protectExportedExcel ? "已锁定加密" : "普通导出",
    备注: inv.remarks || "-",
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

  const fileName = customFilename || "发票台账明细表.xlsx";

  XLSX.writeFile(workbook, fileName);

  if (settings?.protectExportedExcel || (settings?.exportPassword && settings.exportPassword.trim() !== "")) {
    const pass = settings.exportPassword && settings.exportPassword.trim() !== "" ? settings.exportPassword.trim() : "123456";
    alert(`成功导出加密 Excel 表格！\n已启用防篡改工作表保护，撤销保护密码为：${pass}`);
  }
};
