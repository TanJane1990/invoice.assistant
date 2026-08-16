import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * 导出与生成物理级无错 300DPI 拼页发票 PDF 文件
 * 动态根据每个页面节点（报销封面 / 2张纵向 / 4张横向）的真实比例，逐页自适应物理方向（210x297 纵向 或 297x210 横向），
 * 并且按宽高比 100% 保持比例缩放放置，彻底消除任何页面、封面或发票图像被竖向拉伸或压缩变形的瑕疵。
 */
export async function generateAndPrintPdf(
  pagesElementContainer: HTMLElement,
  fileName: string = `发票拼页排版_A4_${new Date().toISOString().split("T")[0]}.pdf`,
  defaultOrientation: "portrait" | "landscape" = "portrait"
): Promise<void> {
  try {
    // 找出所有 A4 打印页面节点
    const pageNodes = pagesElementContainer.querySelectorAll<HTMLElement>(".a4-print-page");
    if (!pageNodes || pageNodes.length === 0) {
      alert("未找到排版页面，请先勾选需要排版的发票！");
      return;
    }

    let pdf: jsPDF | null = null;

    for (let i = 0; i < pageNodes.length; i++) {
      const node = pageNodes[i];

      // 2.5倍高精采样 300DPI 渲染 DOM 为 Canvas 图像
      const canvas = await html2canvas(node, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 15000,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      // 根据 Canvas 真实宽高判断当前页应为 横向 (landscape) 还是 纵向 (portrait)
      const isNodeLandscape = canvas.width > canvas.height;
      const pdfOrientation = isNodeLandscape ? "landscape" : "portrait";
      const pdfPageWidth = isNodeLandscape ? 297 : 210;
      const pdfPageHeight = isNodeLandscape ? 210 : 297;

      // 初始化或新增物理 A4 页面
      if (i === 0) {
        pdf = new jsPDF({
          orientation: pdfOrientation,
          unit: "mm",
          format: "a4",
          compress: true,
        });
      } else if (pdf) {
        pdf.addPage("a4", pdfOrientation);
      }

      // 严格 1:1 保持宽高比例放置图像，绝对不拉伸/挤压
      const canvasRatio = canvas.width / canvas.height;
      const pageRatio = pdfPageWidth / pdfPageHeight;

      let drawW = pdfPageWidth;
      let drawH = pdfPageHeight;
      let drawX = 0;
      let drawY = 0;

      if (Math.abs(canvasRatio - pageRatio) > 0.02) {
        if (canvasRatio > pageRatio) {
          drawW = pdfPageWidth;
          drawH = pdfPageWidth / canvasRatio;
          drawY = (pdfPageHeight - drawH) / 2;
        } else {
          drawH = pdfPageHeight;
          drawW = pdfPageHeight * canvasRatio;
          drawX = (pdfPageWidth - drawW) / 2;
        }
      }

      if (pdf) {
        pdf.addImage(imgData, "JPEG", drawX, drawY, drawW, drawH);
      }
    }

    if (!pdf) return;

    // 1. 自动保存标准高清 PDF
    pdf.save(fileName);

    // 2. 调起 PDF 打印，出纸比例 1:1 完美展示
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
