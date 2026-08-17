import jsQR from "jsqr";
import { ParsedInvoiceResult } from "./localPdfInvoiceOcr";
import { numberToRMB } from "./numberToRMB";

export interface QrInvoiceResult {
  invoiceCode?: string;
  invoiceNumber?: string;
  totalAmountWithoutTax?: number;
  totalTaxAmount?: number;
  totalAmountWithTax?: number;
  issueDate?: string;
  checksum?: string;
  rawQrText: string;
}

/**
 * 解析中国标准发票二维码文本
 * 格式: 01,10,发票代码,发票号码,不含税金额,开票日期,校验码,税额
 */
export function parseInvoiceQrString(qrText: string): QrInvoiceResult | null {
  if (!qrText || typeof qrText !== "string") return null;

  const cleanText = qrText.trim();
  const parts = cleanText.split(",");

  // 1. 标准 8 字段防伪发票二维码 (01,10,代码,号码,不含税金额,日期,校验码,税额)
  if (parts.length >= 6 && (parts[0] === "01" || parts[0] === "02" || parts[0] === "03" || parts[0] === "04")) {
    const invoiceCode = parts[2] || "";
    const invoiceNumber = parts[3] || "";
    const withoutTax = parseFloat(parts[4]) || 0;
    const rawDate = parts[5] || "";
    let issueDate = "";
    if (rawDate.length === 8 && /^\d{8}$/.test(rawDate)) {
      issueDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    }

    const checksum = parts[6] || "";
    const taxAmount = parts[7] ? parseFloat(parts[7]) || 0 : 0;
    const totalAmountWithTax = Math.round((withoutTax + taxAmount) * 100) / 100;

    return {
      invoiceCode,
      invoiceNumber,
      totalAmountWithoutTax: withoutTax,
      totalTaxAmount: taxAmount,
      totalAmountWithTax: totalAmountWithTax > 0 ? totalAmountWithTax : withoutTax,
      issueDate,
      checksum,
      rawQrText: cleanText,
    };
  }

  // 2. 如果包含数值和日期
  const numMatches = cleanText.match(/\d+/g);
  if (numMatches && numMatches.length >= 3) {
    const possibleInvoiceNum = numMatches.find((n) => n.length === 20 || n.length === 8 || n.length === 10);
    const possibleDate = numMatches.find((n) => n.length === 8 && (n.startsWith("202") || n.startsWith("201")));
    let issueDate = "";
    if (possibleDate) {
      issueDate = `${possibleDate.slice(0, 4)}-${possibleDate.slice(4, 6)}-${possibleDate.slice(6, 8)}`;
    }

    return {
      invoiceNumber: possibleInvoiceNum,
      issueDate,
      rawQrText: cleanText,
    };
  }

  return null;
}

/**
 * 从 HTML Canvas 图像或 Base64 识别发票二维码
 */
export async function scanInvoiceQrCodeFromImageData(
  canvas: HTMLCanvasElement
): Promise<QrInvoiceResult | null> {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 尝试 1: 全图扫码 (支持正向与反色防伪二维码)
    const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let code = jsQR(fullImageData.data, fullImageData.width, fullImageData.height, {
      inversionAttempts: "attemptBoth",
    });

    if (code && code.data) {
      const parsed = parseInvoiceQrString(code.data);
      if (parsed) return parsed;
    }

    // 尝试 2: 发票右上角专属区域 (Top-Right 50% x 50%) 强聚焦扫描 (国家标准发票二维码印刷位置)
    const cropW = Math.floor(canvas.width * 0.5);
    const cropH = Math.floor(canvas.height * 0.5);
    const cropX = canvas.width - cropW;
    const cropY = 0;
    const topRightImageData = ctx.getImageData(cropX, cropY, cropW, cropH);

    code = jsQR(topRightImageData.data, topRightImageData.width, topRightImageData.height, {
      inversionAttempts: "attemptBoth",
    });

    if (code && code.data) {
      const parsed = parseInvoiceQrString(code.data);
      if (parsed) return parsed;
    }
  } catch (err) {
    console.warn("QR code scan error:", err);
  }
  return null;
}

/**
 * 将 Base64 图像加载为 Canvas 并执行二维码识别
 */
export async function scanInvoiceQrCodeFromBase64(
  base64Url: string
): Promise<QrInvoiceResult | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const qrResult = await scanInvoiceQrCodeFromImageData(canvas);
          resolve(qrResult);
          return;
        }
      } catch (e) {
        console.warn("QR canvas scan failed:", e);
      }
      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = base64Url;
  });
}
