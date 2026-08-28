import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * 一键直接打印：纯粹调起系统/打印机打印窗口，彻底杜绝弹出"保存到本地"对话框
 * 打印前自动重置 zoom 缩放，确保打印输出与 100% 预览一致
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

    // 关键修复：打印前临时重置 zoom 缩放 transform，防止打印输出尺寸随缩放比例变化
    const zoomContainer = pagesElementContainer.querySelector<HTMLElement>(".print-zoom-container");
    let originalTransform = "";
    if (zoomContainer) {
      originalTransform = zoomContainer.style.transform;
      zoomContainer.style.transform = "none";
    }

    // 使用 afterprint 事件确保打印完成后恢复缩放（无论用户是否取消打印）
    const restoreZoom = () => {
      if (zoomContainer) {
        zoomContainer.style.transform = originalTransform;
      }
      window.removeEventListener("afterprint", restoreZoom);
    };
    window.addEventListener("afterprint", restoreZoom);

    // 调起系统级打印预览/打印机窗口
    window.print();

    // 兜底恢复（某些浏览器 afterprint 事件不可靠）
    setTimeout(restoreZoom, 2000);
  } catch (err) {
    console.error("调起系统打印失败:", err);
    window.print();
  }
}

/**
 * 仅在用户明确需要导出/保存为 PDF 文件时调用的专用导出函数
 */
export async function exportToPdfFile(
  pagesElementContainer: HTMLElement,
  fileName: string = `发票拼页排版_A4_${new Date().toISOString().split("T")[0]}.pdf`
): Promise<void> {
  try {
    const pageNodes = pagesElementContainer.querySelectorAll<HTMLElement>(".a4-print-page");
    if (!pageNodes || pageNodes.length === 0) {
      alert("未找到排版页面，请先勾选发票！");
      return;
    }

    let pdf: jsPDF | null = null;

    for (let i = 0; i < pageNodes.length; i++) {
      const node = pageNodes[i];
      const canvas = await html2canvas(node, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 15000,
        ignoreElements: (element) => {
          return (
            element.classList.contains("no-print") ||
            element.classList.contains("print:hidden") ||
            element.getAttribute("data-no-print") === "true"
          );
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const isNodeLandscape = canvas.width > canvas.height;
      const pdfOrientation = isNodeLandscape ? "landscape" : "portrait";
      const pdfPageWidth = isNodeLandscape ? 297 : 210;
      const pdfPageHeight = isNodeLandscape ? 210 : 297;

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

      if (pdf) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfPageWidth, pdfPageHeight, undefined, "FAST");
      }
    }

    if (pdf) {
      pdf.save(fileName);
    }
  } catch (err) {
    console.error("导出 PDF 失败:", err);
    alert("导出 PDF 失败，请重试。");
  }
}

