#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const appId = "com.invoice.assistant";
const appName = "智能发票管理助手";
const version = pkg.version || "1.2.0";
const archArg = process.argv[2] || "amd64"; // amd64 or arm64

console.log(`[UOS Store Packager] Starting packaging for ${appId} v${version} (${archArg})...`);

const unpackedDir = path.join(rootDir, "dist_electron", archArg === "arm64" ? "linux-arm64-unpacked" : "linux-unpacked");
let sourceDir = unpackedDir;
if (!fs.existsSync(sourceDir)) {
  const debCandidate = path.join(rootDir, "dist_electron", `smart-invoice-assistant_${version}_${archArg}.deb`);
  if (fs.existsSync(debCandidate)) {
    console.log(`[UOS Store Packager] Unpacked dir ${unpackedDir} not found. Extracting from ${debCandidate}...`);
    const tempExtract = path.join(rootDir, "dist_electron", `temp_deb_extract_${archArg}`);
    if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
    fs.mkdirSync(tempExtract, { recursive: true });
    execSync(`dpkg -x "${debCandidate}" "${tempExtract}"`, { stdio: "inherit" });
    const optPath = path.join(tempExtract, "opt");
    if (fs.existsSync(optPath)) {
      const subDirs = fs.readdirSync(optPath);
      if (subDirs.length > 0) {
        sourceDir = path.join(optPath, subDirs[0]);
      }
    }
  }
}

if (!fs.existsSync(sourceDir)) {
  console.error(`[UOS Store Packager] Error: Source directory or deb not found for ${archArg}`);
  console.error(`Please run electron-builder first.`);
  process.exit(1);
}

const buildRoot = path.join(rootDir, "dist_electron", `uos_store_build_${archArg}`);
if (fs.existsSync(buildRoot)) {
  fs.rmSync(buildRoot, { recursive: true, force: true });
}

// 严格遵循统信官方 UOSDN 应用打包规范：
// /opt/apps/${appid}/
// ├── entries
// │   ├── applications
// │   └── icons
// ├── files
// └── info
const optAppDir = path.join(buildRoot, "opt", "apps", appId);
const filesDir = path.join(optAppDir, "files");
const entriesDir = path.join(optAppDir, "entries");
const appsDesktopDir = path.join(entriesDir, "applications");
const iconsDir = path.join(entriesDir, "icons", "hicolor", "512x512", "apps");
const debianDir = path.join(buildRoot, "DEBIAN");

fs.mkdirSync(filesDir, { recursive: true });
fs.mkdirSync(appsDesktopDir, { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(debianDir, { recursive: true });

console.log(`[UOS Store Packager] Copying application files to /opt/apps/${appId}/files/ ...`);
execSync(`cp -rf "${sourceDir}"/* "${filesDir}/"`, { stdio: "inherit" });

// 复制高清图标
const iconSrc = path.join(rootDir, "assets", "icon.png");
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(iconsDir, `${appId}.png`));
}

// 生成统信官方 info 规范描述文件
const infoContent = {
  appid: appId,
  name: appName,
  version: version,
  arch: [archArg],
  permissions: {
    autostart: false,
    notification: false,
    trayicon: false,
    clipboard: true,
    account: false,
    bluetooth: false,
    camera: false,
    audio_record: false,
    installed_apps: false
  },
  "support-plugins": [],
  plugins: []
};
fs.writeFileSync(path.join(optAppDir, "info"), JSON.stringify(infoContent, null, 4), "utf8");

// 生成符合统信规范的 .desktop 文件
const desktopContent = `[Desktop Entry]
Categories=Office;Finance;Utility;
Name=${appName}
Name[zh_CN]=${appName}
Comment=${pkg.description || appName}
Comment[zh_CN]=${pkg.description || appName}
Exec=/opt/apps/${appId}/files/smart-invoice-assistant %U
Icon=${appId}
Type=Application
Terminal=false
StartupWMClass=${appName}
StartupNotify=true
MimeType=application/pdf;image/png;image/jpeg;
`;
fs.writeFileSync(path.join(appsDesktopDir, `${appId}.desktop`), desktopContent, "utf8");

function getDirSize(dir) {
  let size = 0;
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) size += getDirSize(full);
      else size += stat.size;
    }
  } catch (e) {}
  return size;
}

// 生成标准的 DEBIAN/control 文件 (必须严格符合 RFC822 规范，包含邮箱，换行必须为LF)
const controlContent = `Package: ${appId}
Version: ${version}
Section: utils
Priority: optional
Architecture: ${archArg}
Maintainer: ${pkg.author || "谭彬"} <cjtanbin@163.com>
Installed-Size: ${Math.round(getDirSize(filesDir) / 1024)}
Description: ${pkg.description || appName}
 专为企业财务与个人报销设计的智能发票管理助手，支持增值税发票全票面OCR识别、PDF发票排版打印、A4一键拼页与发票台账Excel导出。
`.replace(/\r\n/g, "\n");
fs.writeFileSync(path.join(debianDir, "control"), controlContent, "utf8");

// 设置统信官方规范要求的严格文件权限
try {
  fs.chmodSync(debianDir, 0o755);
  fs.chmodSync(path.join(debianDir, "control"), 0o644);
  fs.chmodSync(path.join(optAppDir, "info"), 0o644);
  fs.chmodSync(path.join(appsDesktopDir, `${appId}.desktop`), 0o644);
} catch (e) {}

// 使用 dpkg-deb 打包
// 关键重点：Ubuntu 22.04+ 默认采用 zstd 压缩，而统信应用商店后台只支持 xz/gzip！
// 若未指定 -Zxz，生成的 control.tar.zst 会导致统信商店报错：“包格式不正确,没有解析到control文件”
const outDebName = `${appId}_${version}_${archArg}_uos_store.deb`;
const outDebPath = path.join(rootDir, "dist_electron", outDebName);

console.log(`[UOS Store Packager] Building Debian package with -Zxz: ${outDebPath} ...`);
try {
  execSync(`dpkg-deb -Zxz --root-owner-group -b "${buildRoot}" "${outDebPath}"`, { stdio: "inherit" });
  console.log(`[UOS Store Packager] SUCCESS: Built official UOS Store compliant package at ${outDebPath}`);
} catch (err) {
  console.warn(`[UOS Store Packager] dpkg-deb not available or failed. Directory prepared at ${buildRoot}`);
} finally {
  const tempExtract = path.join(rootDir, "dist_electron", `temp_deb_extract_${archArg}`);
  if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
  if (fs.existsSync(buildRoot)) fs.rmSync(buildRoot, { recursive: true, force: true });
}
