import { createWorker, PSM } from "tesseract.js";
import { extractInvoiceROIs, preprocessInvoiceImage } from "./imagePreprocess";

let workerPromise: Promise<any> | null = null;

function getTessLangPath(): string {
  if (typeof window !== "undefined") {
    if (window.location.protocol === "file:") {
      return "./tessdata";
    }
    if (window.location.origin && window.location.origin.startsWith("http")) {
      return `${window.location.origin}/tessdata`;
    }
    return "./tessdata";
  }
  return "./public/tessdata";
}

async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const langPath = getTessLangPath();
      try {
        const worker = await createWorker("chi_sim+eng", 1, {
          langPath,
          logger: () => {},
          errorHandler: () => {},
        });
        return worker;
      } catch (e) {
        console.warn("Failed to init Tesseract worker with chi_sim+eng, trying eng fallback:", e);
        try {
          const worker = await createWorker("eng", 1, {
            langPath,
            logger: () => {},
            errorHandler: () => {},
          });
          return worker;
        } catch (err) {
          console.warn("Failed to init Tesseract eng worker:", err);
          return null;
        }
      }
    })();
  }
  return workerPromise;
}

export interface OcrSnippetOptions {
  psm?: PSM | string;
  whitelist?: string;
}

/**
 * 使用调优参数识别指定图像/Canvas/Blob片段 (ROI 切片定向高精识别)
 */
export async function recognizeSnippetWithParams(
  imageSource: any,
  options: OcrSnippetOptions = {}
): Promise<string> {
  try {
    const worker = await getOcrWorker();
    if (!worker) return "";

    const params: Record<string, any> = {};
    if (options.psm) {
      params.tessedit_pageseg_mode = options.psm;
    }
    if (options.whitelist) {
      params.tessedit_char_whitelist = options.whitelist;
    }

    if (Object.keys(params).length > 0) {
      await worker.setParameters(params);
    }

    const ret = await worker.recognize(imageSource);

    // 重置参数为默认模式以防影响后续全图识别
    if (Object.keys(params).length > 0) {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        tessedit_char_whitelist: "",
      });
    }

    return (ret.data?.text || "").trim();
  } catch (err) {
    console.warn("Snippet OCR recognition failed:", err);
    return "";
  }
}

/**
 * 完整发票图像增强 OCR 流水线 (包含 Canvas 去红章/二值化/放大 + 全图识别 + ROI 区域增强)
 */
export async function recognizeImageTextWithTesseract(fileBase64: string): Promise<string> {
  const ocrTask = (async () => {
    try {
      // 1. 优先使用 Canvas 像素级预处理（去红章、局部二值化、插值锐化）
      let imageToOcr: any = fileBase64;
      let roiSet: ReturnType<typeof extractInvoiceROIs> | null = null;

      try {
        const { processedBase64, canvas } = await preprocessInvoiceImage(fileBase64, {
          removeStamp: true,
          binarize: true,
          upscale: true,
        });
        if (processedBase64) {
          imageToOcr = processedBase64;
        }
        if (canvas) {
          roiSet = extractInvoiceROIs(canvas);
        }
      } catch (prepErr) {
        console.warn("Image pre-processing skipped, fallback to raw image:", prepErr);
      }

      const worker = await getOcrWorker();
      if (!worker) return "";

      // 2. 执行主图文本识别 (AUTO 完整多栏/表格版面自动识别模式)
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        tessedit_char_whitelist: "",
      });
      const ret = await worker.recognize(imageToOcr);
      let mainText = ret.data?.text || "";

      // 3. 执行特定关键区域 (ROI) 切片高精度二次识别以补充可能遗漏的金额或代码
      if (roiSet) {
        try {
          // 金额 ROI 识别 (金额字符白名单 + 单行/单块模式)
          const amountText = await recognizeSnippetWithParams(roiSet.totalAmountRoi, {
            psm: PSM.SINGLE_BLOCK,
            whitelist: "0123456789.¥￥,零壹贰叁参肆伍陆柒捌玖拾佰仟万亿角分整（）()小写大写:：价税合计金额",
          });

          // 发票代码号码 ROI 识别 (纯数字与大写字母白名单)
          const codeText = await recognizeSnippetWithParams(roiSet.codeAndNumberRoi, {
            psm: PSM.SINGLE_BLOCK,
            whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-:/发票代码号码开票日期校验码",
          });

          if (amountText) {
            mainText += `\n【金额区域高精识别】\n${amountText}`;
          }
          if (codeText) {
            mainText += `\n【代码号码区域高精识别】\n${codeText}`;
          }
        } catch (roiErr) {
          console.warn("ROI snippet OCR warning:", roiErr);
        }
      }

      return mainText.trim();
    } catch (err) {
      console.warn("Tesseract OCR extraction failed:", err);
      return "";
    }
  })();

  // 严格超时保护熔断机制 (5s)，防止卡死
  const timeoutTask = new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve("");
    }, 5000);
  });

  return Promise.race([ocrTask, timeoutTask]);
}
