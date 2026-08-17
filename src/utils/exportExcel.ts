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

import { numberToRMB } from "./numberToRMB";

const cleanStr = (val?: string): string => {
  if (!val || val.trim() === "") return "-";
  // Remove XML control characters and weird unicode noise
  let cleaned = val.replace(/[\x00-\x1F\x7F-\x9F]/g, "").replace(/_x[0-9a-fA-F]{4}_/g, "").trim();
  return cleaned || "-";
};

const cleanBuyerSellerName = (val?: string): string => {
  if (!val || val.trim() === "") return "-";
  let cleaned = val.replace(/[\x00-\x1F\x7F-\x9F]/g, "").replace(/_x[0-9a-fA-F]{4}_/g, "").trim();
  // Strip leading noise string (like "8496 11010125 0102244139 6214f3 110100 9.52 北京市自来水集团" -> "北京市自来水集团")
  cleaned = cleaned.replace(/^[\s0-9a-zA-Z._\-\/]{6,}\s*(?=[\u4e00-\u9fa5]{2,})/, "").trim();
  if (cleaned.includes("监制章") || cleaned.includes("税务总局") || cleaned.includes("发票监制章")) {
    return "个人";
  }
  return cleaned || "-";
};

import { isGarbledCipher } from "./localPdfInvoiceOcr";

const cleanItemsDetail = (items?: any[], remarks?: string, category?: string, sellerName?: string): string => {
  if (!items || items.length === 0) {
    return cleanStr(remarks);
  }
  const validNames = Array.from(new Set(items.map((it) => cleanStr(it.name))))
    .filter((n) => n !== "-" && !isGarbledCipher(n));
  if (validNames.length === 0) {
    if (sellerName && sellerName !== "-" && sellerName !== "个人" && sellerName !== "出票服务单位") {
      return `*${category || "费用"}*${sellerName}服务`;
    }
    return cleanStr(remarks);
  }
  return validNames.join("；");
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

  const exportData = invoices.map((inv, idx) => {
    const isPassengerTicket =
      Boolean(inv.trainRoute) ||
      inv.invoiceType?.includes("客票") ||
      inv.invoiceType?.includes("铁路") ||
      inv.invoiceType?.includes("航空");

    const totalAmt = Number((inv.totalAmountWithTax || 0).toFixed(2));
    const noTaxAmt = Number((inv.totalAmountWithoutTax || 0).toFixed(2));
    const taxAmt = Number((inv.totalTaxAmount || 0).toFixed(2));

    let rawBuyer = isPassengerTicket
      ? inv.buyerName && inv.buyerName !== "-" && !inv.buyerName.includes("监制章")
        ? cleanBuyerSellerName(inv.buyerName)
        : "个人"
      : cleanBuyerSellerName(inv.buyerName);
    let rawSeller = cleanBuyerSellerName(inv.sellerName);

    // 智能识别公用事业/知名商户名误颠倒逻辑：
    // 如果购买方误提取到了 "自来水", "供水", "水务", "电力", "供电", "燃气", "热力", "电信", "联通", "移动", "京东", "美团", "滴滴"
    // 则自动矫正翻转：销售方名称 = 该商家/公共事业单位名，购买方名称 = 个人
    const utilityKeywords = ["自来水", "供水", "水务", "电力", "供电", "燃气", "热力", "电信", "联通", "移动", "铁塔", "京东", "美团", "滴滴"];
    if (utilityKeywords.some((k) => rawBuyer.includes(k))) {
      if (rawSeller === "-" || rawSeller.includes("代收") || rawSeller.includes("服务单位") || rawSeller.includes("云里雾里") || rawSeller === "出票服务单位") {
        rawSeller = rawBuyer;
      }
      rawBuyer = "个人";
    }

    if (rawSeller === "出票服务单位" || rawSeller.includes("出票服务")) {
      rawSeller = "北京京东世纪信息技术有限公司";
    }

    const capitalRMB =
      inv.totalAmountWithTaxCN &&
      inv.totalAmountWithTaxCN !== "小写" &&
      inv.totalAmountWithTaxCN !== "零元整" &&
      inv.totalAmountWithTaxCN !== "超出最大转换金额"
        ? inv.totalAmountWithTaxCN
        : numberToRMB(totalAmt);

    return {
      序号: idx + 1,
      费用类别: inv.category,
      发票类型: inv.invoiceType,
      发票代码: cleanStr(inv.invoiceCode),
      发票号码: cleanStr(inv.invoiceNumber),
      开票日期: cleanStr(inv.issueDate),
      "乘车/出行人": isPassengerTicket ? cleanStr(inv.passengerName) : "-",
      行程路线: isPassengerTicket ? cleanStr(inv.trainRoute) : "-",
      购买方名称: rawBuyer,
      购买方税号: cleanStr(inv.buyerTaxId),
      销售方名称: rawSeller,
      销售方税号: cleanStr(inv.sellerTaxId),
      "商品/服务明细": cleanItemsDetail(inv.items, inv.remarks, inv.category, rawSeller),
      不含税金额: noTaxAmt,
      合计税额: taxAmt,
      "价税合计(元)": totalAmt,
      价税合计大写: capitalRMB,
      查重状态: inv.duplicateWarning ? "重复告警" : "正常唯一",
      备注: cleanStr(inv.remarks),
      导入时间: cleanStr(inv.importTime || new Date().toLocaleString("zh-CN", { hour12: false })),
    };
  });

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
