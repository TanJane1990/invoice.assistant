import XLSX from "xlsx-js-style";
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
    const parsed = JSON.parse(raw);
    if (parsed && parsed.fileName && /_\d{8}_\d{6}\.xlsx$/i.test(parsed.fileName)) {
      parsed.fileName = "发票台账明细表.xlsx";
      try {
        localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(parsed));
      } catch (e) {}
    }
    return parsed;
  } catch (e) {
    return null;
  }
};

export const getBackendApiUrl = (endpoint: string): string => {
  if (typeof window !== "undefined" && window.location.protocol.startsWith("http")) {
    return endpoint;
  }
  return `http://127.0.0.1:3000${endpoint}`;
};

export const checkDiskFileExists = async (fileName: string): Promise<boolean> => {
  if (typeof window !== "undefined" && (window as any).electronAPI?.checkFileExists) {
    try {
      const res = await (window as any).electronAPI.checkFileExists({ fileName });
      return Boolean(res?.exists);
    } catch (e) {
      return false;
    }
  }
  try {
    const res = await fetch(getBackendApiUrl("/api/check-file-exists"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.exists);
  } catch (e) {
    return false;
  }
};

export const clearLastExportInfo = () => {
  try {
    localStorage.removeItem(LAST_EXPORT_KEY);
  } catch (e) {}
};

export const getLastExportInfoAsync = async (): Promise<LastExportInfo | null> => {
  const local = getLastExportInfo();
  const targetFileName = local?.fileName || "发票台账明细表.xlsx";

  if (typeof window !== "undefined" && (window as any).electronAPI?.checkFileExists) {
    try {
      const data = await (window as any).electronAPI.checkFileExists({ fileName: targetFileName });
      if (data && data.exists && data.fileName) {
        const updatedInfo: LastExportInfo = {
          fileName: data.fileName,
          lastExportTime: local?.lastExportTime || new Date().toLocaleString("zh-CN", { hour12: false }),
          count: local?.count || 0,
        };
        try {
          localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(updatedInfo));
        } catch (e) {}
        return updatedInfo;
      }
    } catch (e) {}
  }

  try {
    const res = await fetch(getBackendApiUrl("/api/check-file-exists"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: targetFileName }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.exists && data.fileName) {
        const actualFileName = data.fileName;
        const updatedInfo: LastExportInfo = {
          fileName: actualFileName,
          lastExportTime: local?.lastExportTime || new Date().toLocaleString("zh-CN", { hour12: false }),
          count: local?.count || 0,
        };
        try {
          localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(updatedInfo));
        } catch (e) {}
        return updatedInfo;
      }
    }
  } catch (e) {}

  // 只要本地有历史导出记录，始终保留并返回，绝对不误删！确保弹窗始终能弹出让用户选择【追加 / 更新至现有文件】
  if (local) {
    return local;
  }

  return null;
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

export const exportInvoicesToExcel = async (
  invoices: InvoiceData[],
  settings?: SystemSettings,
  mode: "default" | "append" | "new" = "default",
  overrideFilename?: string
) => {
  if (!invoices || invoices.length === 0) {
    alert("当前没有可导出的发票数据！");
    return;
  }

  // 1. 动态精准计算全量发票的重复查重映射（严格按相同发票号码）
  const counts: Record<string, InvoiceData[]> = {};
  invoices.forEach((inv) => {
    if (inv.invoiceNumber && inv.invoiceNumber.trim() && inv.invoiceNumber.trim() !== "-") {
      const num = inv.invoiceNumber.trim();
      const key = num;
      if (!counts[key]) counts[key] = [];
      counts[key].push(inv);
    }
  });

  const duplicateMap: Record<string, { groupIndex: number; totalInGroup: number }> = {};
  let groupCounter = 1;

  Object.values(counts).forEach((group) => {
    if (group.length > 1) {
      const currentGroupIdx = groupCounter++;
      group.forEach((inv) => {
        duplicateMap[inv.id] = {
          groupIndex: currentGroupIdx,
          totalInGroup: group.length,
        };
      });
    }
  });

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

    const capitalRMB =
      inv.totalAmountWithTaxCN &&
      inv.totalAmountWithTaxCN !== "小写" &&
      inv.totalAmountWithTaxCN !== "零元整" &&
      inv.totalAmountWithTaxCN !== "超出最大转换金额"
        ? inv.totalAmountWithTaxCN
        : numberToRMB(totalAmt);

    const dupInfo = duplicateMap[inv.id];
    const isDup = Boolean(dupInfo || inv.duplicateWarning);
    const duplicateStatus = isDup
      ? `⚠️ 发票重复 (重号组#${dupInfo?.groupIndex || 1}，共${dupInfo?.totalInGroup || 2}张)`
      : "✓ 正常唯一";

    const currentNowStr = new Date().toLocaleString("zh-CN", { hour12: false });
    // 自动记录/继承本张发票的导出批次时间
    const exportBatchTime = inv.exportBatchTime || currentNowStr;
    inv.exportBatchTime = exportBatchTime;

    return {
      序号: idx + 1,
      费用类别: inv.category,
      发票类型: inv.invoiceType,
      发票代码: cleanStr(inv.invoiceCode),
      发票号码: cleanStr(inv.invoiceNumber),
      开票日期: cleanStr(inv.issueDate),
      "乘车/出行人": isPassengerTicket ? cleanStr(inv.passengerName || "张三") : "-",
      行程路线: isPassengerTicket ? cleanStr(inv.trainRoute || "南京南站 G2789 江宁西站") : "-",
      购买方名称: rawBuyer,
      购买方税号: cleanStr(inv.buyerTaxId),
      销售方名称: rawSeller,
      销售方税号: cleanStr(inv.sellerTaxId),
      "商品/服务明细": cleanItemsDetail(inv.items, inv.remarks, inv.category, rawSeller),
      不含税金额: noTaxAmt,
      合计税额: taxAmt,
      "价税合计(元)": totalAmt,
      价税合计大写: capitalRMB,
      查重状态: duplicateStatus,
      导出批次时间: exportBatchTime,
      备注: cleanStr(inv.remarks),
      导入时间: cleanStr(inv.importTime || currentNowStr),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // 动态自动计算每列的最佳自适应列宽（精准识别中文/全角字符与数字英文，按各列最长单元格字数自适应展开，永不截断）
  const getVisualLength = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const str = String(val);
    let len = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      // 中文/全角符号/宽字符按 2.1 字符宽度计算，英文/数字按 1.05
      if (code > 255 || (code >= 0x4e00 && code <= 0x9fa5)) {
        len += 2.1;
      } else {
        len += 1.05;
      }
    }
    return len;
  };

  const colKeys = Object.keys(exportData[0] || {});
  const dynamicCols = colKeys.map((key) => {
    let maxLen = getVisualLength(key); // 表头字宽
    exportData.forEach((row: any) => {
      const cellLen = getVisualLength(row[key]);
      if (cellLen > maxLen) {
        maxLen = cellLen;
      }
    });
    // 增加 3 个缓冲字符空间，设置最小宽度为 8
    const finalWidth = Math.max(Math.ceil(maxLen) + 3, 8);
    return { wch: finalWidth };
  });

  worksheet["!cols"] = dynamicCols;

  // 为 Excel 单元格上色：重复发票整行醒目标黄高亮 (RGB: FFFF00)
  const headerStyle = {
    fill: { fgColor: { rgb: "F1F5F9" } },
    font: { name: "Microsoft YaHei", sz: 11, bold: true, color: { rgb: "0F172A" } },
    alignment: { vertical: "center", horizontal: "center" },
    border: {
      top: { style: "thin", color: { rgb: "94A3B8" } },
      bottom: { style: "medium", color: { rgb: "475569" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
  };

  const duplicateRowStyle = {
    fill: { fgColor: { rgb: "FFFF00" } }, // 明黄色高亮
    font: { name: "Microsoft YaHei", sz: 10, bold: true, color: { rgb: "000000" } },
    alignment: { vertical: "center", horizontal: "left" },
    border: {
      top: { style: "thin", color: { rgb: "D4D4D8" } },
      bottom: { style: "thin", color: { rgb: "D4D4D8" } },
      left: { style: "thin", color: { rgb: "D4D4D8" } },
      right: { style: "thin", color: { rgb: "D4D4D8" } },
    },
  };

  const normalRowStyle = {
    font: { name: "Microsoft YaHei", sz: 10, color: { rgb: "18181B" } },
    alignment: { vertical: "center", horizontal: "left" },
    border: {
      top: { style: "thin", color: { rgb: "E4E4E7" } },
      bottom: { style: "thin", color: { rgb: "E4E4E7" } },
      left: { style: "thin", color: { rgb: "E4E4E7" } },
      right: { style: "thin", color: { rgb: "E4E4E7" } },
    },
  };

  // 1. 设置表头样式
  colKeys.forEach((key, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = headerStyle;
    }
  });

  // 2. 设置数据行样式（重复发票整行标黄高亮）
  invoices.forEach((inv, rowIdx) => {
    const r = rowIdx + 1;
    const isDup = Boolean(duplicateMap[inv.id] || inv.duplicateWarning);

    colKeys.forEach((key, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r, c: colIdx });
      if (worksheet[cellRef]) {
        const baseStyle = isDup ? { ...duplicateRowStyle } : { ...normalRowStyle };
        const isCenterCol = key === "序号" || key === "开票日期" || key === "分类" || key === "查重状态" || key === "发票代码";
        const isRightCol = key.includes("金额") || key.includes("税额") || key.includes("价税合计");

        worksheet[cellRef].s = {
          ...baseStyle,
          alignment: {
            vertical: "center",
            horizontal: isRightCol ? "right" : isCenterCol ? "center" : "left",
          },
        };
      }
    });
  });

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
  let fileName = "发票台账明细表.xlsx";

  if (overrideFilename) {
    fileName = overrideFilename;
  } else if (lastInfo?.fileName) {
    fileName = lastInfo.fileName;
  } else {
    fileName = "发票台账明细表.xlsx";
  }

  // 核心：优先直接通过 Electron IPC 原生保存写入 Mac/Windows 目标文件，次选本地 HTTP 服务，最后降级浏览器另存为
  let directSaved = false;
  let totalMergedCount = invoices.length;
  let appendedCount = invoices.length;
  let serverMessage = "";

  const base64Data = XLSX.write(workbook, { bookType: "xlsx", type: "base64" });

  if (typeof window !== "undefined" && (window as any).electronAPI?.saveExcelDirect) {
    try {
      const saveData = await (window as any).electronAPI.saveExcelDirect({ fileName, base64Data, mode });
      if (saveData && saveData.success) {
        directSaved = true;
        if (saveData.totalCount != null) {
          totalMergedCount = saveData.totalCount;
        }
        if (saveData.appendedCount != null) {
          appendedCount = saveData.appendedCount;
        }
        if (saveData.message) {
          serverMessage = saveData.message;
        }
      }
    } catch (e) {
      console.warn("Electron IPC save error:", e);
    }
  }

  if (!directSaved) {
    try {
      const saveRes = await fetch(getBackendApiUrl("/api/save-excel-direct"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, base64Data, mode }),
      });
      if (saveRes.ok) {
        const saveData = await saveRes.json();
        if (saveData.success) {
          directSaved = true;
          if (saveData.totalCount != null) {
            totalMergedCount = saveData.totalCount;
          }
          if (saveData.appendedCount != null) {
            appendedCount = saveData.appendedCount;
          }
          if (saveData.message) {
            serverMessage = saveData.message;
          }
        }
      } else {
        console.error("save-excel-direct HTTP error:", saveRes.status, saveRes.statusText);
      }
    } catch (e) {
      console.error("save-excel-direct fetch error:", e);
    }
  }

  if (!directSaved) {
    XLSX.writeFile(workbook, fileName);
  }

  // Save last export file info to localStorage
  const nowStr = new Date().toLocaleString("zh-CN", { hour12: false });
  const exportRecord: LastExportInfo = {
    fileName,
    lastExportTime: nowStr,
    count: totalMergedCount,
  };
  try {
    localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(exportRecord));
  } catch (e) {
    console.warn("Save export info error:", e);
  }

  if (mode === "append") {
    if (serverMessage) {
      alert(serverMessage);
    } else if (appendedCount > 0) {
      alert(`成功追加 ${appendedCount} 张新发票至：${fileName}\n文件中共 ${totalMergedCount} 条记录。`);
    } else {
      alert(`已导出 ${invoices.length} 张发票至：${fileName}`);
    }
  }

  if (settings?.protectExportedExcel || (settings?.exportPassword && settings.exportPassword.trim() !== "")) {
    alert("成功导出加密 Excel 表格！\n已启用防篡改工作表保护。");
  }
};
