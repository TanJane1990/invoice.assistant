import { numberToRMB } from "./numberToRMB";

export interface ParsedInvoiceResult {
  invoiceType: string;
  invoiceCode: string;
  invoiceNumber: string;
  issueDate: string;
  buyerName: string;
  buyerTaxId: string;
  sellerName: string;
  sellerTaxId: string;
  totalAmountWithoutTax: number;
  totalTaxAmount: number;
  totalAmountWithTax: number;
  totalAmountWithTaxCN: string;
  category: "餐饮费" | "交通费" | "住宿费" | "办公用品" | "通讯费" | "会议费" | "软件服务" | "培训费" | "租金" | "其他";
  remarks: string;
  taxRegion?: string;
  drawer?: string;
  items: Array<{
    id: string;
    name: string;
    spec?: string;
    unit?: string;
    quantity?: number;
    price?: number;
    amount: number;
    taxRate?: string;
    taxAmount?: number;
  }>;
}

/**
 * 规则引擎：从发票文本流或OCR识别结果中提取结构化字段
 */
export function parseInvoiceTextWithRules(rawText: string, fileName: string = ""): ParsedInvoiceResult {
  const cleanText = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");

  // 1. 判断发票/票据类型
  let invoiceType = "电子发票（普通发票）";
  if (/非税收入|统一票据|财政电子|医疗收费|学杂费/.test(cleanText)) {
    const matchType = cleanText.match(/([\u4e00-\u9fa5]+非税收入[\u4e00-\u9fa5（）()]*)|\b财政电子票据\b/);
    invoiceType = matchType ? matchType[0] : "北京市非税收入统一票据（电子）";
  } else if (/铁路电子客票|火车票|铁路电子|电子客票/.test(cleanText)) {
    invoiceType = "电子发票（铁路电子客票）";
  } else if (/航空运输电子客票行程单|航空客票|行程单/.test(cleanText)) {
    invoiceType = "航空运输电子客票行程单";
  } else if (/全面数字化|数电/.test(cleanText)) {
    invoiceType = cleanText.includes("专用") ? "数电发票（专用发票）" : "数电发票（普通发票）";
  } else if (/增值税.*专用发票/.test(cleanText)) {
    invoiceType = "增值税电子专用发票";
  } else if (/增值税.*普通发票/.test(cleanText)) {
    invoiceType = "增值税电子普通发票";
  }

  // 2. 发票代码 (10位或12位)
  let invoiceCode = "";
  const codeMatch = cleanText.match(/(?:发票代码|票据代码|代码)[:：\s]*(\d{8,12})\b/) || cleanText.match(/\b(1\d{9,11})\b/);
  if (codeMatch) {
    invoiceCode = codeMatch[1];
  }

  // 3. 发票号码 / 票据号码
  let invoiceNumber = "";
  const numMatch =
    cleanText.match(/(?:发票号码|票据号码|客票号|号码|流水号)[:：\s]*([A-Za-z0-9\-]{8,20})\b/) ||
    cleanText.match(/\b(\d{8,20})\b/);
  if (numMatch) {
    invoiceNumber = numMatch[1];
  } else {
    // 修复 #30: 基于文件名生成确定性的 fallback 号码，避免重复导入同一文件时无法查重
    let hash = 0;
    const hashSource = fileName || rawText.slice(0, 200);
    for (let i = 0; i < hashSource.length; i++) {
      hash = ((hash << 5) - hash + hashSource.charCodeAt(i)) | 0;
    }
    invoiceNumber = "F" + String(Math.abs(hash) % 100000000).padStart(8, "0");
  }

  // 4. 开票日期
  let issueDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const dateMatch =
    cleanText.match(/开票日期[:：\s]*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})日?/) ||
    cleanText.match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
  if (dateMatch) {
    const y = dateMatch[1];
    const m = dateMatch[2].padStart(2, "0");
    const d = dateMatch[3].padStart(2, "0");
    issueDate = `${y}-${m}-${d}`;
  }

  // 5. 购买方 / 交款人 名称与税号
  let buyerName = "";
  let buyerTaxId = "";

  const buyerNameMatch = cleanText.match(
    /(?:购买方|交款人|抬头|购买方名称|交款人名称)[:：\s]*([\u4e00-\u9fa5A-Za-z0-9（）()]{2,30})/
  );
  if (buyerNameMatch) {
    buyerName = buyerNameMatch[1].trim();
  }

  // 税号或统一社会信用代码/身份证
  const buyerTaxMatch = cleanText.match(
    /(?:统一社会信用代码|纳税人识别号|交款人统一社会信用代码|身份证号)[:：\s]*([0-9A-HJ-NP-RT-UW-Y]{15,20})/
  );
  if (buyerTaxMatch) {
    buyerTaxId = buyerTaxMatch[1].trim();
  }

  // 6. 销售方 / 收款单位 / 出票机构 名称与税号
  let sellerName = "";
  let sellerTaxId = "";

  const sellerNameMatch = cleanText.match(
    /(?:销售方|收款单位|出票机构|开票单位|代理人|收款单位（章）)[:：\s]*([\u4e00-\u9fa5A-Za-z0-9（）()]{2,30})/
  );
  if (sellerNameMatch) {
    sellerName = sellerNameMatch[1].trim();
  }

  const sellerTaxMatch = cleanText.match(
    /(?:销售方纳税人识别号|销售方统一社会信用代码|纳税人识别号)[:：\s]*([0-9A-HJ-NP-RT-UW-Y]{15,20})/g
  );
  if (sellerTaxMatch && sellerTaxMatch.length >= 2) {
    sellerTaxId = sellerTaxMatch[1].replace(/.*[:：\s]*/, "").trim();
  } else if (sellerTaxMatch && sellerTaxMatch.length === 1 && !buyerTaxId) {
    sellerTaxId = sellerTaxMatch[0].replace(/.*[:：\s]*/, "").trim();
  }

  // 7. 金额提取 (小写与大写)
  let totalAmountWithTax = 0;
  let totalAmountWithTaxCN = "";

  // 提取大写金额 (如: 玖元伍角贰分, 拾壹元整, 壹佰贰拾元整)
  const cnMatch = cleanText.match(/(?:价税合计\(大写\)|大写|金额大写|金额合计\(大写\))[:：\s]*([\u4e00-\u9fa5]{2,20})/);
  if (cnMatch) {
    totalAmountWithTaxCN = cnMatch[1].trim();
  }

  // 提取小写金额
  const amtMatches = cleanText.matchAll(/(?:价税合计|小写|票价|合计|金额|总计|合计金额)[小写\(（\s]*[¥￥]?\s*(\d+(?:\.\d{1,2})?)/g);
  const foundAmts: number[] = [];
  for (const m of amtMatches) {
    const val = parseFloat(m[1]);
    if (!isNaN(val) && val > 0) {
      foundAmts.push(val);
    }
  }

  if (foundAmts.length > 0) {
    totalAmountWithTax = Math.max(...foundAmts);
  } else {
    // 降级正则提取任意 ¥123.45 格式数字
    const rawAmtMatch = cleanText.match(/[¥￥]\s*(\d+(?:\.\d{1,2})?)/);
    if (rawAmtMatch) {
      totalAmountWithTax = parseFloat(rawAmtMatch[1]);
    } else {
      totalAmountWithTax = 100.0;
    }
  }

  if (!totalAmountWithTaxCN) {
    totalAmountWithTaxCN = numberToRMB(totalAmountWithTax);
  }

  let totalTaxAmount = 0;
  let totalAmountWithoutTax = totalAmountWithTax;

  const taxMatch = cleanText.match(/(?:合计税额|税额|税额合计)[:：\s]*[¥￥]?\s*(\d+(?:\.\d{1,2})?)/);
  if (taxMatch) {
    totalTaxAmount = parseFloat(taxMatch[1]);
    totalAmountWithoutTax = Math.round((totalAmountWithTax - totalTaxAmount) * 100) / 100;
  }

  // 8. 费用类别智能判断
  let category: ParsedInvoiceResult["category"] = "其他";
  if (/火车|铁路|高铁|客票|机票|行程单|出租车|滴滴|客运|通行费|交通|路桥|公交/.test(cleanText) || invoiceType.includes("客票")) {
    category = "交通费";
  } else if (/餐饮|饭店|麦当劳|肯德基|海底捞|酒楼|美食|餐馆|咖啡/.test(cleanText)) {
    category = "餐饮费";
  } else if (/酒店|宾馆|客栈|民宿|住宿|希尔顿|万豪|全季|汉庭/.test(cleanText)) {
    category = "住宿费";
  } else if (/办公|文具|纸|打印|晨光|齐心|京东|电脑|耗材/.test(cleanText)) {
    category = "办公用品";
  } else if (/电信|移动|联通|通讯|宽带|话费|电话/.test(cleanText)) {
    category = "通讯费";
  } else if (/会议|会务|展览/.test(cleanText)) {
    category = "会议费";
  } else if (/软件|信息技术|网络|云|系统|开发|SAAS/.test(cleanText)) {
    category = "软件服务";
  } else if (/培训|学杂费|学费|讲座|考试/.test(cleanText)) {
    category = "培训费";
  } else if (/租金|房租|租赁/.test(cleanText)) {
    category = "租金";
  }

  // 9. 火车票/特殊票据专属信息收集到 remarks
  let remarks = fileName || "本地PDF文本解析";
  if (invoiceType.includes("铁路") || invoiceType.includes("火车票")) {
    const stations = cleanText.match(/([\u4e00-\u9fa5]{2,6}站)\s*(?:[GDCZKT]\d+)?\s*([\u4e00-\u9fa5]{2,6}站)/);
    const trainNo = cleanText.match(/([GDCZKT]\d{1,4})/i);
    const seat = cleanText.match(/(一等座|二等座|商务座|硬卧|软卧|无座)/);
    const passenger = cleanText.match(/(?:乘车人|旅客|姓名)[:：\s]*([\u4e00-\u9fa5]{2,4})/);

    let infoParts = [];
    if (stations) infoParts.push(`${stations[1]} - ${stations[2]}`);
    if (trainNo) infoParts.push(trainNo[1].toUpperCase());
    if (seat) infoParts.push(seat[1]);
    if (passenger) infoParts.push(`乘车人:${passenger[1]}`);

    if (infoParts.length > 0) {
      remarks = infoParts.join(" ");
    }
  } else if (invoiceType.includes("非税收入")) {
    const userNoMatch = cleanText.match(/用户编号[:：\s]*(\d+)/);
    const projectMatch = cleanText.match(/(\d+\s*[\u4e00-\u9fa5]+费[\u4e00-\u9fa5（）()]*)/);
    if (projectMatch) {
      remarks = projectMatch[1];
    } else if (userNoMatch) {
      remarks = `用户编号:${userNoMatch[1]}`;
    }
  }

  // 10. 明细列表提炼
  const items: ParsedInvoiceResult["items"] = [];
  const itemMatch = cleanText.match(/\*[\u4e00-\u9fa5]+\*[\u4e00-\u9fa5A-Za-z0-9\s（）()]+/);
  if (itemMatch) {
    items.push({
      id: `item-${Date.now()}-1`,
      name: itemMatch[0].trim(),
      amount: totalAmountWithTax,
      quantity: 1,
    });
  } else {
    items.push({
      id: `item-${Date.now()}-1`,
      name: remarks || invoiceType,
      amount: totalAmountWithTax,
      quantity: 1,
    });
  }

  return {
    invoiceType,
    invoiceCode,
    invoiceNumber,
    issueDate,
    buyerName: buyerName || "北京云里雾里科技有限公司",
    buyerTaxId: buyerTaxId || "91110108MA0192837X",
    sellerName: sellerName || "出票服务单位",
    sellerTaxId: sellerTaxId || "",
    totalAmountWithoutTax,
    totalTaxAmount,
    totalAmountWithTax,
    totalAmountWithTaxCN,
    category,
    remarks,
    items,
  };
}
