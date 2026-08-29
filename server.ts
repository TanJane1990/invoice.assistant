import 'dotenv/config';
import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import child_process from "child_process";
import XLSX from "xlsx-js-style";
import { GoogleGenAI, Type } from "@google/genai";
import { parseInvoiceTextWithRules } from "./src/utils/localPdfInvoiceOcr";

const PORT = 3000;

async function startServer() {
  const app = express();

  // Enable CORS for Electron file:// protocol and web requests
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Parse JSON payloads up to 20MB for image/PDF uploads
  app.use(express.json({ limit: "20mb" }));

  // 静态挂载本地 public 静态资源（包含离线 pdf.worker.min.js、cmaps、standard_fonts 与 tessdata 语言包）
  const publicDir = path.join(__dirname, "public");
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }
  const rootPublicDir = path.join(process.cwd(), "public");
  if (fs.existsSync(rootPublicDir)) {
    app.use(express.static(rootPublicDir));
  }

  // Initialize Gemini AI client server-side
  const getAi = (customApiKey?: string) => {
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // API Health Check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Helper: 智能定位本地电脑（桌面/下载/文档/U盘）真实存在的发票台账 Excel 文件
  const findInvoiceFileOnDisk = (preferredFileName?: string) => {
    const homeDir = os.homedir();
    const searchDirs = [
      path.join(homeDir, "Desktop"),
      path.join(homeDir, "Downloads"),
      path.join(homeDir, "Documents"),
    ];

    if (fs.existsSync("/Volumes")) {
      try {
        const vols = fs.readdirSync("/Volumes");
        vols.forEach((v) => {
          searchDirs.push(path.join("/Volumes", v));
        });
      } catch (e) {}
    }

    // 1. 优先找传入的文件名
    if (preferredFileName) {
      for (const dir of searchDirs) {
        const full = path.join(dir, preferredFileName);
        if (fs.existsSync(full)) {
          return { exists: true, filePath: full, fileName: path.basename(full) };
        }
      }
    }

    // 2. 查找标准名称 “发票台账明细表.xlsx” 或常见名称
    const fixedNames = ["发票台账明细表.xlsx", "发票台账明细表_2026.xlsx", "发票台账.xlsx"];
    for (const name of fixedNames) {
      for (const dir of searchDirs) {
        const full = path.join(dir, name);
        if (fs.existsSync(full)) {
          return { exists: true, filePath: full, fileName: path.basename(full) };
        }
      }
    }

    // 3. 扫描目录下以 “发票台账” 开头的最新修改的 .xlsx 文件
    let latestFile: { filePath: string; fileName: string; mtime: number } | null = null;
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            if (f.startsWith("发票台账") && f.endsWith(".xlsx") && !f.startsWith("~$")) {
              const full = path.join(dir, f);
              const stat = fs.statSync(full);
              if (!latestFile || stat.mtimeMs > latestFile.mtime) {
                latestFile = { filePath: full, fileName: f, mtime: stat.mtimeMs };
              }
            }
          }
        } catch (e) {}
      }
    }

    if (latestFile) {
      return { exists: true, filePath: latestFile.filePath, fileName: latestFile.fileName };
    }

    return { exists: false, filePath: "", fileName: preferredFileName || "发票台账明细表.xlsx" };
  };

  // API Endpoint: 检查本地电脑上是否存在发票台账文件
  app.post("/api/check-file-exists", (req, res) => {
    try {
      const { fileName } = req.body;
      const result = findInvoiceFileOnDisk(fileName);
      return res.json(result);
    } catch (e) {
      return res.json({ exists: false, filePath: "", fileName: "发票台账明细表.xlsx" });
    }
  });

  // API Endpoint: 直接将导出的 Excel 二进制数据精准写入到本地电脑（桌面/现有发票台账文件）
  app.post("/api/save-excel-direct", (req, res) => {
    try {
      const { fileName, base64Data, mode = "default" } = req.body;
      if (!base64Data) {
        return res.status(400).json({ success: false, message: "缺少 Excel 数据" });
      }

      const incomingBuffer = Buffer.from(base64Data, "base64");
      const diskCheck = findInvoiceFileOnDisk(fileName);

      let targetPath = diskCheck.exists ? diskCheck.filePath : null;

      if (!targetPath) {
        // 如果文件不存在，默认保存到 Mac 桌面 (Desktop)
        const homeDir = os.homedir();
        const desktopPath = path.join(homeDir, "Desktop");
        if (fs.existsSync(desktopPath)) {
          targetPath = path.join(desktopPath, fileName || "发票台账明细表.xlsx");
        } else {
          targetPath = path.join(homeDir, "Downloads", fileName || "发票台账明细表.xlsx");
        }
      }

      // 如果模式为 append 且目标文件已存在于磁盘中：读取磁盘已有历史数据 + 本次新批次数据拼接到末尾
      if (mode === "append" && diskCheck.exists && targetPath && fs.existsSync(targetPath)) {
        try {
          const existingWb = XLSX.readFile(targetPath);
          const firstSheetName = existingWb.SheetNames[0];
          const existingSheet = existingWb.Sheets[firstSheetName];
          const rawExistingRows: any[] = XLSX.utils.sheet_to_json(existingSheet, { defval: "" });

          const incomingWb = XLSX.read(incomingBuffer, { type: "buffer" });
          const incomingSheet = incomingWb.Sheets[incomingWb.SheetNames[0]];
          const rawIncomingRows: any[] = XLSX.utils.sheet_to_json(incomingSheet, { defval: "" });

          // 过滤掉原本文件中因为历史错误被误写入的空行（既没有开票日期也没有发票号码，且不是统计行的坏数据）
          const cleanedExistingRows = rawExistingRows.filter((r) => {
            const isSummary = String(r["序号"] || "").startsWith("统计");
            const hasData = Boolean(r["发票号码"] || r["开票日期"] || r["价税合计"]);
            return isSummary || hasData;
          });

          // 确保本次新追加的数据（包含新批次发票 + 本批次专属统计汇总行）作为新批次追加在旧数据下方
          const allRows = [...cleanedExistingRows, ...rawIncomingRows];

          // 统计全表真正的发票总张数（不含任何统计汇总行）
          let realInvoiceCount = 0;
          allRows.forEach((row) => {
            const isSummary = String(row["序号"] || "").startsWith("统计");
            if (!isSummary) {
              realInvoiceCount++;
            }
          });

          // 全表跨批次全量发票查重（统计行不参与查重）
          const invoiceNumCounts: Record<string, number[]> = {};
          allRows.forEach((row, idx) => {
            const isSummary = String(row["序号"] || "").startsWith("统计");
            if (isSummary) return;
            const num = String(row["发票号码"] || "").trim();
            if (num && num !== "-" && num !== "无") {
              if (!invoiceNumCounts[num]) invoiceNumCounts[num] = [];
              invoiceNumCounts[num].push(idx);
            }
          });

          const dupRowIndices = new Set<number>();
          Object.values(invoiceNumCounts).forEach((indices) => {
            if (indices.length > 1) {
              indices.forEach((i) => dupRowIndices.add(i));
            }
          });

          // 更新全表所有发票行（跨批次）的查重状态文字
          allRows.forEach((row, idx) => {
            const isSummary = String(row["序号"] || "").startsWith("统计");
            if (!isSummary) {
              if (dupRowIndices.has(idx)) {
                row["查重状态"] = "⚠️ 发票重复";
              } else {
                row["查重状态"] = "✓ 正常唯一";
              }
            }
          });

          // 生成新的 Worksheet
          const colKeys = Object.keys(allRows[0] || {});
          const mergedWorksheet = XLSX.utils.json_to_sheet(allRows, { header: colKeys });

          // 自适应计算列宽
          const dynamicCols = colKeys.map((key) => {
            let maxLen = 0;
            for (let i = 0; i < key.length; i++) {
              maxLen += key.charCodeAt(i) > 255 ? 2.1 : 1.05;
            }
            allRows.forEach((item) => {
              const val = String(item[key] ?? "");
              let len = 0;
              for (let i = 0; i < val.length; i++) {
                len += val.charCodeAt(i) > 255 ? 2.1 : 1.05;
              }
              if (len > maxLen) maxLen = len;
            });
            return { wch: Math.max(Math.ceil(maxLen) + 3, 10) };
          });
          mergedWorksheet["!cols"] = dynamicCols;

          // 设置表头样式
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
            fill: { fgColor: { rgb: "FFFF00" } }, // 明黄色整行高亮
            font: { name: "Microsoft YaHei", sz: 10, bold: true, color: { rgb: "000000" } },
            alignment: { vertical: "center", horizontal: "left" },
            border: {
              top: { style: "thin", color: { rgb: "D4D4D8" } },
              bottom: { style: "thin", color: { rgb: "D4D4D8" } },
              left: { style: "thin", color: { rgb: "E4E4E7" } },
              right: { style: "thin", color: { rgb: "E4E4E7" } },
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

          const summaryStyle = {
            fill: { fgColor: { rgb: "F8FAFC" } },
            font: { name: "Microsoft YaHei", sz: 11, bold: true, color: { rgb: "0F172A" } },
            alignment: { vertical: "center", horizontal: "left" },
            border: {
              top: { style: "medium", color: { rgb: "475569" } },
              bottom: { style: "medium", color: { rgb: "475569" } },
              left: { style: "thin", color: { rgb: "CBD5E1" } },
              right: { style: "thin", color: { rgb: "CBD5E1" } },
            },
          };

          const summaryMoneyStyle = {
            fill: { fgColor: { rgb: "FEF2F2" } },
            font: { name: "Microsoft YaHei", sz: 11, bold: true, color: { rgb: "DC2626" } },
            alignment: { vertical: "center", horizontal: "right" },
            border: {
              top: { style: "medium", color: { rgb: "DC2626" } },
              bottom: { style: "medium", color: { rgb: "DC2626" } },
              left: { style: "thin", color: { rgb: "CBD5E1" } },
              right: { style: "thin", color: { rgb: "CBD5E1" } },
            },
          };

          colKeys.forEach((_, colIdx) => {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
            if (mergedWorksheet[cellRef]) mergedWorksheet[cellRef].s = headerStyle;
          });

          allRows.forEach((row, rowIdx) => {
            const r = rowIdx + 1;
            const isSummary = String(row["序号"] || "").startsWith("统计");
            const isDup = dupRowIndices.has(rowIdx);

            colKeys.forEach((key, colIdx) => {
              const cellRef = XLSX.utils.encode_cell({ r, c: colIdx });
              if (mergedWorksheet[cellRef]) {
                if (isSummary) {
                  if (key === "价税合计") {
                    mergedWorksheet[cellRef].s = summaryMoneyStyle;
                  } else {
                    mergedWorksheet[cellRef].s = summaryStyle;
                  }
                } else {
                  const baseStyle = isDup ? { ...duplicateRowStyle } : { ...normalRowStyle };
                  const isCenterCol = key === "序号" || key === "开票日期" || key === "发票类型" || key === "税率" || key === "查重状态" || key === "发票代码" || key === "校验码";
                  const isRightCol = key === "不含税金额" || key === "税额" || key === "价税合计";
                  mergedWorksheet[cellRef].s = {
                    ...baseStyle,
                    alignment: {
                      vertical: "center",
                      horizontal: isRightCol ? "right" : isCenterCol ? "center" : "left",
                    },
                  };
                }
              }
            });
          });

          const mergedWorkbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(mergedWorkbook, mergedWorksheet, "发票台账数据");
          XLSX.writeFile(mergedWorkbook, targetPath);

          const incomingInvoiceCount = rawIncomingRows.filter((r) => !String(r["序号"] || "").startsWith("统计")).length;

          return res.json({
            success: true,
            filePath: targetPath,
            fileName: path.basename(targetPath),
            totalCount: realInvoiceCount,
            appendedCount: incomingInvoiceCount,
            message: dupRowIndices.size > 0
              ? `成功合并追加 ${incomingInvoiceCount} 张新发票！\n文件中共 ${realInvoiceCount} 张发票（分批次归档）。\n⚠️ 发现 ${dupRowIndices.size} 条跨批次重复发票，已自动在 Excel 中明黄色高亮标出！`
              : `成功合并追加 ${incomingInvoiceCount} 张新发票！\n文件中共 ${realInvoiceCount} 张发票（分批次归档），所有发票正常唯一。`,
          });
        } catch (mergeErr) {
          console.warn("Append merge error, falling back to direct write:", mergeErr);
        }
      }

      fs.writeFileSync(targetPath, incomingBuffer);
      return res.json({ success: true, filePath: targetPath, fileName: path.basename(targetPath) });
    } catch (e) {
      console.error("Direct save excel error:", e);
      return res.status(500).json({ success: false, error: String(e) });
    }
  });

  // API Endpoint: Intelligent Invoice Parsing (Supports Gemini AI, Baidu OCR, & Local PDF OCR)
  app.post("/api/parse-invoice", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName, aiApiKey, baiduApiKey, baiduSecretKey } = req.body;

      if (!fileBase64) {
        return res.status(400).json({ error: "缺少发票文件数据" });
      }

      const rawBase64 = fileBase64.replace(/^data:.*?;base64,/, "");
      const fileBuffer = Buffer.from(rawBase64, "base64");
      const isPdf = mimeType?.includes("pdf") || fileName?.toLowerCase().endsWith(".pdf") || rawBase64.startsWith("JVBERi");

      const hasGeminiKey = Boolean(aiApiKey || process.env.GEMINI_API_KEY);
      const hasBaiduKey = Boolean(baiduApiKey && baiduSecretKey);

      // Strategy 1: External AI API (Gemini Multimodal Vision) if key provided
      if (hasGeminiKey) {
        try {
          const ai = getAi(aiApiKey);
          if (ai) {
            const prompt = `你是一个全能精密的中国发票与财税票据识读AI引擎。请准确识别提取此发票中的所有票面信息。按规范输出JSON格式。`;
            const response = await ai.models.generateContent({
              model: "gemini-3.6-flash",
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || "application/pdf",
                      data: rawBase64,
                    },
                  },
                  { text: prompt },
                ],
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    invoiceType: { type: Type.STRING },
                    invoiceCode: { type: Type.STRING },
                    invoiceNumber: { type: Type.STRING },
                    issueDate: { type: Type.STRING },
                    buyerName: { type: Type.STRING },
                    buyerTaxId: { type: Type.STRING },
                    sellerName: { type: Type.STRING },
                    sellerTaxId: { type: Type.STRING },
                    totalAmountWithoutTax: { type: Type.NUMBER },
                    totalTaxAmount: { type: Type.NUMBER },
                    totalAmountWithTax: { type: Type.NUMBER },
                    totalAmountWithTaxCN: { type: Type.STRING },
                    category: { type: Type.STRING },
                    remarks: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          spec: { type: Type.STRING },
                          unit: { type: Type.STRING },
                          quantity: { type: Type.NUMBER },
                          price: { type: Type.NUMBER },
                          amount: { type: Type.NUMBER },
                          taxRate: { type: Type.STRING },
                          taxAmount: { type: Type.NUMBER },
                        },
                      },
                    },
                  },
                  required: ["invoiceType", "invoiceNumber", "issueDate", "totalAmountWithTax", "totalAmountWithTaxCN"],
                },
              },
            });

            const parsedData = JSON.parse(response.text || "{}");
            return res.json({
              success: true,
              engine: "gemini_ai",
              fileName,
              data: parsedData,
            });
          }
        } catch (aiErr) {
          console.warn("Gemini AI API call failed, falling back to Local PDF OCR Engine...", aiErr);
        }
      }

      // Strategy 2: Local PDF OCR & Rule Extraction Engine (No API key required)
      let extractedText = req.body.extractedText || "";
      if (isPdf && (!extractedText || extractedText.trim().length < 20)) {
        try {
          // @ts-ignore
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js");
          const cMapDir = path.join(__dirname, "public", "cmaps");
          const localCMap = fs.existsSync(cMapDir) ? cMapDir + "/" : path.join(process.cwd(), "public", "cmaps") + "/";
          const fontsDir = path.join(__dirname, "public", "standard_fonts");
          const localFonts = fs.existsSync(fontsDir) ? fontsDir + "/" : path.join(process.cwd(), "public", "standard_fonts") + "/";

          const uint8 = new Uint8Array(fileBuffer);
          const pdfDoc = await pdfjsLib.getDocument({
            data: uint8,
            cMapUrl: localCMap,
            cMapPacked: true,
            standardFontDataUrl: localFonts,
          }).promise;

          let pdfFullText = "";
          const pages = Math.min(pdfDoc.numPages, 3);
          for (let i = 1; i <= pages; i++) {
            const page = await pdfDoc.getPage(i);
            const content = await page.getTextContent();
            pdfFullText += content.items.map((it: any) => it.str || "").join(" ") + "\n";
          }
          if (pdfFullText.trim()) {
            extractedText = pdfFullText;
          }
        } catch (pdfErr) {
          console.warn("Server-side pdfjs extraction warning:", pdfErr);
        }
      }

      // 服务端离线 OCR 兜底：如果前端未提取到文本或纯图片上传，在 Node.js 服务端执行本地离线 Tesseract OCR
      if (!extractedText || extractedText.trim().length < 20) {
        try {
          const { createWorker, PSM } = await import("tesseract.js");
          const langDir = path.join(__dirname, "public", "tessdata");
          const localLangPath = fs.existsSync(langDir) ? langDir : path.join(process.cwd(), "public", "tessdata");

          const worker = await createWorker("chi_sim+eng", 1, {
            langPath: localLangPath,
            logger: () => {},
            errorHandler: () => {},
          });
          await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
          const ocrRet = await worker.recognize(fileBuffer);
          if (ocrRet?.data?.text) {
            extractedText = (extractedText + "\n" + ocrRet.data.text).trim();
          }
          await worker.terminate();
        } catch (nodeOcrErr) {
          console.warn("Node server-side Tesseract OCR fallback warning:", nodeOcrErr);
        }
      }

      if (!extractedText && isPdf) {
        extractedText = fileBuffer.toString("utf-8");
      }

      // Run our Local Rule & Regex Invoice OCR Parser
      const localParsedInvoice = parseInvoiceTextWithRules(extractedText, fileName);

      return res.json({
        success: true,
        engine: "local_pdf_ocr",
        fileName,
        data: localParsedInvoice,
      });
    } catch (err: any) {
      console.error("Invoice parse endpoint error:", err);
      return res.status(500).json({
        error: "发票识别失败",
        details: err?.message || String(err),
      });
    }
  });

  // Serve Vite in development mode, or static files in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const fs = await import("fs");
    const distPath = fs.existsSync(path.join(__dirname, "index.html"))
      ? __dirname
      : path.join(__dirname, "../dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`[发票管理助手] Server running on http://127.0.0.1:${PORT}`);
  });
}

export { XLSX, parseInvoiceTextWithRules };
export default startServer;

startServer();
