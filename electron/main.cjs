if (typeof globalThis.ReadableStream === "undefined") {
  try {
    const { ReadableStream } = require("stream/web");
    globalThis.ReadableStream = ReadableStream;
  } catch (e) {}
}

const { app, BrowserWindow, Menu, ipcMain, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");

// 统一设置应用名称
app.name = "智能发票管理助手";

// 关键：Windows 系统任务栏图标绑定与识别（彻底解决 Win 打开后任务栏图标不全/空白/默认图标问题）
if (process.platform === "win32") {
  app.setAppUserModelId("com.invoice.assistant");
}

// 兼容 Win7 老旧 GPU 显卡，避免黑屏与白屏崩溃
app.disableHardwareAcceleration();

let mainWindow = null;
let serverProcess = null;

const PORT = process.env.PORT || 3000;

// Helper: 多重路径兜底定位应用高清图标（支持开发环境、ASAR打包、生产资源目录）
function getAppIcon() {
  const possiblePaths = [
    path.join(__dirname, "../assets/icon.png"),
    path.join(__dirname, "../dist/icon.png"),
    path.join(__dirname, "icon.png"),
    path.join(process.resourcesPath || "", "assets/icon.png"),
    path.join(process.resourcesPath || "", "icon.png"),
    path.join(app.getAppPath ? app.getAppPath() : __dirname, "assets/icon.png"),
    path.join(app.getAppPath ? app.getAppPath() : __dirname, "dist/icon.png"),
    path.join(app.getAppPath ? app.getAppPath() : __dirname, "electron/icon.png"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const icon = nativeImage.createFromPath(p);
        if (!icon.isEmpty()) {
          return { iconPath: p, nativeImg: icon };
        }
      } catch (e) {}
    }
  }
  return { iconPath: path.join(__dirname, "../assets/icon.png"), nativeImg: null };
}

// Helper: 智能定位本地电脑（桌面/下载/文档/U盘/OneDrive/指定目录）真实存在的发票台账 Excel 文件
function findInvoiceFileOnDisk(preferredFileName, preferredFilePath) {
  // 1. 最高优先级：如果传入了具体的物理路径且文件真实存在于磁盘上，100% 绝对精准优先命中！
  if (preferredFilePath && typeof preferredFilePath === "string" && preferredFilePath.trim()) {
    try {
      if (fs.existsSync(preferredFilePath)) {
        return {
          exists: true,
          filePath: preferredFilePath,
          fileName: path.basename(preferredFilePath),
        };
      }
    } catch (e) {}
  }

  const homeDir = os.homedir();
  const searchDirs = [];

  try {
    if (app.isReady()) {
      searchDirs.push(app.getPath("desktop"));
      searchDirs.push(app.getPath("downloads"));
      searchDirs.push(app.getPath("documents"));
    }
  } catch (e) {}

  searchDirs.push(path.join(homeDir, "Desktop"));
  searchDirs.push(path.join(homeDir, "Downloads"));
  searchDirs.push(path.join(homeDir, "Documents"));
  // Linux / 统信 UOS 中文常用主目录支持：
  searchDirs.push(path.join(homeDir, "桌面"));
  searchDirs.push(path.join(homeDir, "下载"));
  searchDirs.push(path.join(homeDir, "文档"));

  // Linux / 统信 UOS 特有支持：外接U盘/移动硬盘/本地多分区(C/D/E盘映射)/数据盘挂载目录 (/media, /run/media, /mnt, /data)
  if (process.platform === "linux") {
    const linuxMountRoots = ["/media", "/run/media", "/mnt", "/data"];
    let username = "";
    try {
      username = os.userInfo().username || path.basename(homeDir);
    } catch (e) {
      username = path.basename(homeDir);
    }

    // 统信 UOS 独有架构：独立 /data 数据盘支持
    if (fs.existsSync("/data")) {
      searchDirs.push("/data");
      const dataInvoice = path.join("/data", "发票");
      const dataFinance = path.join("/data", "财务");
      if (fs.existsSync(dataInvoice)) searchDirs.push(dataInvoice);
      if (fs.existsSync(dataFinance)) searchDirs.push(dataFinance);
      if (username) {
        const dataUser = path.join("/data", "home", username);
        if (fs.existsSync(dataUser)) searchDirs.push(dataUser);
      }
    }

    linuxMountRoots.forEach((mRoot) => {
      if (fs.existsSync(mRoot)) {
        searchDirs.push(mRoot);
        if (username) {
          const userMedia = path.join(mRoot, username);
          if (fs.existsSync(userMedia)) {
            searchDirs.push(userMedia);
            try {
              const usbs = fs.readdirSync(userMedia);
              usbs.forEach((u) => {
                const usbPath = path.join(userMedia, u);
                searchDirs.push(usbPath);
                const sub1 = path.join(usbPath, "发票");
                const sub2 = path.join(usbPath, "财务");
                if (fs.existsSync(sub1)) searchDirs.push(sub1);
                if (fs.existsSync(sub2)) searchDirs.push(sub2);
              });
            } catch (e) {}
          }
        }
      }
    });
  }

  // Windows 系统特有支持：OneDrive 桌面、D盘/E盘/U盘根目录及常用发票目录
  if (process.platform === "win32") {
    const oneDriveDesktop = path.join(homeDir, "OneDrive", "Desktop");
    const oneDriveDocs = path.join(homeDir, "OneDrive", "Documents");
    if (fs.existsSync(oneDriveDesktop)) searchDirs.push(oneDriveDesktop);
    if (fs.existsSync(oneDriveDocs)) searchDirs.push(oneDriveDocs);

    const winDrives = ["D:\\", "E:\\", "F:\\", "G:\\", "H:\\", "I:\\", "U:\\"];
    winDrives.forEach((drv) => {
      if (fs.existsSync(drv)) {
        searchDirs.push(drv);
        const sub1 = path.join(drv, "发票");
        const sub2 = path.join(drv, "财务");
        if (fs.existsSync(sub1)) searchDirs.push(sub1);
        if (fs.existsSync(sub2)) searchDirs.push(sub2);
      }
    });
  }

  // macOS 系统特有支持：外接硬盘 /Volumes
  if (process.platform === "darwin" && fs.existsSync("/Volumes")) {
    try {
      const vols = fs.readdirSync("/Volumes");
      vols.forEach((v) => {
        searchDirs.push(path.join("/Volumes", v));
      });
    } catch (e) {}
  }

  // 去重搜索路径
  const uniqueDirs = Array.from(new Set(searchDirs.filter(Boolean)));

  if (preferredFileName) {
    for (const d of uniqueDirs) {
      if (fs.existsSync(d)) {
        const target = path.join(d, preferredFileName);
        if (fs.existsSync(target)) {
          return { exists: true, filePath: target, fileName: preferredFileName };
        }
      }
    }
  }

  for (const d of uniqueDirs) {
    if (fs.existsSync(d)) {
      try {
        const files = fs.readdirSync(d);
        const match = files.find(
          (f) =>
            (f.includes("发票台账") || f.includes("发票明细") || f.includes("发票")) &&
            (f.endsWith(".xlsx") || f.endsWith(".xls")) &&
            !f.startsWith("~$")
        );
        if (match) {
          return { exists: true, filePath: path.join(d, match), fileName: match };
        }
      } catch (e) {}
    }
  }

  const defaultDesktop = (() => {
    try {
      return app.isReady() ? app.getPath("desktop") : path.join(homeDir, "Desktop");
    } catch (e) {
      return path.join(homeDir, "Desktop");
    }
  })();

  return { exists: false, filePath: path.join(defaultDesktop, preferredFileName || "发票台账明细表.xlsx"), fileName: preferredFileName || "发票台账明细表.xlsx" };
}

// 注册原生 IPC 通信：彻底摆脱网络端口与跨域限制，100% 毫秒级原生读写本地 Excel
ipcMain.handle("check-file-exists", async (event, payload) => {
  const fileName = payload ? payload.fileName : undefined;
  const filePath = payload ? payload.filePath : undefined;
  return findInvoiceFileOnDisk(fileName, filePath);
});

ipcMain.handle("open-file-folder", async (event, payload) => {
  const fileName = payload ? payload.fileName : undefined;
  const filePath = payload ? payload.filePath : undefined;
  const diskCheck = findInvoiceFileOnDisk(fileName, filePath);
  if (diskCheck.exists && diskCheck.filePath) {
    if (process.platform === "darwin") {
      child_process.execFile("open", ["-R", diskCheck.filePath]);
    } else if (process.platform === "win32") {
      child_process.exec(`explorer.exe /select,"${diskCheck.filePath}"`);
    } else {
      // Linux / 统信 UOS / 麒麟系统
      const { shell } = require("electron");
      if (shell && shell.showItemInFolder) {
        shell.showItemInFolder(diskCheck.filePath);
      } else {
        child_process.spawn("xdg-open", [path.dirname(diskCheck.filePath)], { detached: true });
      }
    }
    return { success: true, filePath: diskCheck.filePath };
  }
  return { success: false, message: "文件不存在" };
});

ipcMain.handle("select-excel-file", async (event) => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const result = await dialog.showOpenDialog(win, {
    title: "选择现有的发票台账 Excel 文件",
    filters: [{ name: "Excel 工作簿 (*.xlsx, *.xls)", extensions: ["xlsx", "xls"] }],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const chosenPath = result.filePaths[0];
  return {
    canceled: false,
    exists: true,
    filePath: chosenPath,
    fileName: path.basename(chosenPath),
  };
});

function findTessdataPath() {
  const candidates = [
    path.join(__dirname, "../public/tessdata"),
    path.join(__dirname, "../dist/tessdata"),
    path.join(__dirname, "tessdata"),
    path.join(process.resourcesPath || "", "public/tessdata"),
    path.join(process.resourcesPath || "", "app.asar.unpacked/public/tessdata"),
    path.join(process.resourcesPath || "", "dist/tessdata"),
    path.join(process.resourcesPath || "", "tessdata"),
    path.join(process.cwd(), "public/tessdata"),
    path.join(process.cwd(), "dist/tessdata"),
    path.join(process.cwd(), "tessdata"),
    process.cwd(),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      if (
        fs.existsSync(path.join(c, "chi_sim.traineddata")) ||
        fs.existsSync(path.join(c, "chi_sim.traineddata.gz"))
      ) {
        return c;
      }
    }
  }
  return path.join(process.cwd(), "public/tessdata");
}

ipcMain.handle("parse-invoice-native", async (event, payload) => {
  try {
    const { fileBase64, mimeType, fileName } = payload || {};
    if (!fileBase64) return { success: false, error: "缺少文件数据" };

    const base64Data = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
    const fileBuffer = Buffer.from(base64Data, "base64");

    const isPdf =
      (mimeType && mimeType.includes("pdf")) ||
      (fileName && fileName.toLowerCase().endsWith(".pdf")) ||
      fileBase64.startsWith("data:application/pdf");

    let extractedText = "";

    if (isPdf) {
      const pdfTask = (async () => {
        try {
          const pdfParseModule = require("pdf-parse");
          const PDFParseClass = pdfParseModule.PDFParse || pdfParseModule.default || pdfParseModule;
          if (typeof PDFParseClass === "function" && PDFParseClass.prototype?.load) {
            const parser = new PDFParseClass({ data: fileBuffer });
            await parser.load();
            const textData = await parser.getText();
            return textData?.text || "";
          } else if (typeof PDFParseClass === "function") {
            const pdfData = await PDFParseClass(fileBuffer);
            return pdfData?.text || "";
          }
        } catch (pdfErr) {
          console.warn("[Electron Native] PDF extraction warning:", pdfErr);
        }
        return "";
      })();

      const pdfTimeout = new Promise((resolve) => setTimeout(() => resolve(""), 2500));
      extractedText = await Promise.race([pdfTask, pdfTimeout]);
    } else {
      // 纯图片文件（PNG / JPG / 收据截图）：调用 Node 离线 Tesseract OCR
      const ocrTask = (async () => {
        let worker = null;
        try {
          const { createWorker, PSM } = require("tesseract.js");
          const localLangPath = findTessdataPath();

          worker = await createWorker("chi_sim+eng", 1, {
            langPath: localLangPath,
            logger: () => {},
            errorHandler: () => {},
          });
          await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
          const ocrRet = await worker.recognize(fileBuffer);
          if (ocrRet && ocrRet.data && ocrRet.data.text) {
            return ocrRet.data.text.trim();
          }
        } catch (ocrErr) {
          console.warn("[Electron Native] OCR extraction warning:", ocrErr);
        } finally {
          if (worker) {
            try {
              await worker.terminate();
            } catch (e) {}
          }
        }
        return "";
      })();

      const ocrTimeout = new Promise((resolve) => setTimeout(() => resolve(""), 3500));
      const ocrText = await Promise.race([ocrTask, ocrTimeout]);
      if (ocrText) {
        extractedText = (extractedText + "\n" + ocrText).trim();
      }
    }

    return {
      success: true,
      engine: "electron_native",
      extractedText: extractedText || "",
      fileName: fileName || "",
    };
  } catch (err) {
    console.error("[Electron Native] Parse invoice error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("save-excel-direct", async (event, payload) => {
  try {
    const { fileName, filePath, base64Data, mode, protect, password } = payload || {};
    if (!base64Data) {
      return { success: false, message: "缺少 Excel 数据" };
    }
    const incomingBuffer = Buffer.from(base64Data, "base64");

    // 核心优化：当用户选择【保存为全新的 Excel 文件...】时，调起系统原生「另存为」窗口让用户自由选择任意文件夹/磁盘位置与文件名
    if (mode === "new" || mode === "saveAs") {
      let defaultDesktop;
      try {
        defaultDesktop = app.isReady() ? app.getPath("desktop") : path.join(os.homedir(), "Desktop");
      } catch (e) {
        defaultDesktop = path.join(os.homedir(), "Desktop");
      }
      const initialPath = path.join(defaultDesktop, fileName || `发票台账明细表_${Date.now()}.xlsx`);

      const win = BrowserWindow.getFocusedWindow() || mainWindow;
      const saveResult = await dialog.showSaveDialog(win, {
        title: "选择 Excel 发票台账保存位置",
        defaultPath: initialPath,
        filters: [{ name: "Excel 工作簿 (*.xlsx)", extensions: ["xlsx"] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, canceled: true, message: "已取消保存" };
      }

      fs.writeFileSync(saveResult.filePath, incomingBuffer);
      return {
        success: true,
        filePath: saveResult.filePath,
        fileName: path.basename(saveResult.filePath),
        message: `成功保存全新 Excel 文件至：${saveResult.filePath}`,
      };
    }

    const diskCheck = findInvoiceFileOnDisk(fileName, filePath);
    let targetPath = diskCheck.exists ? diskCheck.filePath : (filePath && fs.existsSync(path.dirname(filePath)) ? filePath : null);

    if (!targetPath) {
      let desktopPath;
      try {
        desktopPath = app.getPath("desktop");
      } catch (e) {
        desktopPath = path.join(os.homedir(), "Desktop");
      }
      if (fs.existsSync(desktopPath)) {
        targetPath = path.join(desktopPath, fileName || "发票台账明细表.xlsx");
      } else if (fs.existsSync(path.join(os.homedir(), "桌面"))) {
        targetPath = path.join(os.homedir(), "桌面", fileName || "发票台账明细表.xlsx");
      } else if (fs.existsSync(path.join(os.homedir(), "下载"))) {
        targetPath = path.join(os.homedir(), "下载", fileName || "发票台账明细表.xlsx");
      } else {
        targetPath = path.join(os.homedir(), "Downloads", fileName || "发票台账明细表.xlsx");
      }
    }

    let XLSX;
    try {
      XLSX = require("xlsx-js-style");
    } catch (e) {
      console.warn("Failed to require xlsx-js-style:", e);
    }

    if (mode === "append" && diskCheck.exists && targetPath && fs.existsSync(targetPath) && XLSX) {
      try {
        const existingWb = XLSX.readFile(targetPath);
        const firstSheetName = existingWb.SheetNames[0];
        const existingSheet = existingWb.Sheets[firstSheetName];
        const rawExistingRows = XLSX.utils.sheet_to_json(existingSheet, { defval: "" });

        const incomingWb = XLSX.read(incomingBuffer, { type: "buffer" });
        const incomingSheet = incomingWb.Sheets[incomingWb.SheetNames[0]];
        const rawIncomingRows = XLSX.utils.sheet_to_json(incomingSheet, { defval: "" });

        // 过滤掉原本文件中因为历史错误被误写入的空行，并清理旧版遗留的 导入时间 列
        const cleanedExistingRows = rawExistingRows
          .filter((r) => {
            const isSummary = String(r["序号"] || "").startsWith("统计");
            const hasData = Boolean(r["发票号码"] || r["开票日期"] || r["价税合计"]);
            return isSummary || hasData;
          })
          .map((r) => {
            if ("导入时间" in r) {
              const copy = { ...r };
              delete copy["导入时间"];
              return copy;
            }
            return r;
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
        const invoiceNumCounts = {};
        allRows.forEach((row, idx) => {
          const isSummary = String(row["序号"] || "").startsWith("统计");
          if (isSummary) return;
          const num = String(row["发票号码"] || "").trim();
          if (num && num !== "-" && num !== "无") {
            if (!invoiceNumCounts[num]) invoiceNumCounts[num] = [];
            invoiceNumCounts[num].push(idx);
          }
        });

        const dupRowIndices = new Set();
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

        // 合并所有批次统计汇总行的 A 列与 B 列 (序号与开票日期)
        const merges = [];
        allRows.forEach((row, rowIdx) => {
          const isSummary = String(row["序号"] || "").startsWith("统计");
          if (isSummary) {
            merges.push({
              s: { r: rowIdx + 1, c: 0 }, // A 列 (序号)
              e: { r: rowIdx + 1, c: 1 }, // B 列 (开票日期)
            });
          }
        });
        if (merges.length > 0) {
          mergedWorksheet["!merges"] = merges;
        }

        // 关键保护机制：如果在旧表或新表中有设置 !protect（密码与防篡改规则），合并追加时 100% 继承并生效
        if (protect || password) {
          mergedWorksheet["!protect"] = {
            password: password || "123456",
          };
        }

        const mergedWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(mergedWorkbook, mergedWorksheet, "发票台账数据");
        XLSX.writeFile(mergedWorkbook, targetPath);

        const incomingInvoiceCount = rawIncomingRows.filter((r) => !String(r["序号"] || "").startsWith("统计")).length;

        return {
          success: true,
          filePath: targetPath,
          fileName: path.basename(targetPath),
          totalCount: realInvoiceCount,
          appendedCount: incomingInvoiceCount,
          message: dupRowIndices.size > 0
            ? `成功合并追加 ${incomingInvoiceCount} 张新发票！\n文件中共 ${realInvoiceCount} 张发票（分批次归档）。\n⚠️ 发现 ${dupRowIndices.size} 条跨批次重复发票，已自动在 Excel 中明黄色高亮标出！`
            : `成功合并追加 ${incomingInvoiceCount} 张新发票！\n文件中共 ${realInvoiceCount} 张发票（分批次归档），所有发票正常唯一。`,
        };
      } catch (err) {
        console.warn("Append error:", err);
      }
    }

    fs.writeFileSync(targetPath, incomingBuffer);
    return { success: true, filePath: targetPath, fileName: path.basename(targetPath) };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

function startBackendServer() {
  try {
    process.env.NODE_ENV = "production";
    process.env.PORT = String(PORT);
    const serverPath = path.join(__dirname, "../dist/server.cjs");
    if (fs.existsSync(serverPath)) {
      require(serverPath);
      console.log("[Electron Core] Express backend server started directly via require on port " + PORT);
    }
  } catch (err) {
    console.error("[Electron Core] Failed to start backend server:", err);
  }
}

function createWindow() {
  const appIconInfo = getAppIcon();

  // 窗口防白屏优化：先设置 show: false，设置主题背景色，待 DOM 渲染完毕后再 .show()
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false, // 防白屏：初始隐藏
    backgroundColor: "#0A0F1D", // 与启动动画深蓝背景无缝融合，杜绝白屏闪烁
    title: "智能发票管理助手",
    icon: appIconInfo.nativeImg || appIconInfo.iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (appIconInfo.nativeImg) {
    try {
      mainWindow.setIcon(appIconInfo.nativeImg);
    } catch (e) {}
  }

  // 修复 #6: macOS 上 Menu.setApplicationMenu(null) 会导致 Cmd+C/V/A/Q 等所有
  // 系统级快捷键完全失效，因此在 macOS 上保留精简菜单
  if (process.platform === "darwin") {
    const template = [
      {
        label: app.getName(),
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "编辑",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "窗口",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          { role: "close" },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } else {
    // Windows/Linux 上隐藏菜单栏
    Menu.setApplicationMenu(null);
  }

  const isDev = !app.isPackaged;

  const indexPath = path.join(__dirname, "../dist/index.html");
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath).catch((err) => {
      console.warn("Failed to load local index.html, falling back to port:", err);
      mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    });
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  }

  // 核心防白屏：DOM 准备完毕、内容绘制完成后才优雅展现窗口
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on("close", async () => {
    try {
      if (mainWindow && mainWindow.webContents && mainWindow.webContents.session) {
        // 清理临时网络与图片缓存，释放系统内存，保留 localStorage 本地台账数据库
        await mainWindow.webContents.session.clearCache();
      }
    } catch (e) {}
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
