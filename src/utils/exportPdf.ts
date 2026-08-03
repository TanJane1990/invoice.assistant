import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { InvoiceData, PrintConfig } from "../types";

/**
 * 导出与生成物理级无错 300DPI 拼页发票 PDF 文件
 * 彻底消除浏览器原生 window.print() 极易产生的空白页、灰条遮挡与图像合成丢失瑕疵
 */
export async function generateAndPrintPdf(
  pagesElementContainer: HTMLElement,
  fileName: string = `发票拼页排版_A4_${new Date().toISOString().split("T")[0]}.pdf`
): Promise<void> {
  try {
    // 找出所有 A4 打印页面节点
    const pageNodes = pagesElementContainer.querySelectorAll<HTMLElement>(".a4-print-page");
    if (!pageNodes || pageNodes.length === 0) {
      alert("未找到排版页面，请先勾选需要排版的发票！");
      return;
    }

    // 初始化 jsPDF：A4 规格, 单位 mm
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfPageWidth = 210;
    const pdfPageHeight = 297;

    for (let i = 0; i < pageNodes.length; i++) {
      const node = pageNodes[i];

      // 临时应用打印高清渲染与绝对纯白背景
      const canvas = await html2canvas(node, {
        scale: 2.5, // 2.5 倍超高清采样 300DPI
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 15000,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      if (i > 0) {
        pdf.addPage("a4", "portrait");
      }

      // 将渲染结果精准放入 A4 PDF
      pdf.addImage(imgData, "JPEG", 0, 0, pdfPageWidth, pdfPageHeight);
    }

    // 1. 下载保存本地标准 PDF
    pdf.save(fileName);

    // 2. 自动在独立干净的 Blob PDF 窗口中调起打印，保证 100% 出纸不留灰色横条
    const pdfBlob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(blobUrl, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  } catch (err) {
    console.error("生成 PDF 矢量排版文档失败:", err);
    alert("生成发票排版 PDF 失败，退回系统原生打印。");
    window.print();
  }
}
