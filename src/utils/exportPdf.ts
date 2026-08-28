import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * 后台分步生成高保真多页 PDF（支持封面纵向 + 发票横向独立方向拼合）
 */
export async function buildMergedPdfDocument(
  pagesElementContainer: HTMLElement
): Promise<jsPDF | null> {
  const pageNodes = pagesElementContainer.querySelectorAll<HTMLElement>(".a4-print-page");
  if (!pageNodes || pageNodes.length === 0) {
    return null;
  }

  let pdf: jsPDF | null = null;

  for (let i = 0; i < pageNodes.length; i++) {
    const node = pageNodes[i];
    
    // 渲染高清晰度 Canvas (2.5x 保证发票印章与细微文字清晰)
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
    // 自动判定该页面的方向与物理尺寸
    const isNodeLandscape = canvas.width > canvas.height;
    const pdfOrientation = isNodeLandscape ? "landscape" : "portrait";
    const pdfPageWidth = isNodeLandscape ? 297 : 210;
    const pdfPageHeight = isNodeLandscape ? 210 : 297;

    if (i === 0) {
      // 创建首页（如 A4 纵向封面单）
      pdf = new jsPDF({
        orientation: pdfOrientation,
        unit: "mm",
        format: "a4",
        compress: true,
      });
    } else if (pdf) {
      // 动态添加后续页面（如 A4 横向发票田字格），每页拥有完全独立的方向与尺寸
      pdf.addPage("a4", pdfOrientation);
    }

    if (pdf) {
      pdf.addImage(imgData, "PNG", 0, 0, pdfPageWidth, pdfPageHeight, undefined, "FAST");
    }
  }

  return pdf;
}

/**
 * 一键直接打印：若为混合排版则通过生成完整 PDF Blob 调起精准打印，彻底杜绝浏览器 DOM 混向裁切
 */
export async function generateAndPrintPdf(
  pagesElementContainer: HTMLElement,
  fileName: string = `发票拼页排版_A4_${new Date().toISOString().split("T")[0]}.pdf`,
  defaultOrientation: "portrait" | "landscape" = "portrait"
): Promise<void> {
  try {
    const pageNodes = pagesElementContainer.querySelectorAll<HTMLElement>(".a4-print-page");
    if (!pageNodes || pageNodes.length === 0) {
      alert("未找到排版页面，请先勾选需要排版的发票！");
      return;
    }

    // 检查是否存在封面 + 发票混合方向
    const hasCover = !!pagesElementContainer.querySelector(".a4-print-cover-page");
    const hasLandscape = !!pagesElementContainer.querySelector(".a4-print-page.landscape-mode");

    if (hasCover && hasLandscape) {
      // 混合方向场景：后台分步合成完整 PDF 并调起打印，确保封面纵向、发票横向 100% 独立无裁切
      const pdf = await buildMergedPdfDocument(pagesElementContainer);
      if (pdf) {
        const pdfBlob = pdf.output("blob");
        const blobUrl = URL.createObjectURL(pdfBlob);
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          }, 300);
        };
        return;
      }
    }

    // 单一方向标准场景：直接调用原生系统打印窗口
    const zoomContainer = pagesElementContainer.querySelector<HTMLElement>(".print-zoom-container");
    let originalTransform = "";
    if (zoomContainer) {
      originalTransform = zoomContainer.style.transform;
      zoomContainer.style.transform = "none";
    }

    const restoreZoom = () => {
      if (zoomContainer) {
        zoomContainer.style.transform = originalTransform;
      }
      window.removeEventListener("afterprint", restoreZoom);
    };
    window.addEventListener("afterprint", restoreZoom);

    window.print();
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
    const pdf = await buildMergedPdfDocument(pagesElementContainer);
    if (!pdf) {
      alert("未找到排版页面，请先勾选发票！");
      return;
    }

    pdf.save(fileName);
  } catch (err) {
    console.error("导出 PDF 失败:", err);
    alert("导出 PDF 失败，请重试。");
  }
}

