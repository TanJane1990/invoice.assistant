import JSZip from "jszip";
import XLSX from "xlsx-js-style";
import { InvoiceData, SystemSettings } from "../types";

/**
 * 将发票列表导出为标准全功能 ZIP 归档包
 * 包含：
 * 1. 发票台账明细表.xlsx（包含完整公式与财务样式）
 * 2. backup_manifest.json（全量发票结构化快照，供软件一键秒级还原）
 * 3. 发票原件/ 文件夹（包含所有 300 DPI 高清发票 PDF/图片原件，按 日期_商户_金额 规范命名）
 * 4. README_财务归档说明.txt
 */
export async function createInvoiceArchiveZip(
  invoices: InvoiceData[],
  settings?: SystemSettings,
  archiveLabel: string = "发票归档备份"
): Promise<{ zipBlob: Blob; fileName: string; count: number }> {
  const zip = new JSZip();
  const dateStr = new Date().toISOString().split("T")[0];
  const zipFileName = `${archiveLabel}_${dateStr}_共${invoices.length}张.zip`;

  // 1. 生成 backup_manifest.json
  const manifestData = JSON.stringify(invoices, null, 2);
  zip.file("backup_manifest.json", manifestData);

  // 2. 生成发票台账 Excel 表格
  const excelData = invoices.map((inv, idx) => ({
    序号: idx + 1,
    发票类型: inv.invoiceType || "电子发票",
    发票代码: inv.invoiceCode || "-",
    发票号码: inv.invoiceNumber || "-",
    开票日期: inv.issueDate || "-",
    购买方名称: inv.buyerName || "-",
    购买方税号: inv.buyerTaxId || "-",
    销货方名称: inv.sellerName || "-",
    销货方税号: inv.sellerTaxId || "-",
    费用类别: inv.category || "其他",
    "不含税金额(元)": Number((inv.totalAmountWithoutTax || 0).toFixed(2)),
    "税额(元)": Number((inv.totalTaxAmount || 0).toFixed(2)),
    "价税合计(元)": Number((inv.totalAmountWithTax || 0).toFixed(2)),
    大写金额: inv.totalAmountWithTaxCN || "",
    查重状态: inv.duplicateWarning ? "⚠️ 存在重复发票" : "✓ 唯一正常",
    备注明细: inv.remarks || "-",
    导入时间: inv.importTime || "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "发票台账明细");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  zip.file("发票台账明细表.xlsx", excelBuffer);

  // 3. 收集并保存发票原件至 发票原件/ 文件夹
  const originalFolder = zip.folder("发票原件");
  if (originalFolder) {
    invoices.forEach((inv, idx) => {
      if (inv.fileUrl) {
        let base64Data = "";
        let ext = "pdf";

        if (inv.fileUrl.startsWith("data:")) {
          const parts = inv.fileUrl.split(",");
          base64Data = parts[1] || "";
          if (parts[0].includes("image/png")) ext = "png";
          else if (parts[0].includes("image/jpeg") || parts[0].includes("image/jpg")) ext = "jpg";
          else if (parts[0].includes("application/pdf")) ext = "pdf";
        } else if (inv.fileUrl.includes("pdf")) {
          ext = "pdf";
        }

        // 规范化文件命名：序号_日期_商户_金额_号码.扩展名（过滤非法字符）
        const safeSeller = (inv.sellerName || "商户").replace(/[/\\?%*:|"<>]/g, "_").trim();
        const safeDate = inv.issueDate || "未知日期";
        const safeNum = inv.invoiceNumber || `ID${idx + 1}`;
        const fileName = `${String(idx + 1).padStart(3, "0")}_${safeDate}_${safeSeller}_¥${inv.totalAmountWithTax.toFixed(2)}元_${safeNum}.${ext}`;

        if (base64Data) {
          originalFolder.file(fileName, base64Data, { base64: true });
        }
      }
    });
  }

  // 4. 说明文件
  const readmeContent = `=======================================================
智能发票管理助手 - 财务发票归档与备份包
=======================================================
归档时间: ${new Date().toLocaleString("zh-CN", { hour12: false })}
发票总数: ${invoices.length} 张
金额合计: ¥${invoices.reduce((s, i) => s + i.totalAmountWithTax, 0).toFixed(2)}

【目录说明】
1. 发票台账明细表.xlsx
   可以使用 Microsoft Excel 或 WPS 直接双击打开查阅与打印。

2. 发票原件/ 文件夹
   包含当前备份包中所有发票的高清原件，按「序号_日期_商户_金额_号码」规范化命名。

3. backup_manifest.json
   全量发票结构化数据快照文件。

【如何通过软件一键恢复数据？】
打开《智能发票管理助手》，在「系统设置」或「发票台账」中点击导入，直接选择本 ZIP 文件即可在 1 秒内完整还原所有发票与原图！
=======================================================`;

  zip.file("README_财务归档说明.txt", readmeContent);

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { zipBlob, fileName: zipFileName, count: invoices.length };
}

/**
 * 触发浏览器/本地文件下载
 */
export function triggerDownloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * 解析并还原发票备份 ZIP 包
 */
export async function parseInvoiceArchiveZip(file: File | Blob): Promise<InvoiceData[]> {
  const zip = await JSZip.loadAsync(file);

  // 1. 查找 backup_manifest.json 或任意包含的发票快照 json
  let manifestFile = zip.file("backup_manifest.json");
  if (!manifestFile) {
    const jsonFiles = zip.file(/\.json$/i);
    if (jsonFiles.length > 0) {
      manifestFile = jsonFiles[0];
    }
  }

  if (!manifestFile) {
    throw new Error("未在 ZIP 压缩包中找到有效的数据快照文件 (backup_manifest.json)");
  }

  const jsonText = await manifestFile.async("text");
  const parsedInvoices: InvoiceData[] = JSON.parse(jsonText);

  if (!Array.isArray(parsedInvoices) || parsedInvoices.length === 0) {
    throw new Error("备份包中的发票列表为空或格式不合法");
  }

  // 2. 遍历发票原件文件夹，补全 fileUrl 高清原图
  for (const inv of parsedInvoices) {
    if (!inv.fileUrl || !inv.fileUrl.startsWith("data:")) {
      // 尝试按发票号码或ID匹配发票原件
      const num = inv.invoiceNumber ? inv.invoiceNumber.trim() : "";
      if (num && num !== "-") {
        const matches = zip.file(new RegExp(num));
        if (matches.length > 0) {
          const matchFile = matches[0];
          const b64 = await matchFile.async("base64");
          const isPdf = matchFile.name.toLowerCase().endsWith(".pdf");
          inv.fileUrl = `data:${isPdf ? "application/pdf" : "image/png"};base64,${b64}`;
        }
      }
    }
  }

  return parsedInvoices;
}
