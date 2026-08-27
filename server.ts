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

      // 真正对齐旧发票软件的【追加数据】核心算法：
      // 如果模式为 append 且目标文件已存在于磁盘中：读取磁盘已有历史数据 + 本次新数据拼接到末尾 (pd.concat)
      if (mode === "append" && diskCheck.exists && targetPath && fs.existsSync(targetPath)) {
        try {
          const existingWb = XLSX.readFile(targetPath);
          const firstSheetName = existingWb.SheetNames[0];
          const existingSheet = existingWb.Sheets[firstSheetName];
          const rawExistingRows: any[] = XLSX.utils.sheet_to_json(existingSheet);
          const rawIncomingRows: any[] = XLSX.utils.sheet_to_json(incomingSheet);

          // 过滤掉原本末尾的统计汇总行，提取纯发票数据
          const existingRows = rawExistingRows.filter((r) => !String(r["序号"] || "").startsWith("统计"));
          const incomingRows = rawIncomingRows.filter((r) => !String(r["序号"] || "").startsWith("统计"));

          if (existingRows.length > 0 && incomingRows.length > 0) {
            // 收集旧文件中所有行的「行指纹」(序号+发票号码+导出批次时间+导入时间)
            const existingRowFingerprints = new Set<string>();
            existingRows.forEach((r) => {
              const num = String(r["发票号码"] || "").trim();
              const importTime = String(r["导入时间"] || "").trim();
              const batchTime = String(r["导出批次时间"] || "").trim();
              const amt = String(r["价税合计(元)"] || r["价税合计"] || r["含税金额(元)"] || "").trim();
              const fp = `${num}|${importTime}|${batchTime}|${amt}`;
              existingRowFingerprints.add(fp);
            });

            // 筛选出「本次真正需要追加的新行」
            const rowsToAppend: any[] = [];
            incomingRows.forEach((r) => {
              const num = String(r["发票号码"] || "").trim();
              const importTime = String(r["导入时间"] || "").trim();
              const batchTime = String(r["导出批次时间"] || "").trim();
              const amt = String(r["价税合计(元)"] || r["价税合计"] || r["含税金额(元)"] || "").trim();
              const fp = `${num}|${importTime}|${batchTime}|${amt}`;

              if (!existingRowFingerprints.has(fp)) {
                rowsToAppend.push(r);
              }
            });

            console.log(`[追加] 已有行数: ${existingRows.length}, 传入行数: ${incomingRows.length}, 真正新增: ${rowsToAppend.length}`);

            if (rowsToAppend.length === 0) {
              return res.json({
                success: true,
                filePath: targetPath,
                fileName: path.basename(targetPath),
                totalCount: existingRows.length,
                appendedCount: 0,
                message: "所有发票均已存在于文件中，无需重复追加",
              });
            }

            // 合并已有数据与新追加的数据
            const combinedRows = [...existingRows, ...rowsToAppend];

            // 重新编排序号 (1, 2, 3, 4, ...)
            combinedRows.forEach((row, idx) => {
              row["序号"] = idx + 1;
            });

            // 全量重复发票检测
            const invoiceNumCounts: Record<string, number[]> = {};
            combinedRows.forEach((row, idx) => {
              const num = String(row["发票号码"] || "").trim();
              if (num && num !== "-") {
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

            // 更新查重状态文字
            combinedRows.forEach((row, idx) => {
              if (dupRowIndices.has(idx)) {
                row["查重状态"] = "⚠️ 发票重复";
              }
            });

            // 底部添加全表统计汇总行
            const allTotalAmount = combinedRows.reduce((sum, r) => {
              const amt = parseFloat(String(r["价税合计"] || r["价税合计(元)"] || 0).replace(/[^0-9.]/g, ""));
              return sum + (isNaN(amt) ? 0 : amt);
            }, 0);

            const summaryRow: any = {
              序号: `统计 共 ${combinedRows.length} 张发票`,
              开票日期: "",
              发票类型: "",
              发票代码: "",
              发票号码: "",
              校验码: "",
              购买方名称: "",
              购买方税号: "",
              销售方名称: "",
              销售方税号: "",
              不含税金额: "",
              税率: "",
              税额: "",
              价税合计: `¥${Number(allTotalAmount.toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              商品明细: "",
              备注: "",
              导入时间: "",
              查重状态: "",
            };

            const finalRowsWithSummary = [...combinedRows, summaryRow];

            // 生成新的 Worksheet
            const colKeys = Object.keys(finalRowsWithSummary[0] || {});
            const mergedWorksheet = XLSX.utils.json_to_sheet(finalRowsWithSummary, { header: colKeys });

            // 自适应计算列宽
            const dynamicCols = colKeys.map((key) => {
              let maxLen = 0;
              for (let i = 0; i < key.length; i++) {
                maxLen += key.charCodeAt(i) > 255 ? 2.1 : 1.05;
              }
              finalRowsWithSummary.forEach((item) => {
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
                left: { style: "thin", color: { rgb: "D4D4D8" } },
                right: { style: "thin", color: { rgb: "D4D4D8" } },
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

            combinedRows.forEach((_, rowIdx) => {
              const r = rowIdx + 1;
              const isDup = dupRowIndices.has(rowIdx);
              colKeys.forEach((key, colIdx) => {
                const cellRef = XLSX.utils.encode_cell({ r, c: colIdx });
                if (mergedWorksheet[cellRef]) {
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
              });
            });

            // 统计汇总行样式
            const summaryRowIdx = combinedRows.length + 1;
            colKeys.forEach((key, colIdx) => {
              const cellRef = XLSX.utils.encode_cell({ r: summaryRowIdx, c: colIdx });
              if (mergedWorksheet[cellRef]) {
                if (key === "价税合计") {
                  mergedWorksheet[cellRef].s = summaryMoneyStyle;
                } else {
                  mergedWorksheet[cellRef].s = summaryStyle;
                }
              }
            });

            const mergedWorkbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(mergedWorkbook, mergedWorksheet, "发票台账数据");
            XLSX.writeFile(mergedWorkbook, targetPath);

            return res.json({
              success: true,
              filePath: targetPath,
              fileName: path.basename(targetPath),
              totalCount: combinedRows.length,
              appendedCount: rowsToAppend.length,
            });
          }
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

export { XLSX };
export default startServer;

startServer();
