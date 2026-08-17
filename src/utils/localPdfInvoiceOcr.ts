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
  passengerName?: string;
  passengerId?: string;
  trainRoute?: string;
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

// 中文大写金额数字映射与解析引擎
const CN_NUM_MAP: Record<string, number> = {
  壹: 1, 贰: 2, 叁: 3, 参: 3, 肆: 4, 伍: 5, 陆: 6, 柒: 7, 捌: 8, 玖: 9,
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const CN_UNIT_MAP: Record<string, number> = {
  拾: 10, 佰: 100, 仟: 1000, 万: 10000, 亿: 100000000,
  十: 10, 百: 100, 千: 1000,
};

export function parseChineseAmount(text: string): number | null {
  if (!text) return null;
  const m = text.match(/([零壹贰叁参肆伍陆柒捌玖一二三四五六七八九拾佰仟万亿十百千]+[元圆][零壹贰叁参肆伍陆柒捌玖一二三四五六七八九角分整]*)/);
  if (!m) return null;

  const cnStr = m[1];
  const yuanIdx = cnStr.search(/[元圆]/);
  if (yuanIdx === -1) return null;

  const yuanPart = cnStr.slice(0, yuanIdx);
  const rest = cnStr.slice(yuanIdx + 1);

  let jiaoVal = 0;
  let fenVal = 0;

  const jiaoIdx = rest.indexOf("角");
  if (jiaoIdx !== -1) {
    const jiaoChar = rest.slice(0, jiaoIdx).slice(-1);
    if (CN_NUM_MAP[jiaoChar]) jiaoVal = CN_NUM_MAP[jiaoChar] * 0.1;
    const fenChar = rest.slice(jiaoIdx + 1).replace(/[分整]/g, "").slice(0, 1);
    if (CN_NUM_MAP[fenChar]) fenVal = CN_NUM_MAP[fenChar] * 0.01;
  } else {
    const fenChar = rest.replace(/[分整]/g, "").slice(0, 1);
    if (CN_NUM_MAP[fenChar]) fenVal = CN_NUM_MAP[fenChar] * 0.01;
  }

  let section = 0;
  let current = 0;

  for (const char of yuanPart) {
    if (char === "零" || char === "〇") {
      current = 0;
    } else if (CN_NUM_MAP[char] !== undefined) {
      current = CN_NUM_MAP[char];
    } else if (CN_UNIT_MAP[char] !== undefined) {
      const unit = CN_UNIT_MAP[char];
      if (unit >= 10000) {
        section = (section + current) * unit;
        current = 0;
      } else {
        section += current * unit;
        current = 0;
      }
    }
  }

  const totalYuan = section + current;
  const total = Math.round((totalYuan + jiaoVal + fenVal) * 100) / 100;
  return total > 0 ? total : null;
}

/**
 * 规则引擎：高精电子发票/收据解构算法
 */
export function parseInvoiceTextWithRules(rawText: string, fileName: string = ""): ParsedInvoiceResult {
  const cleanText = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");

  // 1. 发票/收据类型判定
  let invoiceType = "增值税电子普通发票";
  if (/收据|电子收据|收条|收款凭证|交款单/.test(cleanText)) {
    const matchType = cleanText.match(/([\u4e00-\u9fa5]{2,15}(?:电子收据|收据|收款凭证|收条))/);
    invoiceType = matchType ? matchType[0] : "电子收据";
  } else if (/非税收入|统一票据|财政电子|医疗收费|学杂费/.test(cleanText)) {
    const matchType = cleanText.match(/([\u4e00-\u9fa5]+非税收入[\u4e00-\u9fa5（）()]*)|\b财政电子票据\b/);
    invoiceType = matchType ? matchType[0] : "财政电子票据";
  } else if (/铁路电子客票|火车票|铁路电子|电子客票/.test(cleanText)) {
    invoiceType = "电子发票（铁路电子客票）";
  } else if (/航空运输电子客票行程单|航空客票|行程单/.test(cleanText)) {
    invoiceType = "航空运输电子客票行程单";
  } else if (/全面数字化|数电/.test(cleanText)) {
    invoiceType = cleanText.includes("专用") ? "数电发票（专用发票）" : "数电发票（普通发票）";
  } else if (/专用发票/.test(cleanText)) {
    invoiceType = "增值税专用发票";
  } else if (/普通发票/.test(cleanText)) {
    invoiceType = "增值税电子普通发票";
  }

  // 2. 发票/收据号码
  let invoiceNumber = "";
  const mNumNo = cleanText.match(/No\.?\s*([0-9A-Za-z]+(?:-[0-9A-Za-z]+)?)/i) || cleanText.match(/(?:收款单号|单号|发票号码|发票号|号码|票据号码)[:：\s]*([0-9A-Za-z-]+)/);
  if (mNumNo) {
    invoiceNumber = mNumNo[1].trim();
  }

  if (!invoiceNumber) {
    const mNum20 = cleanText.match(/\b(\d{20})\b/);
    if (mNum20) {
      invoiceNumber = mNum20[1];
    } else {
      const mNum8 = cleanText.match(/\b(\d{8,12})\b/);
      if (mNum8) {
        invoiceNumber = mNum8[1];
      }
    }
  }

  if (!invoiceNumber) {
    let hash = 0;
    const hashSource = fileName || rawText.slice(0, 200);
    for (let i = 0; i < hashSource.length; i++) {
      hash = ((hash << 5) - hash + hashSource.charCodeAt(i)) | 0;
    }
    invoiceNumber = "F" + String(Math.abs(hash) % 100000000).padStart(8, "0");
  }

  // 3. 发票代码
  let invoiceCode = "";
  const mCode = cleanText.match(/(?:发票代码|票据代码)[:：\s]*(\d{8,12})/);
  if (mCode) {
    invoiceCode = mCode[1];
  }

  // 4. 开票日期
  let issueDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const mDate = cleanText.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (mDate) {
    issueDate = `${mDate[1]}-${mDate[2].padStart(2, "0")}-${mDate[3].padStart(2, "0")}`;
  } else {
    const mDate2 = cleanText.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (mDate2) {
      issueDate = `${mDate2[1]}-${mDate2[2]}-${mDate2[3]}`;
    }
  }

  // 5. 公司/主体名称正则抽取
  const companyPattern = /([^\n\r\t]{3,50}(?:公司|单位|中心|联络处|处|局|厅|院|所|站|部|协会|基金|集团|学校|学院|大学|医院|银行|支行|分行|商会|工会|联合会|事务所|工作室|分公司|门店|超市|酒店|宾馆|研究院|幼儿园|诊所|卫生院|药房|药店|保险|证券|信托|委员会|办公室|管理局|服务中心))/g;
  const companies: string[] = [];
  const compMatches = cleanText.matchAll(companyPattern);
  const seenComps = new Set<string>();
  for (const cm of compMatches) {
    const name = cm[1].trim();
    if (
      name &&
      name.length > 3 &&
      !seenComps.has(name) &&
      !name.includes("统一社会信用") &&
      !name.includes("纳税人识别") &&
      !name.includes("项目名称") &&
      !name.includes("规格型号") &&
      !name.includes("国家税务总局") &&
      !name.includes("监制章")
    ) {
      seenComps.add(name);
      companies.push(name);
    }
  }

  let buyerName = "";
  let sellerName = "";
  let buyerTaxId = "";
  let sellerTaxId = "";
  let passengerName = "";
  let passengerId = "";
  let trainRoute = "";

  const mPayer = cleanText.match(/(?:购买方|交款人|客户|抬头)(?:信息|\s|\/|\(|\))*[（(]?交款人\/单位[）)]?[:：\s]*([^\n\r\t]{2,50})/);
  if (mPayer) {
    let rawPayer = mPayer[1].replace(/^(信息|名称)[:：\s]*/, "").trim();
    // 过滤购买方名称前面的校验乱码数字串
    rawPayer = rawPayer.replace(/^[\s0-9a-zA-Z._\-\/]+\s*(?=[\u4e00-\u9fa5]{2,})/, "").trim();
    if (!rawPayer.includes("监制章") && !rawPayer.includes("税务总局")) {
      buyerName = rawPayer;
    }
  }

  if (!buyerName && (cleanText.includes("个人") || cleanText.includes("交款人"))) {
    buyerName = "个人";
  }

  const mPayee = cleanText.match(/(?:销售方|收款单位|收款方|出票机构|开票单位|出票服务单位|服务单位|收款人)(?:信息|\s)*(?:名称)?[:：\s]*([^\n\r\t]{2,50})/);
  if (mPayee) {
    let rawPayee = mPayee[1]
      .replace(/^(信息|名称)[:：\s]*/, "")
      .replace(/^(出票服务单位|服务单位|开票单位|收款单位)[:：\s]*/, "")
      .replace(/^有限责任公司代收\s*/, "")
      .trim();
    rawPayee = rawPayee.replace(/^[\s0-9a-zA-Z._\-\/]+\s*(?=[\u4e00-\u9fa5]{2,})/, "").trim();
    if (!rawPayee.includes("项目名称") && !rawPayee.includes("规格型号") && !rawPayee.includes("监制章")) {
      sellerName = rawPayee;
    }
  }

  // 公用事业/服务商主体名称智能角色防误翻转引擎：如自来水、供电、燃气、通信、京东等商户被误抓为购买方，自动矫正归纳为销售方
  const utilityKeywords = ["自来水", "供水", "水务", "电力", "供电", "燃气", "热力", "电信", "联通", "移动", "铁塔", "京东", "美团", "滴滴"];
  if (utilityKeywords.some((k) => buyerName.includes(k))) {
    if (!sellerName || sellerName.includes("代收") || sellerName.includes("服务单位") || sellerName === "示例服务提供商") {
      sellerName = buyerName;
    }
    buyerName = "个人";
  }

  // =========================================================================
  // 🏛️ 5 大标准发票/票据解构引擎 (5 Standard Template Structural Engine)
  // =========================================================================

  // 模式 1: 电子发票（铁路电子客票）
  if (invoiceType.includes("铁路") || invoiceType.includes("客票") || cleanText.includes("12306")) {
    invoiceType = "电子发票（铁路电子客票）";
    sellerName = "中国铁路";
    sellerTaxId = "-";
    if (!buyerName || buyerName.includes("监制章") || buyerName.includes("税务总局")) {
      buyerName = "个人";
    }

    const mPassengerId = cleanText.match(/(\d{6}\*+\d{4}|\d{18}|\d{15})/);
    if (mPassengerId) passengerId = mPassengerId[1];

    const mPassengerName = cleanText.match(/(?:\d{6}\*+\d{4}|\d{18}|\d{15})\s*([\u4e00-\u9fa5]{2,4})/);
    if (mPassengerName) passengerName = mPassengerName[1];

    const mTrainRoute = cleanText.match(/([\u4e00-\u9fa5]{2,6}站)[\s\S]{0,20}?([A-Z]\d{1,5}|\d{1,5})[\s\S]{0,20}?([\u4e00-\u9fa5]{2,6}站)/);
    if (mTrainRoute) trainRoute = `${mTrainRoute[1]} ${mTrainRoute[2]} ${mTrainRoute[3]}`;
  }
  // 模式 2: 航空运输电子客票行程单
  else if (invoiceType.includes("航空") || invoiceType.includes("行程单")) {
    invoiceType = "航空运输电子客票行程单";
    const mAirPassenger = cleanText.match(/(?:旅客姓名|乘机人|姓名)[:：\s]*([\u4e00-\u9fa5]{2,6})/);
    if (mAirPassenger) passengerName = mAirPassenger[1];

    const mAirId = cleanText.match(/(?:有效身份证件号码|身份证号|证件号)[:：\s]*([A-Za-z0-9*]+)/);
    if (mAirId) passengerId = mAirId[1];

    const mFlight = cleanText.match(/([A-Z0-9]{2}\d{3,4})/);
    if (mFlight) trainRoute = `航班: ${mFlight[1]}`;

    if (!buyerName || buyerName.includes("监制章")) buyerName = "个人";
  }
  // 模式 3: 财政非税收入统一票据 / 行政收据
  else if (invoiceType.includes("非税收入") || invoiceType.includes("财政电子") || invoiceType.includes("收据")) {
    const mPayerText = cleanText.match(/(?:交款人|交款单位|付款人)[:：\s]*([^\n\r\t]{2,50})/);
    if (mPayerText) {
      let raw = mPayerText[1].replace(/^[\s0-9a-zA-Z._\-\/]+\s*(?=[\u4e00-\u9fa5]{2,})/, "").trim();
      if (!raw.includes("监制章")) buyerName = raw;
    }
    const mPayeeText = cleanText.match(/(?:收款单位|收款人|开票单位)[:：\s]*([^\n\r\t]{2,50})/);
    if (mPayeeText) {
      let raw = mPayeeText[1].replace(/^[\s0-9a-zA-Z._\-\/]+\s*(?=[\u4e00-\u9fa5]{2,})/, "").trim();
      if (!raw.includes("监制章")) sellerName = raw;
    }
  }
  // 模式 4: 数电发票 (全面数字化电子发票 - 无发票代码)
  else if (invoiceType.includes("数电发票") || (invoiceNumber.length === 20 && !invoiceCode)) {
    const mDigitalBuyer = cleanText.match(/(?:购买方信息|购买方名称|购买方)[^：:\n]*[:：\s]*([^\n\r\t]{2,50})/);
    if (mDigitalBuyer) {
      const name = mDigitalBuyer[1].replace(/^名称[:：\s]*/, "").trim();
      if (!name.includes("监制章")) buyerName = name;
    }
    const mDigitalSeller = cleanText.match(/(?:销售方信息|销售方名称|销售方)[^：:\n]*[:：\s]*([^\n\r\t]{2,50})/);
    if (mDigitalSeller) {
      const name = mDigitalSeller[1].replace(/^名称[:：\s]*/, "").trim();
      if (!name.includes("监制章")) sellerName = name;
    }
  }
  // 模式 5: 传统增值税纸质/电子发票 (带发票代码)
  else {
    if (!sellerName && companies.length > 0) {
      sellerName = companies.find(c => c !== buyerName && c.includes("公司")) || companies[0];
    }
    if (!buyerName && companies.length >= 2) {
      buyerName = companies.find(c => c !== sellerName) || "个人";
    }
  }

  // 6. 税号提取
  const taxIdMatches = Array.from(cleanText.matchAll(/([A-Za-z0-9]{15,20})/g)).map(m => m[1]);
  const validTaxIds = taxIdMatches.filter(id =>
    id.length >= 15 &&
    id.length <= 20 &&
    !/^\d{20}$/.test(id) &&
    !/^\d{8}$/.test(id) &&
    !/^\d{16}$/.test(id) &&
    !/^\d{17}$/.test(id)
  );

  if (validTaxIds.length >= 2) {
    sellerTaxId = validTaxIds.find(id => /[A-Z]/.test(id) || id.startsWith("91")) || validTaxIds[0];
    buyerTaxId = validTaxIds.find(id => id !== sellerTaxId) || "";
  } else if (validTaxIds.length === 1) {
    sellerTaxId = validTaxIds[0];
  }

  // 7. 多重包含性含税金额提取引擎
  let totalAmountWithTax = 0;
  let totalAmountWithTaxCN = "";

  // 优先解析中文大写金额
  const cnAmount = parseChineseAmount(cleanText);
  if (cnAmount && cnAmount > 0 && cnAmount < 1000000) {
    totalAmountWithTax = cnAmount;
  }

  if (totalAmountWithTax === 0) {
    const totalPatterns = [
      /(?:票价|车票票价)\s*[:：]?\s*[¥￥]?\s*([0-9,，]+\.\d{2})/,
      /(?:价税合计|价税\s*合\s*计)[^0-9¥￥]*[¥￥]?\s*[:：]?\s*([0-9,，]+\.?\d*)/,
      /(?:（小写）|\(小写\)|小写)\s*[¥￥]?\s*([0-9,，]+\.\d{2})/,
      /小写[）\)]?\s*[¥￥]?\s*([0-9,，]+\.\d{2})/,
      /(?:金额|合计)\s*[:：\s]*[¥￥]?\s*([0-9,，]+\.\d{2})/,
      /[¥￥]\s*([0-9,，]+\.\d{2})/,
    ];

    for (const pat of totalPatterns) {
      const m = cleanText.match(pat);
      if (m) {
        const valStr = m[1].replace(/[,，]/g, "");
        const val = parseFloat(valStr);
        if (!isNaN(val) && val > 0 && val < 1000000) {
          totalAmountWithTax = val;
          break;
        }
      }
    }
  }

  if (totalAmountWithTax === 0) {
    const rawAmounts = Array.from(cleanText.matchAll(/([0-9,，]+\.\d{2})/g))
      .map(m => parseFloat(m[1].replace(/[,，]/g, "")))
      .filter(v => !isNaN(v) && v > 0 && v < 1000000);

    if (rawAmounts.length > 0) {
      totalAmountWithTax = Math.max(...rawAmounts);
    }
  }

  // 大写金额提取
  const cnMatch = cleanText.match(/(?:价税合计\(大写\)|价税合计（大写）|大写|金额大写|金额合计\(大写\))[:：\s\S]{0,10}?([\u4e00-\u9fa5]{2,20})/);
  if (cnMatch) {
    totalAmountWithTaxCN = cnMatch[1].replace(/[ⓧ\s]/g, "").trim();
  }
  if (!totalAmountWithTaxCN && totalAmountWithTax > 0) {
    totalAmountWithTaxCN = numberToRMB(totalAmountWithTax);
  }

  // 8. 不含税金额与税额
  let totalAmountWithoutTax = totalAmountWithTax;
  let totalTaxAmount = 0;

  const mWithoutTax = cleanText.match(/(?<!价税)合\s*计[^0-9¥￥]*[¥￥]?\s*([0-9,，]+\.?\d*)/);
  if (mWithoutTax) {
    const val = parseFloat(mWithoutTax[1].replace(/[,，]/g, ""));
    if (!isNaN(val) && val < 1000000) totalAmountWithoutTax = val;
  }

  const mTax = cleanText.match(/税\s*额[^0-9¥￥]*[¥￥]?\s*([0-9,，]+\.?\d*)/);
  if (mTax) {
    const val = parseFloat(mTax[1].replace(/[,，]/g, ""));
    if (!isNaN(val) && val < 1000000) totalTaxAmount = val;
  }

  if (totalAmountWithoutTax === totalAmountWithTax && totalTaxAmount > 0 && totalAmountWithTax > totalTaxAmount) {
    totalAmountWithoutTax = Math.round((totalAmountWithTax - totalTaxAmount) * 100) / 100;
  }

  // 9. 费用类别智能归类
  let category: ParsedInvoiceResult["category"] = "其他";
  if (/火车|铁路|高铁|客票|机票|行程单|出租车|滴滴|客运|通行费|交通|路桥|公交/.test(cleanText) || invoiceType.includes("客票")) {
    category = "交通费";
  } else if (/餐饮|饭店|麦当劳|肯德基|海底捞|酒楼|美食|餐馆|咖啡/.test(cleanText)) {
    category = "餐饮费";
  } else if (/酒店|宾馆|客栈|民宿|住宿|希尔顿|万豪|全季|汉庭/.test(cleanText)) {
    category = "住宿费";
  } else if (/办公|文具|纸|打印|晨光|齐心|京东|杀虫剂|洗发水|超市|用品|耗材|化学/.test(cleanText) || sellerName.includes("京东")) {
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

  // 10. 开票人提取
  let drawer = "";
  const mDrawer = cleanText.match(/开票人[:：\s]*([\u4e00-\u9fa5]{2,4})/);
  if (mDrawer) {
    drawer = mDrawer[1];
  }

  // 11. 备注与订单号
  let remarks = fileName || "发票识别";
  const mOrder = cleanText.match(/订单号[:：\s]*([0-9A-Za-z]+)/);
  if (trainRoute) {
    remarks = `行程: ${trainRoute}`;
  } else if (mOrder) {
    remarks = `订单号: ${mOrder[1]}`;
  } else {
    const mRemark = cleanText.match(/备\s*注[：:\s]*([^\n\r]{1,100})/);
    if (mRemark) {
      const remarkText = mRemark[1].trim();
      if (!/统一社会信用|纳税人识别|信用代码/.test(remarkText)) {
        remarks = remarkText;
      }
    }
  }

  // 12. 明细商品全量抽取
  const items: ParsedInvoiceResult["items"] = [];
  const itemMatches = Array.from(cleanText.matchAll(/\*([^*\n\r]{1,30})\*([^\n\r]{1,50})/g));
  if (itemMatches.length > 0) {
    itemMatches.forEach((mIt, idx) => {
      items.push({
        id: `item-${Date.now()}-${idx + 1}`,
        name: `*${mIt[1]}*${mIt[2].trim()}`,
        amount: totalAmountWithTax,
        quantity: 1,
      });
    });
  } else {
    items.push({
      id: `item-${Date.now()}-1`,
      name: sellerName ? `*${category}*物品/服务` : invoiceType,
      amount: totalAmountWithTax,
      quantity: 1,
    });
  }

  return {
    invoiceType,
    invoiceCode,
    invoiceNumber,
    issueDate,
    buyerName: buyerName || "个人",
    buyerTaxId: buyerTaxId || "",
    sellerName: sellerName || "出票服务单位",
    sellerTaxId: sellerTaxId || "",
    totalAmountWithoutTax,
    totalTaxAmount,
    totalAmountWithTax,
    totalAmountWithTaxCN: totalAmountWithTaxCN || numberToRMB(totalAmountWithTax),
    category,
    remarks,
    drawer,
    passengerName,
    passengerId,
    trainRoute,
    items,
  };
}
