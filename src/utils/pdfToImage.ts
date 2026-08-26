import * as pdfjsLib from "pdfjs-dist";

// Set worker URL dynamically from CDN to match pdfjs-dist version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const CMAP_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`;
const STANDARD_FONTS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

/**
 * 从 PDF 文件 Base64/Uint8Array 中提取纯文本字符串
 */
export async function extractTextFromPdf(pdfDataUri: string): Promise<string> {
  try {
    let loadingTask;
    const pdfOptions = {
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: STANDARD_FONTS_URL,
    };

    if (pdfDataUri.startsWith("data:")) {
      const base64Str = pdfDataUri.split(",")[1];
      const binaryStr = atob(base64Str);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      loadingTask = pdfjsLib.getDocument({ data: bytes, ...pdfOptions });
    } else {
      loadingTask = pdfjsLib.getDocument({ url: pdfDataUri, ...pdfOptions });
    }

    const pdfDoc = await loadingTask.promise;
    let fullText = "";
    const maxPages = Math.min(pdfDoc.numPages, 3);
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || "")
        .join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  } catch (err) {
    console.warn("Extract text from PDF failed:", err);
    return "";
  }
}

/**
 * 智能自动检测并裁切掉 PDF/图片发票四周的大面积空白底边（如 A4 PDF 票面仅占上半部的情况）
 * 使发票有效票面能够 100% 饱满铺满 2张/页 或 4张/页 打印格
 */
export function cropWhitespaceFromCanvas(canvas: HTMLCanvasElement): string {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return canvas.toDataURL("image/png");

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minY = h, maxY = 0, minX = w, maxX = 0;
    let found = false;

    // 采样步长 2px，极速高精度扫描非白色内容 (RGB 阈值 240)
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a > 30 && (r < 240 || g < 240 || b < 240)) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) {
      return canvas.toDataURL("image/png");
    }

    // 增加 1.5% 安全微边距，防止切到印章或边缘字迹
    const paddingX = Math.round(w * 0.015);
    const paddingY = Math.round(h * 0.015);

    const cropX = Math.max(0, minX - paddingX);
    const cropY = Math.max(0, minY - paddingY);
    const cropW = Math.min(w - cropX, (maxX - minX) + paddingX * 2);
    const cropH = Math.min(h - cropY, (maxY - minY) + paddingY * 2);

    // 如果有效区域高度或宽度小于原本画面的 85%（即存在大面积无用留白），则裁切至有效票面
    if (cropH < h * 0.88 || cropW < w * 0.88) {
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const croppedCtx = croppedCanvas.getContext("2d");
      if (croppedCtx) {
        croppedCtx.fillStyle = "#ffffff";
        croppedCtx.fillRect(0, 0, cropW, cropH);
        croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        return croppedCanvas.toDataURL("image/png");
      }
    }

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("Auto-crop canvas failed:", err);
    return canvas.toDataURL("image/png");
  }
}

/**
 * 将 PDF Base64/Uint8Array 渲染为 300DPI 超高清 PNG DataURL 图像，并自动裁去无用空白边
 */
export async function convertPdfToImageDataUrl(pdfDataUri: string): Promise<string> {
  try {
    let loadingTask;
    const pdfOptions = {
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: STANDARD_FONTS_URL,
    };

    if (pdfDataUri.startsWith("data:")) {
      const base64Str = pdfDataUri.split(",")[1];
      const binaryStr = atob(base64Str);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      loadingTask = pdfjsLib.getDocument({ data: bytes, ...pdfOptions });
    } else {
      loadingTask = pdfjsLib.getDocument({ url: pdfDataUri, ...pdfOptions });
    }

    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    // 2.5 倍高清放缩，保证打印与屏幕显示极度清晰
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return pdfDataUri;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // 智能检测裁切无用空白底边
    return cropWhitespaceFromCanvas(canvas);
  } catch (err) {
    console.warn("PDF to Image conversion warning, fallback to raw PDF:", err);
    return pdfDataUri;
  }
}
