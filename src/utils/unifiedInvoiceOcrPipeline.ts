import { InvoiceData, SystemSettings } from "../types";
import { parseInvoiceTextWithRules, ParsedInvoiceResult, cleanPartyEntityName } from "./localPdfInvoiceOcr";
import { convertPdfToImageDataUrl, extractTextFromPdf } from "./pdfToImage";
import { scanInvoiceQrCodeFromBase64, QrInvoiceResult } from "./qrInvoiceOcr";
import { numberToRMB } from "./numberToRMB";
import { recognizeImageTextWithTesseract } from "./imageOcr";

export const formatCurrentTimestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

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
  try {
    const isPdf =
      mimeType.includes("pdf") ||
      fileName.toLowerCase().endsWith(".pdf") ||
      fileBase64.startsWith("data:application/pdf");

    // 核心优化：【Step 1 强优先】毫秒级发票防伪二维码直接扫码解构
    let previewFileUrl = fileBase64;
    if (isPdf) {
      try {
        const renderTask = convertPdfToImageDataUrl(fileBase64);
        const renderTimeout = new Promise<string>((resolve) => setTimeout(() => resolve(fileBase64), 3000));
        previewFileUrl = await Promise.race([renderTask, renderTimeout]);
      } catch (e) {
        console.warn("PDF render preview info:", e);
      }
    }

    // 1. 强优先：首先使用 jsQR 直接读取发票二维码（包含国家税务局权威定额数据）
    let qrData: QrInvoiceResult | null = null;
    try {
      const qrTask = scanInvoiceQrCodeFromBase64(previewFileUrl);
      const qrTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      qrData = await Promise.race([qrTask, qrTimeout]);
    } catch (qrErr) {
      console.warn("QR code scan info:", qrErr);
    }

    // 2. 提取 PDF 矢量文本
    let extractedPdfText = "";
    if (isPdf) {
      try {
        const pdfTask = extractTextFromPdf(fileBase64);
        const pdfTimeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), 5000));
        extractedPdfText = await Promise.race([pdfTask, pdfTimeout]);
      } catch (e) {
        console.warn("PDF extract text info:", e);
      }
    }

    // 3. 强化：如果矢量文本不足或为空（如图片收据、扫描版火车票），自动触发离线图像 OCR
    if (!extractedPdfText || extractedPdfText.trim().length < 40) {
      try {
        const ocrTask = recognizeImageTextWithTesseract(previewFileUrl || fileBase64);
        const ocrTimeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), 6000));
        const ocrText = await Promise.race([ocrTask, ocrTimeout]);
        if (ocrText) {
          extractedPdfText = (extractedPdfText + "\n" + ocrText).trim();
        }
      } catch (e) {
        console.warn("Image OCR info:", e);
      }
    }

    // Step 3: 仅在纯图片（如 PNG 收据）或客户端未解析出足够内容时，调用 Electron 原生 IPC OCR 引擎
    let serverResult: any = null;
    if ((!isPdf || !extractedPdfText || extractedPdfText.trim().length < 40) && typeof window !== "undefined" && (window as any).electronAPI?.parseInvoiceNative) {
      try {
        const nativeTask = (window as any).electronAPI.parseInvoiceNative({
          fileBase64,
          mimeType,
          fileName,
        });
        const nativeTimeout = new Promise<any>((resolve) => setTimeout(() => resolve(null), 6000));
        const nativeRes = await Promise.race([nativeTask, nativeTimeout]);
        if (nativeRes && nativeRes.success) {
          serverResult = nativeRes;
          if (nativeRes.extractedText) {
            extractedPdfText = (extractedPdfText + "\n" + nativeRes.extractedText).trim();
          }
        }
      } catch (e) {
        console.warn("Electron native parse warning:", e);
      }
    }

    // 如果非 Electron 环境且无服务端结果，尝试调用后端 /api/parse-invoice 服务
    if (!serverResult && (!isPdf || !extractedPdfText || extractedPdfText.trim().length < 40)) {
      const apiEndpoint = typeof window !== "undefined" && window.location.protocol.startsWith("http")
        ? "/api/parse-invoice"
        : "http://127.0.0.1:3000/api/parse-invoice";

      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const fetchTimeoutId = controller ? setTimeout(() => controller.abort(), 3000) : null;

        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller?.signal,
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
        if (fetchTimeoutId) clearTimeout(fetchTimeoutId);
        serverResult = await response.json();
      } catch (fetchErr) {
        console.warn("Fetch backend API failed, fallback to pure client OCR:", fetchErr);
      }
    }

  // Step 4: 整合四层引擎提取到的字段，融合补全（深度保留完整的商品明细与订单号备注）
  const localParsed = parseInvoiceTextWithRules(extractedPdfText || fileName, fileName);
  const serverData = serverResult?.success && serverResult.data ? serverResult.data : {};

  const rawData: Partial<ParsedInvoiceResult> = {
    ...serverData,
    ...localParsed,
  };

  // 优先保留非占位符的真实商品明细
  if (localParsed.items && localParsed.items.length > 0 && !localParsed.items[0].name.includes("物品/服务")) {
    rawData.items = localParsed.items;
  } else if (serverData.items && serverData.items.length > 0 && !serverData.items[0].name.includes("物品/服务")) {
    rawData.items = serverData.items;
  } else {
    rawData.items = localParsed.items || serverData.items;
  }

  // 优先保留包含订单号/乘车行程的真实备注
  if (localParsed.remarks && !localParsed.remarks.endsWith(".pdf") && !localParsed.remarks.endsWith(".png") && localParsed.remarks !== "发票识别") {
    rawData.remarks = localParsed.remarks;
  } else if (serverData.remarks && !serverData.remarks.endsWith(".pdf") && !serverData.remarks.endsWith(".png") && serverData.remarks !== "发票识别") {
    rawData.remarks = serverData.remarks;
  } else {
    rawData.remarks = localParsed.remarks || serverData.remarks || fileName;
  }

  let totalAmt = Number(rawData.totalAmountWithTax || 0);

  // 如果二维码解构成功，优先采用二维码中的防伪精准金额与日期
  let qrScanned = false;
  if (qrData && qrData.totalAmountWithTax && qrData.totalAmountWithTax > 0) {
    totalAmt = qrData.totalAmountWithTax;
    qrScanned = true;
  }

  // 判定最终使用的引擎标签
  let engineUsed = isPdf ? "【本地PDF离线解析】" : "【本地图像增强OCR】";
  if (qrScanned) {
    engineUsed = "【二维码扫码解构】";
  } else if (serverResult?.engine === "gemini_ai") {
    engineUsed = "【Gemini AI大模型】";
  } else if (serverResult?.engine === "baidu_ocr") {
    engineUsed = "【百度云发票OCR】";
  } else if (!isPdf) {
    engineUsed = "【本地图像增强OCR】";
  }

  let taxAmt = qrData?.totalTaxAmount != null ? qrData.totalTaxAmount : Number(rawData.totalTaxAmount || 0);
  let noTaxAmt = qrData?.totalAmountWithoutTax != null ? qrData.totalAmountWithoutTax : Number(rawData.totalAmountWithoutTax || totalAmt);

  if (totalAmt > 0) {
    if (taxAmt > 0 && noTaxAmt > 0 && Math.abs((noTaxAmt + taxAmt) - totalAmt) > 0.05) {
      noTaxAmt = Math.round((totalAmt - taxAmt) * 100) / 100;
    } else if (taxAmt === 0 && noTaxAmt === 0) {
      noTaxAmt = totalAmt;
    }
  }

  const invNum = qrData?.invoiceNumber || rawData.invoiceNumber || "";
  const isTrainTicket =
    invNum.startsWith("26329") ||
    fileName.includes("火车票") ||
    fileName.includes("铁路") ||
    Boolean(rawData.invoiceType?.includes("铁路")) ||
    extractedPdfText.includes("铁路") ||
    extractedPdfText.includes("12306") ||
    extractedPdfText.includes("客票");

  const resolvedInvoiceType = isTrainTicket
    ? "铁路电子客票"
    : rawData.invoiceType || "增值税电子普通发票";

  const resolvedSellerName = isTrainTicket
    ? "中国国家铁路集团有限公司"
    : cleanPartyEntityName(rawData.sellerName || "出票服务单位") || "出票服务单位";

  const resolvedCategory = isTrainTicket
    ? "交通费"
    : (rawData.category as any) || "其他";

  const resolvedPassengerName = rawData.passengerName || undefined;
  const rawRoute = rawData.trainRoute || "";
  const resolvedTrainRoute = isTrainTicket && rawRoute
    ? (rawRoute.includes("站") ? rawRoute : rawRoute.replace(/([^\s-]+)[-至]([^\s]+)\s*([A-Z0-9]+)/, "$1站 $3 $2站"))
    : rawData.trainRoute;

  const departureTime = rawData.trainDepartureTime || "";
  let resolvedRemarks = rawData.remarks || fileName;
  if (isTrainTicket) {
    const passengerPart = rawData.passengerName ? `乘车人:${rawData.passengerName}` : "";
    if (rawData.remarks && rawData.remarks !== fileName && rawData.remarks !== "发票识别") {
      resolvedRemarks = rawData.remarks.includes("乘车人")
        ? rawData.remarks
        : [rawData.remarks, passengerPart].filter(Boolean).join(" ");
    } else if (resolvedTrainRoute && departureTime) {
      resolvedRemarks = [resolvedTrainRoute, passengerPart, departureTime].filter(Boolean).join(" ");
    } else if (resolvedTrainRoute) {
      resolvedRemarks = [resolvedTrainRoute, passengerPart].filter(Boolean).join(" ");
    } else {
      resolvedRemarks = passengerPart ? `铁路电子客票 ${passengerPart}` : "铁路电子客票";
    }
  }

  const resolvedBuyerName =
    rawData.buyerName && rawData.buyerName !== "个人"
      ? cleanPartyEntityName(rawData.buyerName)
      : settings?.defaultCompany && settings.defaultCompany.trim() !== ""
      ? cleanPartyEntityName(settings.defaultCompany.trim())
      : cleanPartyEntityName(rawData.buyerName || "个人") || "个人";

  const finalInvoice: InvoiceData = {
    id: `inv-uploaded-${Date.now()}-${index}`,
    invoiceType: resolvedInvoiceType,
    invoiceCode: qrData?.invoiceCode || rawData.invoiceCode || "",
    invoiceNumber: invNum || String(Math.floor(Math.random() * 89999999 + 10000000)),
    issueDate: qrData?.issueDate || rawData.issueDate || new Date().toISOString().split("T")[0],
    checkCode: qrData?.checksum || rawData.checkCode || "",
    buyerName: resolvedBuyerName,
    buyerTaxId: rawData.buyerTaxId || "",
    sellerName: resolvedSellerName,
    sellerTaxId: isTrainTicket ? "-" : rawData.sellerTaxId || "",
    totalAmountWithoutTax: noTaxAmt,
    totalTaxAmount: taxAmt,
    totalAmountWithTax: totalAmt,
    totalAmountWithTaxCN: rawData.totalAmountWithTaxCN || numberToRMB(totalAmt),
    taxRate: rawData.taxRate || (taxAmt > 0 && noTaxAmt > 0 ? `${Math.round((taxAmt / noTaxAmt) * 100)}%` : "0%"),
    category: resolvedCategory,
    remarks: resolvedRemarks,
    drawer: rawData.drawer || "",
    passengerName: resolvedPassengerName,
    passengerId: rawData.passengerId,
    trainRoute: resolvedTrainRoute,
    trainDepartureTime: departureTime,
    items: isTrainTicket
      ? [
          {
            id: `item-${Date.now()}-1`,
            name: resolvedPassengerName ? `乘车: ${resolvedPassengerName}` : "铁路客票/客运服务",
            amount: totalAmt,
            quantity: 1,
            taxRate: rawData.taxRate || "0%",
            taxAmount: taxAmt,
          },
        ]
      : Array.isArray(rawData.items) && rawData.items.length > 0
      ? rawData.items.map((it: any, idx: number) => ({
          id: it.id || `item-${Date.now()}-${idx + 1}`,
          name: it.name || rawData.remarks || fileName,
          amount: Number(it.amount || totalAmt),
          quantity: Number(it.quantity || 1),
          spec: it.spec,
          unit: it.unit,
          price: it.price ? Number(it.price) : undefined,
          taxRate: it.taxRate || rawData.taxRate,
          taxAmount: it.taxAmount != null ? Number(it.taxAmount) : taxAmt,
        }))
      : [
          {
            id: `item-${Date.now()}-1`,
            name: rawData.remarks || fileName,
            amount: totalAmt,
            quantity: 1,
            taxRate: rawData.taxRate,
            taxAmount: taxAmt,
          },
        ],
    fileUrl: previewFileUrl,
    fileName,
    selectedForPrint: true,
    importTime: formatCurrentTimestamp(),
  };

    const confidence: UnifiedOcrResult["confidence"] = qrScanned || (isPdf && totalAmt > 0) ? "high" : totalAmt > 0 ? "medium" : "low";

    return {
      invoice: finalInvoice,
      engineUsed,
      qrScanned,
      confidence,
    };
  } catch (outerErr: any) {
    console.warn("Unified pipeline outer catch fallback:", outerErr);
    const fallbackParsed = parseInvoiceTextWithRules("", fileName);
    const today = new Date().toISOString().split("T")[0];
    const fallbackInvoice: InvoiceData = {
      id: `inv-uploaded-${Date.now()}-${index}`,
      invoiceType: fallbackParsed.invoiceType || "电子发票(普通发票)",
      invoiceCode: fallbackParsed.invoiceCode || "",
      invoiceNumber: fallbackParsed.invoiceNumber || String(Math.floor(Math.random() * 89999999 + 10000000)),
      issueDate: fallbackParsed.issueDate || today,
      checkCode: fallbackParsed.checkCode || "",
      buyerName: cleanPartyEntityName(fallbackParsed.buyerName || settings?.defaultCompany || "个人") || "个人",
      buyerTaxId: fallbackParsed.buyerTaxId || "",
      sellerName: cleanPartyEntityName(fallbackParsed.sellerName || "出票服务单位") || "出票服务单位",
      sellerTaxId: fallbackParsed.sellerTaxId || "",
      totalAmountWithoutTax: 0,
      totalTaxAmount: 0,
      totalAmountWithTax: 0,
      totalAmountWithTaxCN: "零元整",
      taxRate: "0%",
      category: fallbackParsed.category || "其他",
      remarks: fileName,
      drawer: "",
      items: [
        {
          id: `item-${Date.now()}-1`,
          name: fileName,
          amount: 0,
          quantity: 1,
          taxRate: "0%",
          taxAmount: 0,
        },
      ],
      fileUrl: fileBase64,
      fileName,
      selectedForPrint: true,
      importTime: formatCurrentTimestamp(),
    };

    return {
      invoice: fallbackInvoice,
      engineUsed: "【格式防错兜底】",
      qrScanned: false,
      confidence: "low",
    };
  }
}
