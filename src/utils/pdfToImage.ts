import * as pdfjsLib from "pdfjs-dist";

// 使用本地打包的 pdf.worker.min.js 和 cmaps/standard_fonts，彻底解除云端外网依赖
const LOCAL_WORKER_URL = typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http")
  ? `${window.location.origin}/pdf.worker.min.js`
  : "/pdf.worker.min.js";

const LOCAL_CMAP_URL = typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http")
  ? `${window.location.origin}/cmaps/`
  : "/cmaps/";

const LOCAL_FONTS_URL = typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http")
  ? `${window.location.origin}/standard_fonts/`
  : "/standard_fonts/";

pdfjsLib.GlobalWorkerOptions.workerSrc = LOCAL_WORKER_URL;

/**
 * 从 PDF 文件 Base64/Uint8Array 中提取纯文本字符串
 */
export async function extractTextFromPdf(pdfDataUri: string): Promise<string> {
  try {
    let loadingTask;
    const pdfOptions = {
      cMapUrl: LOCAL_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: LOCAL_FONTS_URL,
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

    // 1. 如果是标准的 A4 纵向文档 (h > w * 0.95)，且为电子发票（发票票面通常集中在上半部 50%~60%）
    // 统计每一行的非白色像素数量（行密度检测）
    const isPortrait = h > w * 0.95;
    const rowCounts = new Array(h).fill(0);
    const colCounts = new Array(w).fill(0);

    let minY = h, maxY = 0, minX = w, maxX = 0;

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // 非纯白且非透明 (RGB < 235)
        if (a > 30 && (r < 235 || g < 235 || b < 235)) {
          rowCounts[y] += 1;
          colCounts[x] += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (minY >= maxY || minX >= maxX) {
      return canvas.toDataURL("image/png");
    }

    // 2. 如果是 A4 纵向页面，检测发票主体结束位置
    // 发票票面主体（抬头、表格、金额、开票人）通常在 y = 0 到 y = h * 0.6 之间
    if (isPortrait) {
      let mainContentMaxY = maxY;
      // 从 55% 高度开始向下检查是否有大段空白（如连续 30px 空行）
      let emptyStreak = 0;
      let lastSignificantRow = Math.round(h * 0.45);
      
      for (let y = Math.round(h * 0.2); y < h; y += 2) {
        if (rowCounts[y] > (w / 100)) {
          // 该行有显著内容
          lastSignificantRow = y;
          emptyStreak = 0;
        } else {
          emptyStreak += 2;
          // 如果在 45% 高度之后出现了连续超过 5% 高度的空白区，说明发票主体已经在此结束
          if (y > h * 0.45 && emptyStreak > h * 0.05) {
            mainContentMaxY = lastSignificantRow;
            break;
          }
        }
      }
      maxY = Math.min(maxY, mainContentMaxY);
    }

    // 增加 2% 安全微边距，防止贴边切到印章或字迹
    const paddingX = Math.round(w * 0.02);
    const paddingY = Math.round(h * 0.02);

    const cropX = Math.max(0, minX - paddingX);
    const cropY = Math.max(0, minY - paddingY);
    const cropW = Math.min(w - cropX, (maxX - minX) + paddingX * 2);
    const cropH = Math.min(h - cropY, (maxY - minY) + paddingY * 2);

    // 只要有 10% 以上的多余空白边，就执行裁切以放大票面
    if (cropH < h * 0.92 || cropW < w * 0.92) {
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
      cMapUrl: LOCAL_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: LOCAL_FONTS_URL,
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
