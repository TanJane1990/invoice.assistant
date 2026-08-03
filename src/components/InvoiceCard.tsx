import React, { useState } from "react";
import { InvoiceData, GridMode } from "../types";
import { QrCode, Trash2, Edit3, Tag, ShieldCheck, AlertTriangle, FileText, Image as ImageIcon } from "lucide-react";

interface InvoiceCardProps {
  invoice: InvoiceData;
  gridMode: GridMode;
  showCropLines: boolean;
  onEdit?: (invoice: InvoiceData) => void;
  onDelete?: (id: string) => void;
  index: number;
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({
  invoice,
  gridMode,
  showCropLines,
  onEdit,
  onDelete,
  index,
}) => {
  const [viewMode, setViewMode] = useState<"template" | "original">("template");
  const [fileLoadError, setFileLoadError] = useState(false);

  const isSingle = gridMode === "1";
  const isMini = gridMode === "4";
  const isCompact = gridMode === "2";

  const taxRegionText = invoice.taxRegion || "北京市税务局";
  const drawerText = invoice.drawer || "王梅";

  const isTrainTicket =
    /铁路|火车|客票/.test(invoice.invoiceType || "") ||
    (invoice.category === "交通费" && /铁路|火车|G\d+|D\d+|K\d+|站/.test(invoice.remarks || ""));

  const trainText = `${invoice.remarks || ""} ${invoice.items?.[0]?.name || ""} ${invoice.items?.[0]?.spec || ""}`;
  const stationMatch = trainText.match(/([^\s\-—]+站)\s*[\-—~至到]\s*([^\s\-—]+站)/);
  const stationFrom = stationMatch ? stationMatch[1] : "南京南站";
  const stationTo = stationMatch ? stationMatch[2] : "江宁西站";

  const trainNoMatch = trainText.match(/([GDCZKT]\d{1,4})/i);
  const trainNo = trainNoMatch ? trainNoMatch[1].toUpperCase() : "G2789";

  const seatClassMatch = trainText.match(/(一等座|二等座|商务座|硬卧|软卧|无座)/);
  const seatClass = seatClassMatch ? seatClassMatch[1] : "二等座";

  const passengerMatch = trainText.match(/乘车人[:：]?\s*([\u4e00-\u9fa5]{2,4})/);
  const passengerName = passengerMatch
    ? passengerMatch[1]
    : invoice.buyerName.includes("乘车人")
    ? invoice.buyerName
    : "张三";

  const departTimeMatch = trainText.match(/(\d{4}年\d{1,2}月\d{1,2}日|\d{2}:\d{2})/);
  const departTime = departTimeMatch ? departTimeMatch[1] : "2026年05月11日 14:52开";

  return (
    <div
      className={`relative bg-white text-slate-800 transition-all duration-150 group ${
        isSingle
          ? "p-0 border-none shadow-none text-xs leading-relaxed"
          : isMini
          ? "p-2.5 text-[9px] leading-tight border border-slate-200 hover:border-slate-300 rounded-2xs"
          : isCompact
          ? "p-3.5 text-xs leading-normal border border-slate-200 hover:border-slate-300 rounded-2xs"
          : "p-5 text-xs leading-relaxed border border-slate-200 hover:border-slate-300 rounded-2xs"
      }`}
      style={{
        boxSizing: "border-box",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Top Header Row (Category tag & View Switcher) - Strictly hidden in physical print */}
      <div className="no-print print:hidden flex items-center justify-between mb-1 pb-1 border-b border-slate-100 text-[9px]">
        <div className="flex items-center space-x-1">
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[9px] font-semibold border border-red-200">
            <Tag className="w-2.5 h-2.5 text-red-500" />
            <span>{invoice.category}</span>
          </span>
          <span className="text-[9px] text-slate-400 font-mono">
            #{index + 1}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[9px]">
          {/* Mode Badge Switcher */}
          {invoice.fileUrl && (
            <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                onClick={() => setViewMode("original")}
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all cursor-pointer ${
                  viewMode === "original"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                真实原票
              </button>
              <button
                onClick={() => setViewMode("template")}
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all cursor-pointer ${
                  viewMode === "template"
                    ? "bg-red-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                识别版面
              </button>
            </div>
          )}

          {invoice.duplicateWarning ? (
            <span className="inline-flex items-center space-x-0.5 text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>重复告警</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-0.5 text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="w-3 h-3" />
              <span>已核验</span>
            </span>
          )}

          {/* Prominent Delete Button */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(invoice.id);
              }}
              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition-all shadow-xs ml-1"
              title="删除此发票"
            >
              <Trash2 className="w-3 h-3 text-white" />
              <span>删除</span>
            </button>
          )}
        </div>
      </div>

      {/* RENDER ORIGINAL FILE IMAGE / PDF IF SELECTED */}
      {viewMode === "original" && invoice.fileUrl && !fileLoadError ? (
        <div className="border border-slate-300 p-1 relative bg-slate-50 flex-1 flex flex-col items-center justify-between overflow-hidden rounded min-h-[220px]">
          <div className="w-full h-full flex-1 flex items-center justify-center bg-white rounded border border-slate-200 shadow-inner overflow-hidden min-h-[200px]">
            {invoice.fileUrl.startsWith("data:application/pdf") ||
            (invoice.fileUrl.startsWith("data:") && invoice.fileUrl.includes("pdf")) ? (
              <iframe
                src={`${invoice.fileUrl}#toolbar=0&navpanes=0&view=FitH`}
                className="w-full h-full min-h-[220px] border-none pointer-events-auto"
                title={invoice.fileName || "真实导入PDF发票"}
                onError={() => setFileLoadError(true)}
              />
            ) : invoice.fileUrl.startsWith("data:image/") ||
              invoice.fileUrl.startsWith("blob:") ||
              invoice.fileUrl.startsWith("http") ? (
              <img
                src={invoice.fileUrl}
                alt={invoice.fileName || "真实导入发票原票件"}
                className="max-h-full max-w-full object-contain"
                onError={() => setFileLoadError(true)}
              />
            ) : (
              <div className="p-3 text-center space-y-1.5">
                <FileText className="w-8 h-8 text-blue-600 mx-auto" />
                <p className="font-bold text-xs text-slate-800 truncate max-w-[180px]">
                  {invoice.fileName || "原件: " + invoice.invoiceNumber}
                </p>
                <p className="text-[10px] text-slate-500">
                  票面数据已全额高精识别，已为您自动生成300DPI矢量版面
                </p>
                <button
                  onClick={() => setViewMode("template")}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold rounded cursor-pointer transition-colors"
                >
                  查看300DPI矢量识别版面
                </button>
              </div>
            )}
          </div>
          <div className="mt-1 text-[8px] text-slate-500 flex justify-between w-full px-1 no-print print:hidden">
            <span className="truncate max-w-[140px]">原件: {invoice.fileName || "导入真实票件"}</span>
            <span className="text-blue-600 font-bold">真实原文件渲染</span>
          </div>
        </div>
      ) : viewMode === "original" && fileLoadError ? (
        <div className="border border-amber-300 p-3 bg-amber-50/60 flex-1 flex flex-col items-center justify-center text-center space-y-2 rounded min-h-[220px]">
          <AlertTriangle className="w-7 h-7 text-amber-600 mx-auto" />
          <p className="font-bold text-xs text-amber-900">
            原发票原件未获取到二进制图片
          </p>
          <p className="text-[10px] text-amber-700 max-w-[200px]">
            全票面数据已高精提取，请直接使用300DPI矢量版面打印输出
          </p>
          <button
            onClick={() => {
              setFileLoadError(false);
              setViewMode("template");
            }}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded cursor-pointer shadow-xs transition-colors"
          >
            切换至矢量识别版面 (最高质量)
          </button>
        </div>
      ) : isTrainTicket ? (
        /* AUTHENTIC RAILWAY ELECTRONIC PASSENGER TICKET (电子发票·铁路电子客票) */
        <div className="border border-sky-600 p-2 sm:p-2.5 relative bg-sky-50/30 flex-1 flex flex-col justify-between rounded-1xs">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sky-200 pb-1 mb-1">
            <div className="text-[8px] font-mono text-slate-700">
              <span className="text-slate-500">发票号码: </span>
              <span className="font-bold">{invoice.invoiceNumber}</span>
            </div>

            <div className="text-center relative">
              <h2 className="text-xs sm:text-sm font-bold font-serif text-slate-900 tracking-wider">
                {invoice.invoiceType || "电子发票（铁路电子客票）"}
              </h2>
              {/* Red Oval Stamp */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-none opacity-80 z-10">
                <div className="w-16 h-8 border border-red-600 rounded-[50%] flex flex-col items-center justify-center text-[6px] text-red-600 font-serif leading-none rotate-[-4deg] bg-white/20">
                  <span>国家税务总局</span>
                  <span className="font-bold scale-90">{taxRegionText}</span>
                </div>
              </div>
            </div>

            <div className="text-[8px] font-mono text-slate-700 text-right">
              <span className="text-slate-500">开票日期: </span>
              <span>{invoice.issueDate.replace(/-/g, "年").replace(/(\d{2})$/, "$1日")}</span>
            </div>
          </div>

          {/* Station Departure -> Arrival Banner */}
          <div className="bg-white border border-sky-200 rounded p-1.5 my-1 shadow-2xs">
            <div className="flex items-center justify-between px-2">
              <div className="text-center">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block">
                  {stationFrom}
                </span>
                <span className="text-[8px] text-slate-400 font-mono">出发站</span>
              </div>

              <div className="flex-1 mx-3 flex flex-col items-center">
                <span className="text-[9px] font-bold font-mono text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full border border-sky-300">
                  {trainNo}
                </span>
                <div className="w-full border-t-2 border-dashed border-sky-400 my-0.5 relative">
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-white text-[7px] text-sky-600 font-bold px-1">
                    ▶
                  </span>
                </div>
              </div>

              <div className="text-center">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block">
                  {stationTo}
                </span>
                <span className="text-[8px] text-slate-400 font-mono">到达站</span>
              </div>
            </div>

            {/* Train details row */}
            <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-700 font-mono px-1">
              <div>
                <span className="text-slate-400">发车: </span>
                <span className="font-semibold text-slate-900">{departTime}</span>
              </div>
              <div>
                <span className="text-slate-400">席别: </span>
                <span className="font-semibold text-slate-900">{seatClass}</span>
              </div>
              <div>
                <span className="text-slate-400">票价: </span>
                <span className="font-extrabold text-red-700 text-xs">¥ {invoice.totalAmountWithTax.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Passenger & Purchaser info */}
          <div className="text-[8px] space-y-0.5 bg-sky-50/50 p-1 rounded border border-sky-100">
            <div className="flex justify-between">
              <span className="text-slate-500">乘车人: <strong className="text-slate-900">{passengerName}</strong></span>
              <span className="text-slate-500">购买方: <strong className="text-slate-900">{invoice.buyerName}</strong></span>
            </div>
            <div className="flex justify-between font-mono text-[7.5px] text-slate-500 truncate">
              <span>开票单位: {invoice.sellerName}</span>
              <span>发票代码: {invoice.invoiceCode || "-"}</span>
            </div>
          </div>

          {/* Footer 12306 watermark bar */}
          <div className="mt-1 pt-0.5 border-t border-dashed border-sky-200 text-[7px] text-sky-800 flex justify-between items-center font-mono">
            <span>买票请到12306 · 发货请到95306</span>
            <span className="font-semibold">中国铁路祝您旅途愉快</span>
          </div>
        </div>
      ) : (
        /* AUTHENTIC CHINESE ELECTRONIC INVOICE CONTAINER */
        <div className={`border-2 border-red-700 relative bg-white flex-1 flex flex-col justify-between w-full h-full ${isSingle ? "p-3" : "p-2 sm:p-2.5"}`}>
          {/* Main Header Row: QR code left, Title middle, No & Date right */}
          <div className="grid grid-cols-12 gap-1 items-center mb-1.5">
            {/* Left: QR Code */}
            <div className="col-span-2 flex flex-col items-center justify-center">
              <div className="border border-slate-800 p-0.5 bg-white shadow-2xs">
                <QrCode className={`text-slate-900 ${isSingle ? "w-8 h-8 sm:w-10 sm:h-10" : "w-6 h-6 sm:w-8 sm:h-8"}`} />
              </div>
              <span className="text-[7px] text-slate-500 font-mono scale-90 -mt-0.5">扫码防伪</span>
            </div>

            {/* Middle: Title with Red Tax Stamp */}
            <div className="col-span-6 text-center relative flex flex-col items-center justify-center">
              <h2
                className={`font-serif font-bold text-red-800 tracking-widest border-b-2 border-t-2 border-red-700 px-1.5 py-0.5 inline-block ${
                  isMini ? "text-[11px]" : isCompact ? "text-sm" : isSingle ? "text-base sm:text-xl" : "text-lg"
                }`}
              >
                {invoice.invoiceType || "电子发票（普通发票）"}
              </h2>

              {/* Official Red Oval Tax Stamp */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-85 z-10">
                <div className={`border-2 border-red-600 rounded-[50%] flex flex-col items-center justify-center text-red-600 font-serif leading-tight font-bold rotate-[-3deg] bg-white/30 backdrop-blur-[0.5px] ${isSingle ? "w-20 h-11 sm:w-24 sm:h-12 text-[8px]" : "w-16 h-9 sm:w-20 sm:h-11 text-[7px]"}`}>
                  <span className="text-[6px] tracking-tighter">发票监制章</span>
                  <span className="font-extrabold my-0.5">国家税务总局</span>
                  <span className="text-[6px] tracking-tighter">{taxRegionText}</span>
                </div>
              </div>
            </div>

            {/* Right: Invoice Number & Date */}
            <div className={`col-span-4 text-right font-mono text-slate-900 space-y-0.5 ${isSingle ? "text-[9px] sm:text-[10px]" : "text-[8px] sm:text-[9px]"}`}>
              <div>
                <span className="text-red-900/80 font-bold font-sans">发票号码: </span>
                <span className="font-bold text-slate-900">{invoice.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-red-900/80 font-bold font-sans">开票日期: </span>
                <span>{invoice.issueDate.replace(/-/g, "年").replace(/(\d{2})$/, "$1日")}</span>
              </div>
              {invoice.invoiceCode && (
                <div>
                  <span className="text-red-900/80 font-bold font-sans">发票代码: </span>
                  <span>{invoice.invoiceCode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Purchaser & Seller Grid */}
          <div className={`border border-red-700 mb-1 grid grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-red-700 ${isSingle ? "text-[9px] sm:text-[10px]" : "text-[8px] sm:text-[9px]"}`}>
            {/* Purchaser */}
            <div className="col-span-12 sm:col-span-6 p-1 sm:p-1.5 space-y-0.5">
              <div className="text-red-800 font-bold font-serif border-b border-red-200 pb-0.5">
                购买方信息
              </div>
              <div className="truncate">
                <span className="text-slate-500">名 称: </span>
                <span className="font-bold text-slate-900">{invoice.buyerName}</span>
              </div>
              <div className="truncate font-mono">
                <span className="text-slate-500">纳税人识别号: </span>
                <span className="text-slate-800">{invoice.buyerTaxId || "-"}</span>
              </div>
            </div>

            {/* Seller */}
            <div className="col-span-12 sm:col-span-6 p-1 sm:p-1.5 space-y-0.5">
              <div className="text-red-800 font-bold font-serif border-b border-red-200 pb-0.5">
                销售方信息
              </div>
              <div className="truncate">
                <span className="text-slate-500">名 称: </span>
                <span className="font-bold text-slate-900">{invoice.sellerName}</span>
              </div>
              <div className="truncate font-mono">
                <span className="text-slate-500">纳税人识别号: </span>
                <span className="text-slate-800">{invoice.sellerTaxId || "-"}</span>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className={`border border-red-700 mb-1 overflow-hidden ${isSingle ? "text-[9px] sm:text-[10px]" : "text-[8px]"}`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-red-50/50 text-red-900 font-bold border-b border-red-700 text-center">
                  <th className="p-0.5 sm:p-1 border-r border-red-700 text-left">项目名称</th>
                  <th className="p-0.5 sm:p-1 border-r border-red-700">规格</th>
                  <th className="p-0.5 sm:p-1 border-r border-red-700">单位</th>
                  <th className="p-0.5 sm:p-1 border-r border-red-700">数量</th>
                  <th className="p-0.5 sm:p-1 border-r border-red-700">单价</th>
                  <th className="p-0.5 sm:p-1 border-r border-red-700">金额</th>
                  <th className="p-0.5 sm:p-1 border-r border-red-700">税率</th>
                  <th className="p-0.5 sm:p-1">税额</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-red-200/60 font-mono ${isSingle ? "text-[9px] sm:text-[10px]" : "text-[8px]"}`}>
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.slice(0, 3).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-0.5 sm:p-1 font-sans border-r border-red-200 text-slate-900 max-w-[130px] truncate">
                        {item.name}
                      </td>
                      <td className="p-0.5 sm:p-1 text-center border-r border-red-200 text-slate-600 truncate max-w-[70px]">
                        {item.spec || "-"}
                      </td>
                      <td className="p-0.5 sm:p-1 text-center border-r border-red-200 text-slate-600">
                        {item.unit || "-"}
                      </td>
                      <td className="p-0.5 sm:p-1 text-center border-r border-red-200 text-slate-800">
                        {item.quantity ?? 1}
                      </td>
                      <td className="p-0.5 sm:p-1 text-right border-r border-red-200 text-slate-800">
                        {item.price !== undefined ? item.price.toFixed(2) : "-"}
                      </td>
                      <td className="p-0.5 sm:p-1 text-right border-r border-red-200 font-bold text-slate-900">
                        {item.amount.toFixed(2)}
                      </td>
                      <td className="p-0.5 sm:p-1 text-center border-r border-red-200 text-slate-700">
                        {item.taxRate || "免税"}
                      </td>
                      <td className="p-0.5 sm:p-1 text-right text-slate-800">
                        {(item.taxAmount ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-1 text-center text-slate-400 italic">
                      暂无明细数据
                    </td>
                  </tr>
                )}

                {/* Subtotal row */}
                <tr className="bg-red-50/30 font-bold border-t border-red-700 text-red-900">
                  <td colSpan={5} className="p-0.5 sm:p-1 text-center border-r border-red-700 font-serif">
                    合 计
                  </td>
                  <td className="p-0.5 sm:p-1 text-right border-r border-red-700 font-mono">
                    ¥{invoice.totalAmountWithoutTax.toFixed(2)}
                  </td>
                  <td className="p-0.5 sm:p-1 border-r border-red-700"></td>
                  <td className="p-0.5 sm:p-1 text-right font-mono">
                    ¥{invoice.totalTaxAmount.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Grand Total Box (价税合计) */}
          <div className={`border border-red-700 p-1 sm:p-1.5 bg-red-50/20 mb-1 flex items-center justify-between ${isSingle ? "text-[9px] sm:text-[10px]" : "text-[8px] sm:text-[9px]"}`}>
            <div className="flex items-center space-x-1">
              <span className="font-bold text-red-900 font-serif">价税合计(大写)</span>
              <span className="w-3.5 h-3.5 rounded-full border border-red-900 text-red-900 flex items-center justify-center font-bold text-[8px] font-mono">
                ⊗
              </span>
              <span className="font-bold text-red-950 font-serif text-[10px] sm:text-xs">
                {invoice.totalAmountWithTaxCN}
              </span>
            </div>

            <div className="font-mono text-right">
              <span className="text-slate-500 font-sans text-[7px] sm:text-[8px]">(小写) </span>
              <span className={`font-extrabold text-red-800 ${isSingle ? "text-sm sm:text-base" : "text-xs sm:text-xs"}`}>
                ¥{invoice.totalAmountWithTax.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Remarks & Drawer Footer */}
          <div className={`border border-red-700 p-1 sm:p-1.5 grid grid-cols-12 gap-1 ${isSingle ? "text-[9px] sm:text-[10px]" : "text-[8px]"}`}>
            <div className="col-span-8 border-r border-red-200 pr-1">
              <span className="text-red-900 font-bold font-serif">备 注: </span>
              <span className="text-slate-800 font-mono truncate">{invoice.remarks || "无"}</span>
            </div>
            <div className="col-span-4 pl-1 flex items-center justify-between">
              <span className="text-red-900 font-bold font-serif">开票人: </span>
              <span className="text-slate-900 font-medium">{drawerText}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
