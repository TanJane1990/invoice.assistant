/**
 * Canvas 图像像素级预处理引擎 (Invoice Canvas Image Preprocessing Engine)
 * 专门针对发票图像进行红色印章过滤、局部自适应二值化、插值放大与边缘锐化
 */

export interface PreprocessOptions {
  removeStamp?: boolean;
  binarize?: boolean;
  upscale?: boolean;
  upscaleThresholdWidth?: number;
}

/**
 * 辅助函数：将 Base64 或 Data URL 加载为 HTMLImageElement
 */
export function loadImageFromBase64(base64Url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof Image === "undefined") {
      return reject(new Error("Image element not available in non-browser environment"));
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
    img.src = base64Url;
  });
}

/**
 * 1. 消除红色印章干扰 (Remove Red Stamp)
 * 针对公章盖在金额、开票人、销售方文字上的情况：
 * 遍历像素检测红色通道特征（R 高于 G 和 B 一定比例），将纯红印泥置白，同时保留深色墨迹
 */
export function removeRedStamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 判断是否为偏红色/印章印泥色 (R 显著高于 G 和 B，且不是整体暗黑色文字)
      const isRedStamp =
        (r > 120 && r > g * 1.25 && r > b * 1.25) ||
        (r > 140 && g < 115 && b < 115);

      if (isRedStamp) {
        // 如果是红色印章覆盖层，将其置为白色背景
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn("removeRedStamp error:", err);
  }
}

/**
 * 2. 局部自适应二值化 (Adaptive Binarization with Integral Image)
 * 基于积分图的高效局部均值阈值算法（O(N) 复杂度）：
 * 过滤浅蓝色、浅灰色的表格线与背景防伪底纹，将字符边缘对比度最大化
 */
export function adaptiveBinarize(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blockSize: number = 25,
  C: number = 10
): void {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const totalPixels = width * height;
    const gray = new Uint8Array(totalPixels);

    // 步骤 1: 转换为灰度图
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // 步骤 2: 构建积分图 (Integral Image) 以实现 O(1) 局部窗口求和
    const integral = new Float64Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y++) {
      let rowSum = 0;
      for (let x = 0; x < width; x++) {
        rowSum += gray[y * width + x];
        integral[(y + 1) * (width + 1) + (x + 1)] =
          integral[y * (width + 1) + (x + 1)] + rowSum;
      }
    }

    const halfBlock = Math.floor(blockSize / 2);

    // 步骤 3: 遍历并进行自适应二值化判定
    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - halfBlock);
      const y1 = Math.min(height, y + halfBlock + 1);

      for (let x = 0; x < width; x++) {
        const x0 = Math.max(0, x - halfBlock);
        const x1 = Math.min(width, x + halfBlock + 1);

        const count = (x1 - x0) * (y1 - y0);
        const sum =
          integral[y1 * (width + 1) + x1] -
          integral[y0 * (width + 1) + x1] -
          integral[y1 * (width + 1) + x0] +
          integral[y0 * (width + 1) + x0];

        const localMean = sum / count;
        const pixelVal = gray[y * width + x];
        // 判定：若当前像素灰度低于 (局部均值 - 偏移量C)，则为前景文字(黑 0)，否则为背景(白 255)
        const binaryVal = pixelVal < localMean - C ? 0 : 255;

        const idx = (y * width + x) * 4;
        data[idx] = binaryVal;
        data[idx + 1] = binaryVal;
        data[idx + 2] = binaryVal;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn("adaptiveBinarize error:", err);
  }
}

/**
 * 3. 双倍双线性插值放大与边缘轻度锐化
 * 对低分辨率（如 < 1400px）或 72 DPI 拍照发票进行放大并强化笔画边缘，减少 8/0/6/3 混淆
 */
export function upscaleAndSharpen(
  sourceCanvas: HTMLCanvasElement,
  scale: number = 1.5
): HTMLCanvasElement {
  try {
    const targetCanvas = document.createElement("canvas");
    targetCanvas.width = Math.round(sourceCanvas.width * scale);
    targetCanvas.height = Math.round(sourceCanvas.height * scale);

    const ctx = targetCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return sourceCanvas;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);

    // 应用 3x3 适度拉普拉斯锐化卷积核
    const imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);
    const w = targetCanvas.width;
    const h = targetCanvas.height;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          const idx = (y * w + x) * 4 + c;
          const top = ((y - 1) * w + x) * 4 + c;
          const bottom = ((y + 1) * w + x) * 4 + c;
          const left = (y * w + (x - 1)) * 4 + c;
          const right = (y * w + (x + 1)) * 4 + c;

          const centerVal = copy[idx];
          const neighborSum = copy[top] + copy[bottom] + copy[left] + copy[right];
          // 锐化权重计算: 中心增强，弱化边缘模糊
          const sharpened = centerVal * 2.6 - neighborSum * 0.4;
          data[idx] = Math.max(0, Math.min(255, sharpened));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return targetCanvas;
  } catch (err) {
    console.warn("upscaleAndSharpen error:", err);
    return sourceCanvas;
  }
}

/**
 * 4. 提取指定比例区域切片 (ROI: Region Of Interest)
 */
export function cropRoiCanvas(
  sourceCanvas: HTMLCanvasElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number
): HTMLCanvasElement {
  const roiCanvas = document.createElement("canvas");
  const sx = Math.floor(sourceCanvas.width * Math.max(0, Math.min(1, xRatio)));
  const sy = Math.floor(sourceCanvas.height * Math.max(0, Math.min(1, yRatio)));
  const sw = Math.floor(sourceCanvas.width * Math.max(0.02, Math.min(1 - xRatio, wRatio)));
  const sh = Math.floor(sourceCanvas.height * Math.max(0.02, Math.min(1 - yRatio, hRatio)));

  roiCanvas.width = Math.max(10, sw);
  roiCanvas.height = Math.max(10, sh);

  const ctx = roiCanvas.getContext("2d", { willReadFrequently: true });
  if (ctx && sw > 0 && sh > 0) {
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, roiCanvas.width, roiCanvas.height);
  }
  return roiCanvas;
}

export interface InvoiceRoiSet {
  fullPreprocessedCanvas: HTMLCanvasElement;
  codeAndNumberRoi: HTMLCanvasElement;
  totalAmountRoi: HTMLCanvasElement;
  issueDateRoi: HTMLCanvasElement;
}

/**
 * 5. 按照中国标准增值税/数电发票布局切出核心 ROI 片段
 */
export function extractInvoiceROIs(canvas: HTMLCanvasElement): InvoiceRoiSet {
  // 右上角区域 (发票代码、号码、开票日期、校验码区域)
  const codeAndNumberRoi = cropRoiCanvas(canvas, 0.46, 0.0, 0.54, 0.30);

  // 中下部/右下部区域 (价税合计大小写、税额合计区域)
  const totalAmountRoi = cropRoiCanvas(canvas, 0.30, 0.52, 0.70, 0.32);

  // 日期区域 (右上或票头区域)
  const issueDateRoi = cropRoiCanvas(canvas, 0.50, 0.08, 0.50, 0.22);

  return {
    fullPreprocessedCanvas: canvas,
    codeAndNumberRoi,
    totalAmountRoi,
    issueDateRoi,
  };
}

/**
 * 6. 发票主图像预处理流水线
 */
export async function preprocessInvoiceImage(
  base64Url: string,
  options: PreprocessOptions = {}
): Promise<{ processedBase64: string; canvas: HTMLCanvasElement | null }> {
  const {
    removeStamp = true,
    binarize = true,
    upscale = true,
    upscaleThresholdWidth = 1400,
  } = options;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return { processedBase64: base64Url, canvas: null };
  }

  try {
    const img = await loadImageFromBase64(base64Url);
    let canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    let ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return { processedBase64: base64Url, canvas: null };
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 1. 如果分辨率偏低，执行插值放大与锐化
    if (upscale && canvas.width < upscaleThresholdWidth) {
      const scale = Math.min(2.0, upscaleThresholdWidth / canvas.width);
      if (scale > 1.15) {
        canvas = upscaleAndSharpen(canvas, scale);
        ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      }
    }

    // 2. 消除红色印章干扰
    if (removeStamp && ctx) {
      removeRedStamp(ctx, canvas.width, canvas.height);
    }

    // 3. 局部自适应二值化
    if (binarize && ctx) {
      adaptiveBinarize(ctx, canvas.width, canvas.height, 25, 10);
    }

    const processedBase64 = canvas.toDataURL("image/png");
    return { processedBase64, canvas };
  } catch (err) {
    console.warn("Invoice image preprocessing failed, using original image:", err);
    return { processedBase64: base64Url, canvas: null };
  }
}
