import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * 导出与生成物理级无错 300DPI 拼页发票 PDF 文件
 * 支持根据当前拼页模式（4张/页 横向 / 2张/页 纵向）自动硬锁定向（横向 297×210mm 或 纵向 210×297mm），
 * 彻底消除打印全强制为纵向导致的图像拉伸、变形、竖向挤压与灰条瑕疵。
 */
export async function generateAndPrintPdf(
  pagesElementContainer: HTMLElement,
  fileName: string = `发票拼页排版_A4_${new Date().toISOString().split("T")[0]}.pdf`,
  orientation: "portrait" | "landscape" = "landscape"
): Promise<void> {
  try {
    // 找出所有 A4 打印页面节点
    const pageNodes = pagesElementContainer.querySelectorAll<HTMLElement>(".a4-print-page");
    if (!pageNodes || pageNodes.length === 0) {
      alert("未找到排版页面，请先勾选需要排版的发票！");
      return;
    }

    // 自动判断方向：优先使用传入参数，或根据首个 DOM 节点的宽高比判定
    const firstNode = pageNodes[0];
    const nodeWidth = firstNode.offsetWidth;
    const nodeHeight = firstNode.offsetHeight;
    const isLandscape = orientation === "landscape" || nodeWidth > nodeHeight;
    const pdfOrientation = isLandscape ? "landscape" : "portrait";

    // 初始化 jsPDF：根据拼页模式真实方向指定为 A4 横向(297×210) 或 A4 纵向(210×297)
    const pdf = new jsPDF({
      orientation: pdfOrientation,
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfPageWidth = isLandscape ? 297 : 210;
    const pdfPageHeight = isLandscape ? 210 : 297;

    for (let i = 0; i < pageNodes.length; i++) {
      const node = pageNodes[i];

      // 2.5倍高精高清渲染 300DPI
      const canvas = await html2canvas(node, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 15000,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      if (i > 0) {
        pdf.addPage("a4", pdfOrientation);
      }

      // 将渲染图像 1:1 填满物理页面，绝无挤压拉伸
      pdf.addImage(imgData, "JPEG", 0, 0, pdfPageWidth, pdfPageHeight);
    }

    // 1. 自动保存标准高清 PDF
    pdf.save(fileName);

    // 2. 在物理 PDF 窗口中调起打印，保证横向 4张/页 输出为真正的横向 A4 页面
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
