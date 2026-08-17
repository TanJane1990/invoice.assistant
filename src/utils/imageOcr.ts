import { createWorker } from "tesseract.js";

let workerPromise: Promise<any> | null = null;

async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        const worker = await createWorker("chi_sim+eng", 1, {
          logger: () => {},
          errorHandler: () => {},
        });
        return worker;
      } catch (e) {
        console.warn("Failed to init Tesseract worker with chi_sim+eng, trying eng fallback:", e);
        try {
          const worker = await createWorker("eng", 1, {
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

/**
 * Perform local client/Node OCR text extraction from Base64 image using Tesseract.js
 * Added 3.5s strict timeout circuit breaker to prevent hanging on offline / slow CDN downloads
 */
export async function recognizeImageTextWithTesseract(fileBase64: string): Promise<string> {
  const ocrTask = (async () => {
    try {
      const worker = await getOcrWorker();
      if (!worker) return "";
      const ret = await worker.recognize(fileBase64);
      return ret.data.text || "";
    } catch (err) {
      console.warn("Tesseract OCR extraction failed:", err);
      return "";
    }
  })();

  const timeoutTask = new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve("");
    }, 3500);
  });

  return Promise.race([ocrTask, timeoutTask]);
}
