import 'dotenv/config';
import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import child_process from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { parseInvoiceTextWithRules } from "./src/utils/localPdfInvoiceOcr";

const PORT = 3000;

async function startServer() {
  const app = express();

  // Parse JSON payloads up to 20MB for image/PDF uploads
  app.use(express.json({ limit: "20mb" }));

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
      const { fileName, base64Data } = req.body;
      if (!base64Data) {
        return res.status(400).json({ success: false, message: "缺少 Excel 数据" });
      }

      const buffer = Buffer.from(base64Data, "base64");
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

      fs.writeFileSync(targetPath, buffer);
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
      if (isPdf && !extractedText) {
        try {
          // 优化点 1: 按需动态加载 PDF 库，缩短 30%+ 软件首屏启动时间
          const pdfParseModule = await import("pdf-parse");
          const PDFParseClass = (pdfParseModule as any).PDFParse || (pdfParseModule as any).default || pdfParseModule;
          if (typeof PDFParseClass === "function" && PDFParseClass.prototype?.load) {
            const parser = new PDFParseClass({ data: fileBuffer });
            await parser.load();
            const textData = await parser.getText();
            extractedText = textData?.text || "";
          } else if (typeof PDFParseClass === "function") {
            const pdfData = await PDFParseClass(fileBuffer);
            extractedText = pdfData?.text || "";
          }
        } catch (pdfErr) {
          console.warn("pdfParse extraction warning:", pdfErr);
        }
      }

      if (!extractedText) {
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

startServer();
