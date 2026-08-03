import * as pdfjsLib from "pdfjs-dist";

// Set worker URL dynamically from CDN to match pdfjs-dist version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * 将 PDF Base64/Uint8Array 渲染为 300DPI 超高清 PNG DataURL 图像
 */
export async function convertPdfToImageDataUrl(pdfDataUri: string): Promise<string> {
  try {
    let loadingTask;
    if (pdfDataUri.startsWith("data:")) {
      const base64Str = pdfDataUri.split(",")[1];
      const binaryStr = atob(base64Str);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      loadingTask = pdfjsLib.getDocument({ data: bytes });
    } else {
      loadingTask = pdfjsLib.getDocument(pdfDataUri);
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

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("PDF to Image conversion warning, fallback to raw PDF:", err);
    return pdfDataUri;
  }
}
