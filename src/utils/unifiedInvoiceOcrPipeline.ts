import { InvoiceData, SystemSettings } from "../types";
import { parseInvoiceTextWithRules, ParsedInvoiceResult } from "./localPdfInvoiceOcr";
import { convertPdfToImageDataUrl, extractTextFromPdf } from "./pdfToImage";
import { scanInvoiceQrCodeFromBase64, QrInvoiceResult } from "./qrInvoiceOcr";
import { numberToRMB } from "./numberToRMB";
import { recognizeImageTextWithTesseract } from "./imageOcr";

export interface UnifiedOcrResult {
  invoice: InvoiceData;
  engineUsed: string;
  qrScanned: boolean;
  confidence: "high" | "medium" | "low";
}

/**
 * 完整四层降级发票识别主算法 (Unified Invoice Recognition Master Pipeline)
 * 1. 尝试毫秒级二维码防伪解码 (jsQR)
 * 2. 尝试本地 PDF 矢量文本抽取 + 中文财税规则引擎 (pdfjs-dist)
 * 3. 尝试后端云端 API (Gemini AI / 百度发票 OCR)
 * 4. 本地全离线防错兜底解构
 */
export async function processInvoiceFileUnified(
  fileBase64: string,
  mimeType: string,
  fileName: string,
  index: number = 0,
  settings?: SystemSettings
): Promise<UnifiedOcrResult> {
  const isPdf =
    mimeType.includes("pdf") ||
    fileName.toLowerCase().endsWith(".pdf") ||
    fileBase64.startsWith("data:application/pdf");

  // 核心优化：【Step 1 强优先】毫秒级发票防伪二维码直接扫码解构
  let previewFileUrl = fileBase64;
  if (isPdf) {
    try {
      previewFileUrl = await convertPdfToImageDataUrl(fileBase64);
    } catch (e) {
      console.warn("PDF render preview info:", e);
    }
  }

  // 1. 强优先：首先使用 jsQR 直接读取发票二维码（包含国家税务局权威定额数据）
  let qrData: QrInvoiceResult | null = null;
  try {
    qrData = await scanInvoiceQrCodeFromBase64(previewFileUrl);
  } catch (qrErr) {
    console.warn("QR code scan info:", qrErr);
  }

  // 2. 提取 PDF 矢量文本
  let extractedPdfText = "";
  if (isPdf) {
    try {
      extractedPdfText = await extractTextFromPdf(fileBase64);
    } catch (e) {
      console.warn("PDF extract text info:", e);
    }
  }

  // 3. 强化：如果矢量文本不足或为空（如图片收据、扫描版火车票），自动触发离线图像 OCR
  if (!extractedPdfText || extractedPdfText.trim().length < 40) {
    try {
      const ocrText = await recognizeImageTextWithTesseract(previewFileUrl || fileBase64);
      if (ocrText) {
        extractedPdfText = (extractedPdfText + "\n" + ocrText).trim();
      }
    } catch (e) {
      console.warn("Image OCR info:", e);
    }
  }

  // Step 3: 尝试调用后端 /api/parse-invoice 服务 (支持 AI 大模型 / 百度云)
  const apiEndpoint = typeof window !== "undefined" && window.location.protocol.startsWith("http")
    ? "/api/parse-invoice"
    : "http://127.0.0.1:3000/api/parse-invoice";

  let serverResult: any = null;
  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileBase64,
        mimeType,
        fileName,
        extractedText: extractedPdfText,
        aiApiKey: settings?.aiApiKey,
        baiduApiKey: settings?.baiduApiKey,
        baiduSecretKey: settings?.baiduSecretKey,
      }),
    });
    serverResult = await response.json();
  } catch (fetchErr) {
    console.warn("Fetch backend API failed, fallback to pure client OCR:", fetchErr);
  }

  // Step 4: 整合四层引擎提取到的字段，融合补全
  const rawData: Partial<ParsedInvoiceResult> = serverResult?.success && serverResult.data
    ? serverResult.data
    : parseInvoiceTextWithRules(extractedPdfText || fileName, fileName);

  let totalAmt = Number(rawData.totalAmountWithTax || 0);

  // 如果二维码解构成功，优先采用二维码中的防伪精准金额与日期
  let qrScanned = false;
  if (qrData && qrData.totalAmountWithTax && qrData.totalAmountWithTax > 0) {
    totalAmt = qrData.totalAmountWithTax;
    qrScanned = true;
  }

  // 判定最终使用的引擎标签
  let engineUsed = "【本地PDF离线解析】";
  if (qrScanned) {
    engineUsed = "【二维码扫码解构】";
  } else if (serverResult?.engine === "gemini_ai") {
    engineUsed = "【Gemini AI大模型】";
  } else if (serverResult?.engine === "baidu_ocr") {
    engineUsed = "【百度云发票OCR】";
  }

  const finalInvoice: InvoiceData = {
    id: `inv-uploaded-${Date.now()}-${index}`,
    invoiceType: rawData.invoiceType || "电子发票(普通发票)",
    invoiceCode: qrData?.invoiceCode || rawData.invoiceCode || "",
    invoiceNumber: qrData?.invoiceNumber || rawData.invoiceNumber || String(Math.floor(Math.random() * 89999999 + 10000000)),
    issueDate: qrData?.issueDate || rawData.issueDate || new Date().toISOString().split("T")[0],
    checkCode: qrData?.checksum || rawData.checkCode || "",
    buyerName: rawData.buyerName || settings?.defaultCompany || "个人",
    buyerTaxId: rawData.buyerTaxId || "",
    sellerName: rawData.sellerName || "示例服务提供商",
    sellerTaxId: rawData.sellerTaxId || "",
    totalAmountWithoutTax: Number(qrData?.totalAmountWithoutTax || rawData.totalAmountWithoutTax || totalAmt * 0.94),
    totalTaxAmount: Number(qrData?.totalTaxAmount || rawData.totalTaxAmount || totalAmt * 0.06),
    totalAmountWithTax: totalAmt,
    totalAmountWithTaxCN: rawData.totalAmountWithTaxCN || numberToRMB(totalAmt),
    category: (rawData.category as any) || "其他",
    remarks: rawData.remarks || fileName,
    drawer: rawData.drawer || "",
    passengerName: rawData.passengerName,
    passengerId: rawData.passengerId,
    trainRoute: rawData.trainRoute,
    items: Array.isArray(rawData.items) && rawData.items.length > 0
      ? rawData.items.map((it: any, idx: number) => ({
          id: it.id || `item-${Date.now()}-${idx + 1}`,
          name: it.name || rawData.remarks || fileName,
          amount: Number(it.amount || totalAmt),
          quantity: Number(it.quantity || 1),
          spec: it.spec,
          unit: it.unit,
          price: it.price ? Number(it.price) : undefined,
          taxRate: it.taxRate,
          taxAmount: it.taxAmount ? Number(it.taxAmount) : undefined,
        }))
      : [
          {
            id: `item-${Date.now()}-1`,
            name: rawData.remarks || fileName,
            amount: totalAmt,
            quantity: 1,
          },
        ],
    fileUrl: previewFileUrl,
    fileName,
    selectedForPrint: true,
    importTime: new Date().toLocaleString("zh-CN", { hour12: false }),
  };

  const confidence: UnifiedOcrResult["confidence"] = qrScanned || (isPdf && totalAmt > 0) ? "high" : totalAmt > 0 ? "medium" : "low";

  return {
    invoice: finalInvoice,
    engineUsed,
    qrScanned,
    confidence,
  };
}
