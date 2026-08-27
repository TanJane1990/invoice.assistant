const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const { fork } = require("child_process");

// 兼容 Win7 老旧 GPU 显卡，避免黑屏与白屏崩溃
app.disableHardwareAcceleration();

let mainWindow = null;
let serverProcess = null;

const PORT = process.env.PORT || 3000;

function startBackendServer() {
  const isDev = !app.isPackaged;

  if (isDev) {
    console.log("[Electron] Dev mode: using external dev server on port " + PORT);
    return;
  }

  // 生产模式下（打包为 ASAR）：直接通过 require 加载 server.cjs 模块
  // 避免 child_process.fork 在 asar 虚拟路径中无法找到 Node 执行文件的错误
  try {
    process.env.NODE_ENV = "production";
    process.env.PORT = String(PORT);
    const serverPath = path.join(__dirname, "../dist/server.cjs");
    require(serverPath);
    console.log("[Electron Core] Express backend server started directly via require.");
  } catch (err) {
    console.error("[Electron Core] Failed to start backend server:", err);
  }
}

function createWindow() {
  // 窗口防白屏优化：先设置 show: false，设置主题背景色，待 DOM 渲染完毕后再 .show()
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false, // 防白屏：初始隐藏
    backgroundColor: "#f8fafc", // 设置默认优雅背景色
    title: "智能发票管理助手",
    icon: path.join(__dirname, "../assets/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

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

  if (isDev) {
    const startUrl = `http://127.0.0.1:${PORT}`;
    let retryCount = 0;
    const MAX_RETRIES = 30;
    const loadApp = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (retryCount >= MAX_RETRIES) {
        console.error("[Electron] Dev server failed to start after " + MAX_RETRIES + " retries, quitting.");
        app.quit();
        return;
      }
      retryCount++;
      mainWindow.loadURL(startUrl).catch(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          setTimeout(loadApp, 500);
        }
      });
    };
    loadApp();
  } else {
    // 生产模式：直接使用 native loadFile 加载本地静态页面，实现 0ms 秒开、免防火墙及彻底消除白屏
    const indexPath = path.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error("[Electron] Failed to load local index.html:", err);
    });
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
