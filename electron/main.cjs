const { app, BrowserWindow, Menu, ipcMain, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");

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

// Helper: 智能定位本地电脑（桌面/下载/文档/U盘/OneDrive）真实存在的发票台账 Excel 文件
function findInvoiceFileOnDisk(preferredFileName) {
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

  // Windows 系统特有支持：OneDrive 桌面、D盘/E盘/U盘根目录
  if (process.platform === "win32") {
    const oneDriveDesktop = path.join(homeDir, "OneDrive", "Desktop");
    const oneDriveDocs = path.join(homeDir, "OneDrive", "Documents");
    if (fs.existsSync(oneDriveDesktop)) searchDirs.push(oneDriveDesktop);
    if (fs.existsSync(oneDriveDocs)) searchDirs.push(oneDriveDocs);

    const winDrives = ["D:\\", "E:\\", "F:\\", "G:\\"];
    winDrives.forEach((drv) => {
      if (fs.existsSync(drv)) {
        searchDirs.push(drv);
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
  return findInvoiceFileOnDisk(fileName);
});

ipcMain.handle("open-file-folder", async (event, payload) => {
  const fileName = payload ? payload.fileName : undefined;
  const diskCheck = findInvoiceFileOnDisk(fileName);
  if (diskCheck.exists && diskCheck.filePath) {
    if (process.platform === "darwin") {
      child_process.execFile("open", ["-R", diskCheck.filePath]);
    } else if (process.platform === "win32") {
      child_process.exec(`explorer.exe /select,"${diskCheck.filePath}"`);
    }
    return { success: true, filePath: diskCheck.filePath };
  }
  return { success: false, message: "文件不存在" };
});

ipcMain.handle("save-excel-direct", async (event, payload) => {
  try {
    const { fileName, base64Data, mode } = payload || {};
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

    const diskCheck = findInvoiceFileOnDisk(fileName);
    let targetPath = diskCheck.exists ? diskCheck.filePath : null;

    if (!targetPath) {
      let desktopPath;
      try {
        desktopPath = app.getPath("desktop");
      } catch (e) {
        desktopPath = path.join(os.homedir(), "Desktop");
      }
      if (fs.existsSync(desktopPath)) {
        targetPath = path.join(desktopPath, fileName || "发票台账明细表.xlsx");
      } else {
        targetPath = path.join(os.homedir(), "Downloads", fileName || "发票台账明细表.xlsx");
      }
    }

    let XLSX;
    try {
      XLSX = require("xlsx-js-style");
    } catch (e) {
      try {
        const srv = require(path.join(__dirname, "../dist/server.cjs"));
        XLSX = srv.XLSX || srv.default?.XLSX;
      } catch (e2) {}
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
    backgroundColor: "#f8fafc", // 设置默认优雅背景色
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

  const startUrl = `http://127.0.0.1:${PORT}`;
  let retryCount = 0;
  const MAX_RETRIES = 20;
  const loadApp = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.loadURL(startUrl).catch(() => {
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        setTimeout(loadApp, 300);
      } else {
        const indexPath = path.join(__dirname, "../dist/index.html");
        if (fs.existsSync(indexPath)) {
          mainWindow.loadFile(indexPath);
        }
      }
    });
  };
  loadApp();

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
  // 稍作停顿等待 Express 后台程序启动
  setTimeout(createWindow, 800);

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
