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
  taxRate?: string;
  category: "餐饮费" | "交通费" | "住宿费" | "办公用品" | "通讯费" | "会议费" | "软件服务" | "培训费" | "租金" | "其他";
  remarks: string;
  taxRegion?: string;
  drawer?: string;
  passengerName?: string;
  passengerId?: string;
  trainRoute?: string;
  trainDepartureTime?: string;
  checkCode?: string;
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

  // OCR 常见中文字形混淆容错纠偏
  const normalized = text
    .replace(/[任仠什]/g, "仟")
    .replace(/[伯陌]/g, "佰")
    .replace(/[石]/g, "拾")
    .replace(/[园原图]/g, "圆")
    .replace(/[叄]/g, "叁")
    .replace(/[貳两]/g, "贰");

  const m = normalized.match(/([零壹贰叁参肆伍陆柒捌玖一二三四五六七八九拾佰仟万亿十百千]+[元圆][零壹贰叁参肆伍陆柒捌玖一二三四五六七八九角分整正]*)/) ||
            normalized.match(/([零壹贰叁参肆伍陆柒捌玖一二三四五六七八九拾佰仟万亿十百千]{2,10}[整正])/);
  if (!m) return null;

  const cnStr = m[1];
  const yuanIdx = cnStr.search(/[元圆]/);
  const yuanPart = yuanIdx !== -1 ? cnStr.slice(0, yuanIdx) : cnStr.replace(/[整正]/g, "");
  const rest = yuanIdx !== -1 ? cnStr.slice(yuanIdx + 1) : "";

  let jiaoVal = 0;
  let fenVal = 0;

  const jiaoIdx = rest.indexOf("角");
  if (jiaoIdx !== -1) {
    const jiaoChar = rest.slice(0, jiaoIdx).slice(-1);
    if (CN_NUM_MAP[jiaoChar]) jiaoVal = CN_NUM_MAP[jiaoChar] * 0.1;
    const fenChar = rest.slice(jiaoIdx + 1).replace(/[分整正]/g, "").slice(0, 1);
    if (CN_NUM_MAP[fenChar]) fenVal = CN_NUM_MAP[fenChar] * 0.01;
  } else {
    const fenChar = rest.replace(/[分整正]/g, "").slice(0, 1);
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

export function isGarbledCipher(text: string): boolean {
  if (!text) return true;
  if (/[>!@#$%^<+~`\\]/.test(text)) return true;
  if ((text.match(/[_+\/\\=]/g) || []).length >= 3) return true;
  const validLen = (text.match(/[\u4e00-\u9fa5a-zA-Z0-9]/g) || []).length;
  if (text.length > 4 && validLen / text.length < 0.45) return true;
  return false;
}

/**
 * 文本空间规整化引擎（非破坏性格式规整，保留字段与实体间的自然空格定界）
 */
function normalizeTextStream(rawText: string): string {
  let cleanText = rawText.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");

  // 1. 消除冒号周围的冗余空格 (如 "名称 : " -> "名称:")
  cleanText = cleanText.replace(/\s*([:：])\s*/g, "$1");

  // 2. 规整金额与货币符号 (如 "￥ 11 . 00" -> "￥11.00")
  cleanText = cleanText.replace(/(\d)\s*\.\s*(\d)/g, "$1.$2");
  cleanText = cleanText.replace(/([¥￥])\s*(\d)/g, "$1$2");

  // 3. 规整标准中文日期 (如 "2026 年 03 月 19 日" -> "2026年03月19日")
  cleanText = cleanText.replace(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|\b)/g, "$1年$2月$3日");

  // 4. 拼接铁路客票断开的发票号码
  if (!cleanText.match(/发票号码[:：\s]*\d{18,20}/)) {
    const mTrainInvSplit = cleanText.match(/(26\d{9})[\s\n\r]+(\d{7,10})/);
    if (mTrainInvSplit) {
      cleanText = `发票号码:${mTrainInvSplit[1]}${mTrainInvSplit[2]}\n` + cleanText;
    }
  }

  return cleanText;
}

/**
 * 实体名称专用深度清洗器（剔除左右边框散落的杂字、税号及地址后缀）
 */
function cleanPartyEntityName(rawVal: string): string {
  if (!rawVal) return "";
  let val = rawVal.trim();
  val = val.replace(/(?:统一社会信用|统一信用|纳税人识别|信用代码|税号|地\s*址|电\s*话|开\s*户\s*行|账\s*号|密\s*码).*/, "").trim();
  val = val.replace(/^[（(][^）)]+[）)][:：\s]*/, "").trim();
  
  // 清洗开头处散落的数电发票边框字 (如 "买 售 北京xxx科技...")
  val = val.replace(/^(?:[购买销售方信息\s|/\\-])+/, "").trim();
  // 清洗结尾处散落的数电发票边框字 (如 "北京xxx科技有限公司 售", "广州xxx有限公司 方")
  val = val.replace(/[\s\n\r]+(?:购|买|销|售|方|信|息)+$/, "").trim();
  val = val.replace(/(?:公司|分公司|厂|院|店|社|所|部|局|行|中心|委员会|大学|小学|中学|企业|集团|组织|协会|学会|联合会|商会|基金会|办事处|联络处)(?:[购买销售方信息\s]+)$/, (m) => {
    return m.replace(/[购买销售方信息\s]+$/, "");
  }).trim();

  return val;
}

// -------------------------------------------------------------
// 模板 1：🚄 铁路电子客票专属网格解析器
// -------------------------------------------------------------
function parseRailwayTicketTemplate(cleanText: string, fileName: string): ParsedInvoiceResult {
  const invoiceType = "铁路电子客票";
  const sellerName = "中国国家铁路集团有限公司";
  const sellerTaxId = "-";
  const category: ParsedInvoiceResult["category"] = "交通费";

  let invoiceNumber = "";
  const mInv = cleanText.match(/(?:发票号码|发票号|客票号)[:：\s]*(\d{18,20})/) ||
               cleanText.match(/\b(26\d{18})\b/) ||
               cleanText.match(/\b(\d{20})\b/);
  if (mInv) invoiceNumber = mInv[1];

  let issueDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const mDate = cleanText.match(/(?:开票日期|日期)[:：\s]*(\d{4})\s*年?\s*(\d{1,2})\s*月?\s*(\d{1,2})/) ||
                cleanText.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (mDate) {
    issueDate = `${mDate[1]}-${String(mDate[2]).padStart(2, "0")}-${String(mDate[3]).padStart(2, "0")}`;
  }

  let buyerName = "个人";
  let buyerTaxId = "";
  const mBuyer = cleanText.match(/(?:购买方名称|购买方|抬头|客户)[:：\s]*([^\n\r\t]+)/);
  if (mBuyer) {
    let b = mBuyer[1].replace(/(?:统一社会信用|纳税人识别|信用代码|税号|开票日期).*/, "").trim();
    b = b.replace(/^[（(][^）)]+[）)][:：\s]*/, "").trim();
    if (b && b.length >= 2 && !/^(?:统一社会|纳税人|信用代码)/.test(b)) {
      buyerName = b;
    }
  }
  const mTax = cleanText.match(/(?:统一社会信用代码|纳税人识别号|信用代码|税号)[:：\s]*([A-Za-z0-9]{15,20})/);
  if (mTax) buyerTaxId = mTax[1];

  // 3. 乘车人姓名与脱敏身份证 (支持 10位/6位前缀 + 4星/8星/x 等全格式国铁脱敏及护照)
  let passengerName = "";
  let passengerId = "";
  const passengerBlacklist = /中国|国家|铁路|集团|有限|开票|发票|客票|网站|总局|税务|购买|信息|说明|服务|南京|北京|上海|广州|深圳|杭州|武汉|成都|二等|一等|商务|硬卧|软卧|硬座|无座|车票|票价|合计|金额|人民币|元整/;

  const mMasked = 
    cleanText.match(/\b([1-9]\d{2,11}[\*\.\-xX·•★※_]{2,10}\d{1,6}[0-9Xx]?)\b[\s\n\r]*([\u4e00-\u9fa5]{2,4})(?=[\s\n\r0-9A-Za-z]|$)/) ||
    cleanText.match(/([\u4e00-\u9fa5]{2,4})[\s\n\r]*\b([1-9]\d{2,11}[\*\.\-xX·•★※_]{2,10}\d{1,6}[0-9Xx]?)\b/) ||
    // 完整 18 位身份证
    cleanText.match(/\b([1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx])\b[\s\n\r]*([\u4e00-\u9fa5]{2,4})/) ||
    cleanText.match(/([\u4e00-\u9fa5]{2,4})[\s\n\r]*\b([1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx])\b/) ||
    // 护照/港澳台通行证
    cleanText.match(/\b([GEHMPSCDT]\d{7,8})\b[\s\n\r]*([\u4e00-\u9fa5]{2,4})/) ||
    cleanText.match(/([\u4e00-\u9fa5]{2,4})[\s\n\r]*\b([GEHMPSCDT]\d{7,8})\b/);

  if (mMasked) {
    if (/[0-9GEHMPSCDT]/.test(mMasked[1].slice(0, 1))) {
      passengerId = mMasked[1];
      const cand = mMasked[2].trim();
      if (!passengerBlacklist.test(cand)) passengerName = cand;
    } else {
      passengerId = mMasked[2];
      const cand = mMasked[1].trim();
      if (!passengerBlacklist.test(cand)) passengerName = cand;
    }
  }

  if (!passengerName) {
    const mDirectP = cleanText.match(/(?:乘车人|旅客姓名|乘机人|出行人|姓名)[:：\s]*([\u4e00-\u9fa5]{2,4})(?=[\s\n\r0-9A-Za-z]|$)/);
    if (mDirectP && !passengerBlacklist.test(mDirectP[1])) {
      passengerName = mDirectP[1].trim();
    }
  }

  const mTrainNo = cleanText.match(/\b([GDCKTZYS][0-9]{1,4})\b/i) || cleanText.match(/\b(?!202\d|203\d|19\d\d)([1-9][0-9]{3})\b/);
  let trainNo = mTrainNo ? mTrainNo[1].toUpperCase() : "";

  let startStation = "";
  let endStation = "";
  const mRouteBlock = cleanText.match(/([\u4e00-\u9fa5]{2,8}(?:\s*站|\s*东|\s*南|\s*西|\s*北|\s*新区|\s*机场)?)(?:[^\u4e00-\u9fa50-9]{0,35})\b([GDCKTZYS][0-9]{1,4})\b(?:[^\u4e00-\u9fa50-9]{0,35})([\u4e00-\u9fa5]{2,8}(?:\s*站|\s*东|\s*南|\s*西|\s*北|\s*新区|\s*机场)?)/i);
  if (mRouteBlock) {
    const s1 = mRouteBlock[1].replace(/^(?:[年月日号期票站开乘发到终始位]|始发|乘车|开票|改签|退票|旅客)+/, "").replace(/\s*站$/, "").trim();
    const s2 = mRouteBlock[3].replace(/^(?:[年月日号期票站开乘发到终始位]|到达|终到|终点)+/, "").replace(/\s*站$/, "").trim();
    if (s1.length >= 2 && s2.length >= 2 && !/中国|国家|铁路|发票|客票|网站|总局|税务/.test(s1) && !/中国|国家|铁路|发票|客票|网站|总局|税务/.test(s2)) {
      startStation = s1;
      trainNo = mRouteBlock[2].toUpperCase();
      endStation = s2;
    }
  }

  if (!startStation || !endStation) {
    const stationMatches = Array.from(cleanText.matchAll(/([\u4e00-\u9fa5]{2,6}\s*站)/g))
      .map(m => m[1].replace(/^(?:[年月日号期票站开乘发到终始位]|始发|乘车|开票|改签|退票|旅客)+/, "").replace(/\s*站$/, "").trim())
      .filter(s => s.length >= 2 && !/中国|国家|铁路|集团|有限|开票|发票|客票|网站|总局|税务|购买|信息|说明|服务/.test(s));
    if (stationMatches.length >= 2) {
      startStation = stationMatches[0];
      endStation = stationMatches[1];
    }
  }

  const trainRoute = startStation && endStation ? `${startStation}站 ${trainNo} ${endStation}站` : (trainNo ? `${trainNo} 铁路客票` : "铁路电子客票");

  // 5. 发车时间
  let trainDepartureTime = "";
  const mFullDep = cleanText.match(/(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)[\s\n\rA-Za-z0-9车号座卧]*?(\d{1,2}[:：]\d{2}(?:\s*开)?)/);
  if (mFullDep) {
    const d = mFullDep[1].replace(/\s+/g, "");
    let t = mFullDep[2].replace(/\s+/g, "");
    if (!t.endsWith("开")) t += "开";
    trainDepartureTime = `${d} ${t}`;
  }

  // 6. 票价金额
  let totalAmountWithTax = 0;
  const mPrice = cleanText.match(/(?:票价|车票票价|合计|金额|小写)\s*[:：]?\s*[¥￥]?\s*([0-9,，\s]+\.\s*\d{2})/) ||
                 cleanText.match(/[¥￥]\s*([0-9,，\s]+\.\s*\d{2})/);
  if (mPrice) {
    totalAmountWithTax = parseFloat(mPrice[1].replace(/[,，\s]/g, ""));
  }

  const remarks = [
    trainRoute,
    passengerName ? `乘车人:${passengerName}` : "",
    trainDepartureTime,
  ].filter(Boolean).join(" ");

  const items = [{
    id: `item-${Date.now()}-1`,
    name: passengerName ? `*客运服务*(${passengerName})` : "*铁路客运服务*",
    amount: totalAmountWithTax,
    quantity: 1,
    taxRate: "0%",
    taxAmount: 0,
  }];

  return {
    invoiceType,
    invoiceCode: "",
    invoiceNumber,
    issueDate,
    buyerName,
    buyerTaxId,
    sellerName,
    sellerTaxId,
    totalAmountWithoutTax: totalAmountWithTax,
    totalTaxAmount: 0,
    totalAmountWithTax,
    totalAmountWithTaxCN: numberToRMB(totalAmountWithTax),
    taxRate: "0%",
    category,
    remarks,
    passengerName,
    passengerId,
    trainRoute,
    trainDepartureTime,
    items,
  };
}

// -------------------------------------------------------------
// 模板 2：🏛️ 财政非税收入统一票据专属网格解析器
// -------------------------------------------------------------
function parseNonTaxInvoiceTemplate(cleanText: string, fileName: string): ParsedInvoiceResult {
  const invoiceType = "非税收入统一票据";

  let invoiceCode = "";
  const mCode = cleanText.match(/(?:票\s*据\s*代\s*码|发\s*票\s*代\s*码)[:：\s]*(\d{8,12})/);
  if (mCode) invoiceCode = mCode[1];

  let invoiceNumber = "";
  const mNum = cleanText.match(/(?:票\s*据\s*号\s*码|发\s*票\s*号\s*码|发\s*票\s*号|票\s*据\s*号)[:：\s]*(\d{8,20})/) || cleanText.match(/\b(0\d{9})\b/);
  if (mNum) invoiceNumber = mNum[1];

  let checkCode = "";
  const mCheck = cleanText.match(/(?:校\s*验\s*码)[:：\s]*([0-9a-zA-Z]{6,20})/);
  if (mCheck) checkCode = mCheck[1].trim();

  let issueDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const mDate = cleanText.match(/(?:开\s*票\s*日\s*期|日\s*期)[:：\s]*(\d{4})\s*年?\s*(\d{1,2})\s*月?\s*(\d{1,2})/) ||
                cleanText.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (mDate) {
    issueDate = `${mDate[1]}-${String(mDate[2]).padStart(2, "0")}-${String(mDate[3]).padStart(2, "0")}`;
  }

  // 划分发票的 表头区、中间明细区、底部结算区
  const tableIndex = cleanText.search(/(?:项\s*目\s*编\s*码|项\s*目\s*名\s*称|货\s*物\s*或\s*应\s*税|金\s*额\s*合\s*计|其\s*他\s*信\s*息|其\s*它\s*信\s*息|收\s*款\s*单\s*位)/);
  const footerIndex = cleanText.search(/(?:收\s*款\s*单\s*位|其\s*他\s*信\s*息|其\s*它\s*信\s*息|金\s*额\s*合\s*计|合\s*计)/);

  const headerSection = tableIndex !== -1 ? cleanText.slice(0, tableIndex) : cleanText;
  const footerSection = footerIndex !== -1 ? cleanText.slice(footerIndex) : cleanText;

  // 1. 先提取收款单位（章）- 销售方网格锚点
  let sellerName = "出票服务单位";
  const mPayee = cleanText.match(/(?:收\s*款\s*单\s*位\s*(?:（\s*章\s*）|\(\s*章\s*\)|（章）|\(章\))?|执\s*贴\s*单\s*位|开\s*票\s*单\s*位|收\s*款\s*方|出\s*票\s*机\s*构)[:：\s]*([^\n\r\t]+)/);
  if (mPayee) {
    let s = mPayee[1].replace(/(?:复核人|收款人|开票人|项目编码|统一社会信用|业务专用章|财务专用章|发票专用章|其他信息).*/, "").trim();
    s = cleanPartyEntityName(s);
    if (s && s.length >= 2 && !/^(?:复核人|收款人|开票人|统一社会|其他信息)/.test(s)) {
      sellerName = s;
    }
  }

  if (sellerName === "出票服务单位") {
    const candidatePayees = Array.from(
      footerSection.matchAll(/([\u4e00-\u9fa5]{4,40}(?:协会|学会|联合会|商会|基金会|办事处|管理局|自来水|燃气|供电|水务|集团|公司|中心|委员会|学校|局|院|所|社))/g)
    ).map(m => cleanPartyEntityName(m[1])).filter(e => !/^(?:非税收入|统一票据|财政部|财政局|电子票据|收款单位|复核人|收款人|其他信息)/.test(e));

    if (candidatePayees.length > 0) {
      sellerName = candidatePayees[0];
    }
  }

  if (sellerName === "出票服务单位" && cleanText.includes("自来水")) {
    sellerName = "北京市自来水集团有限责任公司";
  }

  // 2. 交款人信息 (购买方网格锚点：交款人)
  let buyerName = "个人";
  // 策略 A: 匹配同行或换行的交款人
  const payerMatches = Array.from(
    headerSection.matchAll(
      /(?:(?:^|[\s\n\r])(?:交\s*款\s*人|交\s*款\s*单\s*位|客\s*户|付\s*款\s*人|交\s*款\s*方|购\s*买\s*方|购\s*买\s*单\s*位))(?:\s*[（(][^）)]+[）)])?(?![\s\t]*(?:统一社会信用|统一信用|纳税人识别|纳税人|信用代码|税号|代码|识别号))[:：\s]*\n*([^\n\r\t]+)/g
    )
  );

  for (const m of payerMatches) {
    let b = m[1].replace(/(?:票据号码|发票号码|统一社会信用|纳税人识别|信用代码|税号|开票日期|校验码|项目编码|项目名称|代码).*/, "").trim();
    b = cleanPartyEntityName(b);
    if (b.length >= 2 && !/^(?:统一社会|纳税人|信用代码|票据号码|校验码|开票日期|代码|税号|项目)/.test(b) && b !== sellerName) {
      buyerName = b;
      break;
    }
  }

  // 策略 B: 从表头区扫描政府机关、企事业单位或社会机构（支持联络处/办事处/政府）
  if (buyerName === "个人") {
    const candidateEntities = Array.from(
      headerSection.matchAll(/([\u4e00-\u9fa5]{4,40}(?:有限责任公司|股份有限公司|有限公司|分公司|公司|学校|局|院|所|中心|委员会|大学|小学|中学|企业|集团|组织|协会|学会|联合会|商会|基金会|政府|联络处|办事处|部|队|馆|社))/g)
    ).map(m => cleanPartyEntityName(m[1])).filter(e => !/^(?:非税收入|统一票据|电子票据|财政部|财政局|社会团体|交款人|收款单位)/.test(e) && e !== sellerName);

    if (candidateEntities.length > 0) {
      buyerName = candidateEntities[0];
    }
  }

  // 3. 统一社会信用代码 (交款人税号)
  let buyerTaxId = "";
  const mTax = cleanText.match(/(?:交\s*款\s*人\s*统\s*一\s*社\s*会\s*信\s*用\s*代\s*码|交\s*款\s*人\s*统\s*一\s*信\s*用\s*代\s*码|交\s*款\s*人\s*纳\s*税\s*人\s*识\s*别\s*号|统\s*一\s*社\s*会\s*信\s*用\s*代\s*码|纳\s*税\s*人\s*识\s*别\s*号|信\s*用\s*代\s*码|税\s*号)[:：\s]*([A-Za-z0-9]{15,20})/);
  if (mTax) {
    buyerTaxId = mTax[1].trim();
  } else {
    const mCreditCode = headerSection.match(/\b([1-9A-GY][1-9]\d{5}[0-9A-HJ-NPQRTUWXY]{10}[0-9A-HJ-NPQRTUWXY]?)\b/);
    if (mCreditCode) buyerTaxId = mCreditCode[1];
  }

  let totalAmountWithTax = 0;
  const cnAmount = parseChineseAmount(cleanText);
  if (cnAmount && cnAmount > 0) totalAmountWithTax = cnAmount;

  if (totalAmountWithTax === 0) {
    const mPrice = cleanText.match(/(?:（小写）|\(小写\)|小写|金额合计|合计|金额)\s*[:：]?\s*[¥￥]?\s*([0-9,，\s]+\.\s*\d{2})/) ||
                   cleanText.match(/[¥￥]\s*([0-9,，\s]+\.\s*\d{2})/);
    if (mPrice) totalAmountWithTax = parseFloat(mPrice[1].replace(/[,，\s]/g, ""));
  }

  let remarks = "-";
  const mOther = cleanText.match(/(?:其他信息|其它信息)[:：\s]*([^\n\r]{1,100})/);
  if (mOther) {
    let r = mOther[1].replace(/(?:收款单位|复核人|收款人|开票人|发票号码|统一社会信用).*/, "").trim();
    if (r && !/统一社会信用|纳税人识别/.test(r)) remarks = r;
  }
  if (remarks === "-" || !remarks) {
    const mUser = cleanText.match(/(用户编号[:：\s]*\d+(?:\s*账期[:：\s]*\d{4}-\d{2})?)/);
    if (mUser) remarks = mUser[1];
  }

  let itemName = cleanText.includes("会费") ? "社会团体会费" : "非税规费";
  const mTableItem = cleanText.match(/(?:项目名称|项目编码)[\s\S]*?(?:\d{3,6})?\s+([\u4e00-\u9fa50-9（）()]{2,25}(?:会费|费用|款|费|金|费))\s+(?:年|次|吨|人|月|套|件|批|项)/);
  if (mTableItem) {
    itemName = mTableItem[1].trim();
  } else {
    const mItemFee = cleanText.match(
      /([\u4e00-\u9fa50-9（）()]{2,25}(?:会费|社会团体会费|会员费|污水处理费|水资源费|水费|电费|学费|住宿费|管理费|排污费|垃圾处理费|规费|服务费|捐赠款|医疗费|培训费|考试费))/
    );
    if (mItemFee) {
      itemName = mItemFee[1].trim();
    }
  }

  const items = [{
    id: `item-${Date.now()}-1`,
    name: `*财政票据*${itemName}`,
    amount: totalAmountWithTax,
    quantity: 1,
    taxRate: "免税",
    taxAmount: 0,
  }];

  return {
    invoiceType,
    invoiceCode,
    invoiceNumber,
    issueDate,
    buyerName,
    buyerTaxId,
    sellerName,
    sellerTaxId: "",
    totalAmountWithoutTax: totalAmountWithTax,
    totalTaxAmount: 0,
    totalAmountWithTax,
    totalAmountWithTaxCN: numberToRMB(totalAmountWithTax),
    taxRate: "免税",
    category: "其他",
    remarks,
    checkCode,
    items,
  };
}

// -------------------------------------------------------------
// 模板 3：🏢 数电发票 / 增值税电子发票标准网格解析器
// -------------------------------------------------------------
function parseDigitalVatInvoiceTemplate(cleanText: string, fileName: string): ParsedInvoiceResult {
  let invoiceType = "增值税电子普通发票";
  if (/全面数字化|数电/.test(cleanText)) {
    invoiceType = cleanText.includes("专用") ? "数电发票（专用发票）" : "数电发票（普通发票）";
  } else if (/专用发票/.test(cleanText)) {
    invoiceType = "增值税专用发票";
  }

  let invoiceNumber = "";
  const mInv = cleanText.match(/(?:发票号码|发票号)[:：\s]*(\d{18,20})/) ||
               cleanText.match(/\b(2\d{19})\b/) ||
               cleanText.match(/\b(\d{20})\b/) ||
               cleanText.match(/\b(\d{8,12})\b/);
  if (mInv) invoiceNumber = mInv[1];

  let invoiceCode = "";
  const mCode = cleanText.match(/(?:发票代码|票据代码)[:：\s]*(\d{8,12})/);
  if (mCode) invoiceCode = mCode[1];

  let issueDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const mDate = cleanText.match(/(?:开票日期|日期)[:：\s]*(\d{4})\s*年?\s*(\d{1,2})\s*月?\s*(\d{1,2})/) ||
                cleanText.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (mDate) {
    issueDate = `${mDate[1]}-${String(mDate[2]).padStart(2, "0")}-${String(mDate[3]).padStart(2, "0")}`;
  }

  // 2. 购买方与销售方主体及税号提取 (适配数电发票左右双列并排与传统发票上下分块版面)
  let buyerName = "个人";
  let buyerTaxId = "";
  let sellerName = "出票服务单位";
  let sellerTaxId = "";

  // 截取发票表头主体信息区（在项目名称/规格型号/货物或应税劳务/合计之前）
  const headerSectionMatch = cleanText.match(/[\s\S]*?(?=(?:项目名称|规格型号|货物或应税|合\s*计|价税合计|$))/);
  const headerSection = headerSectionMatch ? headerSectionMatch[0] : cleanText;

  // 提取所有 "名称:" 实体 (严格排除 "项目名称" / "服务名称" / "货物名称")
  const nameRegex = /(?<!项目|服务|劳务|货物)(?:名\s*称)[:：\s]*([^\n\r\t]+)/g;
  const nameEntries: string[] = [];
  let mNameMatch: RegExpExecArray | null;
  while ((mNameMatch = nameRegex.exec(headerSection)) !== null) {
    const parts = mNameMatch[1].split(/(?:(?<!项目|服务|劳务|货物)名\s*称[:：\s]*|销\s*售\s*方|购\s*买\s*方)/);
    for (const p of parts) {
      const val = cleanPartyEntityName(p);
      if (
        val.length >= 2 &&
        !/^(?:统一社会|纳税人|信用代码|地址|电话|发票|项目|货物|规格|金额|税率|税额|单位|数量)/.test(val) &&
        !/(?:规格型号|单位|数量|单价|金额|税率|税额)/.test(val)
      ) {
        nameEntries.push(val);
      }
    }
  }

  // 备用：从 购买方/销售方 关键词直接提取
  if (nameEntries.length < 2) {
    const mDirectBuyer = headerSection.match(/(?:购\s*买\s*方|客\s*户|抬\s*头|交\s*款\s*人)(?:信息)?[:：\s]*([^\n\r\t]{2,50})/);
    if (mDirectBuyer) {
      let val = mDirectBuyer[1].replace(/^(?:名称|名\s*称)[:：\s]*/, "").replace(/(?:统一社会信用|纳税人识别|信用代码|税号|地\s*址|电\s*话|销\s*售\s*方).*/, "").trim();
      val = cleanPartyEntityName(val);
      if (val.length >= 2 && !nameEntries.includes(val) && !/^(?:统一社会|纳税人|信用代码|地址|电话)/.test(val)) {
        nameEntries.unshift(val);
      }
    }
    const mDirectSeller = headerSection.match(/(?:销\s*售\s*方|出\s*票\s*单\s*位|出\s*票\s*机\s*构|收\s*款\s*单\s*位|开\s*票\s*单\s*位)(?:信息)?[:：\s]*([^\n\r\t]{2,50})/);
    if (mDirectSeller) {
      let val = mDirectSeller[1].replace(/^(?:名称|名\s*称)[:：\s]*/, "").replace(/(?:统一社会信用|纳税人识别|信用代码|税号|地\s*址|电\s*话|备\s*注).*/, "").trim();
      val = cleanPartyEntityName(val);
      if (val.length >= 2 && !nameEntries.includes(val) && !/^(?:统一社会|纳税人|信用代码|地址|电话)/.test(val)) {
        nameEntries.push(val);
      }
    }
  }

  // 提取所有 15-20 位税号
  const taxIdMatches = Array.from(
    headerSection.matchAll(/(?:统一社会信用代码(?:\/纳税人识别号)?|纳税人识别号|信用代码|税号)[:：\s]*([A-Za-z0-9]{15,20})/g)
  ).map(m => m[1]);

  if (taxIdMatches.length === 0) {
    const rawTaxIds = Array.from(headerSection.matchAll(/\b([A-Za-z0-9]{15,20})\b/g))
      .map(m => m[1])
      .filter(id => !/^\d{20}$/.test(id) && !id.startsWith("202") && !id.startsWith("26"));
    taxIdMatches.push(...rawTaxIds);
  }

  if (nameEntries.length >= 2) {
    buyerName = cleanPartyEntityName(nameEntries[0]);
    sellerName = cleanPartyEntityName(nameEntries[1]);
  } else if (nameEntries.length === 1) {
    const namePos = headerSection.indexOf(nameEntries[0]);
    const sellerPos = headerSection.indexOf("销售方");
    if (sellerPos !== -1 && namePos > sellerPos) {
      sellerName = cleanPartyEntityName(nameEntries[0]);
    } else {
      buyerName = cleanPartyEntityName(nameEntries[0]);
    }
  }

  if (taxIdMatches.length >= 2) {
    buyerTaxId = taxIdMatches[0];
    sellerTaxId = taxIdMatches[1];
  } else if (taxIdMatches.length === 1) {
    if (sellerName !== "出票服务单位" && buyerName === "个人") {
      sellerTaxId = taxIdMatches[0];
    } else {
      buyerTaxId = taxIdMatches[0];
    }
  }

  let totalAmountWithTax = 0;
  const cnAmount = parseChineseAmount(cleanText);
  if (cnAmount && cnAmount > 0) totalAmountWithTax = cnAmount;

  if (totalAmountWithTax === 0) {
    const decimalPatterns = [
      /(?:价税合计|价税\s*合\s*计)[^0-9¥￥\n\r]*[¥￥]?\s*[:：]?\s*([0-9,，\s]+\.\s*\d{2})/,
      /(?:（小写）|\(小写\)|小写)[^0-9¥￥\n\r]*[¥￥]?\s*([0-9,，\s]+\.\s*\d{2})/,
      /[¥￥]\s*([0-9,，\s]+\.\s*\d{2})/,
    ];
    for (const pat of decimalPatterns) {
      const m = cleanText.match(pat);
      if (m) {
        const val = parseFloat(m[1].replace(/[,，\s]/g, ""));
        if (!isNaN(val) && val > 0) {
          totalAmountWithTax = val;
          break;
        }
      }
    }
  }

  let totalAmountWithoutTax = 0;
  let totalTaxAmount = 0;
  let taxRate = "0%";

  const mRate = cleanText.match(/(?:税\s*率|征收率)[:：\s]*(\d{1,2}%|免税|不征税|0%)/i) ||
                cleanText.match(/\b(13%|9%|6%|5%|3%|1%|0%)\b/);
  if (mRate) taxRate = mRate[1].toUpperCase();

  const mTax = cleanText.match(/(?:合\s*计\s*税\s*额|税\s*额)[：:\s]*[¥￥]?\s*([0-9,，]+\.\d{2})/);
  if (mTax) {
    const val = parseFloat(mTax[1].replace(/[,，]/g, ""));
    if (!isNaN(val) && val < totalAmountWithTax) totalTaxAmount = val;
  }

  const mWithoutTax = cleanText.match(/(?:(?:不含税金额|合\s*计|金\s*额)[：:\s]*[¥￥]?\s*([0-9,，]+\.\d{2}))/);
  if (mWithoutTax) {
    const val = parseFloat(mWithoutTax[1].replace(/[,，]/g, ""));
    if (!isNaN(val) && val <= totalAmountWithTax) totalAmountWithoutTax = val;
  }

  if (totalTaxAmount > 0 && totalAmountWithTax > 0) {
    if (totalAmountWithoutTax === 0 || Math.abs((totalAmountWithoutTax + totalTaxAmount) - totalAmountWithTax) > 0.05) {
      totalAmountWithoutTax = Math.round((totalAmountWithTax - totalTaxAmount) * 100) / 100;
    }
  } else if (totalAmountWithoutTax > 0 && totalAmountWithTax > 0 && totalAmountWithTax > totalAmountWithoutTax) {
    totalTaxAmount = Math.round((totalAmountWithTax - totalAmountWithoutTax) * 100) / 100;
  } else if (totalAmountWithTax > 0 && totalAmountWithoutTax === 0) {
    totalAmountWithoutTax = totalAmountWithTax;
    totalTaxAmount = 0;
  }

  // 4. 费用类别智能分类
  let category: ParsedInvoiceResult["category"] = "其他";
  if (/餐饮|饭店|麦当劳|肯德基|海底捞|酒楼|美食|餐馆|咖啡/.test(cleanText)) category = "餐饮费";
  else if (/火车|高铁|机票|行程单|出租车|滴滴|交通/.test(cleanText)) category = "交通费";
  else if (/酒店|宾馆|客栈|民宿|住宿|希尔顿|万豪|全季|汉庭/.test(cleanText)) category = "住宿费";
  else if (/办公|文具|纸|打印|晨光|齐心|京东|超市|用品|耗材/.test(cleanText) || sellerName.includes("京东")) category = "办公用品";
  else if (/电信|移动|联通|通讯|话费/.test(cleanText)) category = "通讯费";
  else if (/软件|信息技术|网络|云|系统|开发/.test(cleanText)) category = "软件服务";
  else if (/培训|学杂费|学费|讲座/.test(cleanText)) category = "培训费";
  else if (/租金|房租|租赁/.test(cleanText)) category = "租金";

  // 5. 备注提取 (剥离底注噪点)
  let remarks = "-";
  const mRemark = cleanText.match(/(?:备\s*注|其他信息|其它信息)[：:\s]*([^\n\r]{1,100})/);
  if (mRemark) {
    let remarkText = mRemark[1].trim();
    if (!/统一社会信用|纳税人识别|信用代码|开票人|收款人|复核|发票号码|发票代码/.test(remarkText)) {
      let r = remarkText.replace(/(?:开票人|收款人|复核|发票号码|销售方|购买方|\d{16,20}).*/, "").trim();
      remarks = r ? r.slice(0, 35).trim() : "-";
    }
  }

  // 6. 商品明细提取
  const items: ParsedInvoiceResult["items"] = [];
  const itemMatches = Array.from(cleanText.matchAll(/\*([^*\n\r\t]{1,30})\*([^\n\r\t]{1,100})/g));
  if (itemMatches.length > 0) {
    itemMatches.forEach((mIt, idx) => {
      const cat = mIt[1].trim();
      let namePart = mIt[2].trim();
      namePart = namePart
        .replace(/\s+(?:20\d{4}|\d{4}-\d{2}|\d{6})[月期\s].*/, "")
        .replace(/\s+\d+(\.\d+)?\s+\d+(\.\d+)?(?:\s+\d+(\.\d+)?)?.*/, "")
        .replace(/(?:合\s*计|价税合计|（大写）|\(大写\)|大写|小写|备\s*注|开票人|纳税人|统一社会信用|购买方|销售方|税率|税额).*/, "")
        .replace(/[;；*¥￥]+.*/, "")
        .trim();
      if (namePart.length > 35) namePart = namePart.slice(0, 35).trim();
      const cleanName = `*${cat}*${namePart}`;
      if (!isGarbledCipher(cleanName) && namePart.length > 0) {
        items.push({
          id: `item-${Date.now()}-${idx + 1}`,
          name: cleanName,
          amount: totalAmountWithTax,
          quantity: 1,
          taxRate,
          taxAmount: totalTaxAmount,
        });
      }
    });
  }

  if (items.length === 0) {
    items.push({
      id: `item-${Date.now()}-1`,
      name: sellerName && sellerName !== "出票服务单位" ? `*${category}*${sellerName}服务` : `*${category}*服务`,
      amount: totalAmountWithTax,
      quantity: 1,
      taxRate,
      taxAmount: totalTaxAmount,
    });
  }

  return {
    invoiceType,
    invoiceCode,
    invoiceNumber,
    issueDate,
    buyerName,
    buyerTaxId,
    sellerName,
    sellerTaxId,
    totalAmountWithoutTax,
    totalTaxAmount,
    totalAmountWithTax,
    totalAmountWithTaxCN: numberToRMB(totalAmountWithTax),
    taxRate,
    category,
    remarks,
    items,
  };
}

// -------------------------------------------------------------
// 模板 4：🧾 商业电子收据专属高精度网格解析器
// -------------------------------------------------------------
function parseCommercialReceiptTemplate(cleanText: string, fileName: string): ParsedInvoiceResult {
  const invoiceType = "其他发票";

  // 1. 收据单号 (优先提取 No. 44322051-00001445 或 收款单号: 1537850742643612366)
  let invoiceNumber = "";
  const mNo = cleanText.match(/(?:No\.?|收据号|收据单号|单号|编号)[:：\s]*([0-9A-Za-z-]+)/i);
  if (mNo) {
    invoiceNumber = mNo[1].trim();
  } else {
    const mPayOrder = cleanText.match(/(?:收款单号|单号)[:：\s]*(\d{10,25})/);
    if (mPayOrder) invoiceNumber = mPayOrder[1].trim();
    else {
      const mAnyNum = cleanText.match(/\b([A-Za-z0-9-]{8,22})\b/);
      if (mAnyNum) invoiceNumber = mAnyNum[1];
    }
  }

  // 2. 开票日期
  let issueDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const mDate = cleanText.match(/(?:开\s*票\s*日\s*期|日\s*期|时\s*间)[:：\s]*(\d{4})\s*年?\s*(\d{1,2})\s*月?\s*(\d{1,2})/) ||
                cleanText.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (mDate) {
    issueDate = `${mDate[1]}-${String(mDate[2]).padStart(2, "0")}-${String(mDate[3]).padStart(2, "0")}`;
  }

  // 3. 销售方名称 (出票公司 / 收款方)
  let sellerName = "出票服务单位";
  const mTopCompany = cleanText.match(/([^\n\r\t]{3,40}(?:有限责任公司|股份有限公司|有限公司|分公司|公司|超市|酒店|饭店|商行|中心|商户|部|社))/);
  if (mTopCompany) {
    let s = cleanPartyEntityName(mTopCompany[1]);
    if (s && s.length >= 2 && !/^(?:电子收据|收据|开户行|客户)/.test(s)) sellerName = s;
  }
  if (sellerName === "出票服务单位") {
    const mPayeeBlock = cleanText.match(/(?:收款方|收款单位|出票单位)[\s\S]*?(?:名\s*称)[:：\s]*([^\n\r\t]+)/);
    if (mPayeeBlock) {
      let s = mPayeeBlock[1].replace(/(?:开户行|账号|收款方|开票人|备注).*/, "").trim();
      s = cleanPartyEntityName(s);
      if (s && s.length >= 2) sellerName = s;
    }
  }

  // 4. 购买方名称 (客户/交款人)
  let buyerName = "个人";
  const mPayer = cleanText.match(/(?:客户\s*[（(][^）)]+[）)]|交\s*款\s*人\s*[（(][^）)]+[）)]|客户|交\s*款\s*人|付\s*款\s*人|交\s*款\s*单\s*位)[:：\s|]*([^\n\r\t]+)/);
  if (mPayer) {
    let b = mPayer[1].replace(/^(?:[交款人单位（(）)]|\/|\\|\||:)+/, "").trim();
    b = b.replace(/(?:序号|项目名称|金额|合计|日期|开票日期|规格型号|单价).*/, "").trim();
    b = cleanPartyEntityName(b);
    if (b && b.length >= 2 && b !== sellerName) buyerName = b;
  }

  // 5. 金额合计
  let totalAmountWithTax = 0;
  const cnAmount = parseChineseAmount(cleanText);
  if (cnAmount && cnAmount > 0) totalAmountWithTax = cnAmount;

  if (totalAmountWithTax === 0) {
    const mPrice = cleanText.match(/(?:（小写）|\(小写\)|小写|实收|应收|合计|金额)\s*[:：]?\s*[¥￥]?\s*([0-9,，\s]+\.?\d*)/) ||
                   cleanText.match(/[¥￥]\s*([0-9,，\s]+\.?\d*)/);
    if (mPrice) {
      let val = parseFloat(mPrice[1].replace(/[,，\s]/g, ""));
      if (!isNaN(val)) totalAmountWithTax = val;
    }
  }

  // 6. 备注
  let remarks = "-";
  const mRemark = cleanText.match(/(?:备\s*注)[:：\s]*([^\n\r\t]+)/);
  if (mRemark) {
    let r = mRemark[1].replace(/(?:开票人|收款人|复核人).*/, "").trim();
    if (r && r !== "-") remarks = r;
  }

  // 7. 商品明细项
  let itemName = "生活费";
  const mReceiptItem = cleanText.match(/(?:1|01)\s+([\u4e00-\u9fa50-9（）()]{2,20})\s+(?:[0-9,，\s]+\.?\d*)/) ||
                       cleanText.match(/(?:项目名称|费用名称|款项内容|项目|事由|用途)[:：\s]*([\u4e00-\u9fa5]{2,15})/) ||
                       cleanText.match(/([\u4e00-\u9fa5]{2,10}(?:生活费|房租|租金|物业费|水电费|水费|电费|服务费|管理费|押金|预付款|学费))/);
  if (mReceiptItem) {
    let it = mReceiptItem[1].replace(/(?:收据|公司).*/, "").trim();
    if (it) itemName = it;
  }

  const items = [{
    id: `item-${Date.now()}-1`,
    name: `*${itemName}*`,
    amount: totalAmountWithTax,
    quantity: 1,
    taxRate: "免税",
    taxAmount: 0,
  }];

  return {
    invoiceType,
    invoiceCode: "",
    invoiceNumber: invoiceNumber || "R" + Date.now().toString().slice(-8),
    issueDate,
    buyerName,
    buyerTaxId: "",
    sellerName,
    sellerTaxId: "",
    totalAmountWithoutTax: totalAmountWithTax,
    totalTaxAmount: 0,
    totalAmountWithTax,
    totalAmountWithTaxCN: numberToRMB(totalAmountWithTax),
    taxRate: "免税",
    category: "其他",
    remarks,
    items,
  };
}

/**
 * 主调度引擎：智能分流至各大法定/标准模板解析器
 */
export function parseInvoiceTextWithRules(rawText: string, fileName: string = ""): ParsedInvoiceResult {
  const cleanText = normalizeTextStream(rawText);

  // 1. 铁路电子客票专属模板
  if (/铁\s*路\s*电\s*子\s*客\s*票|火\s*车\s*票|铁\s*路\s*电\s*子|电\s*子\s*客\s*票|12306/.test(cleanText)) {
    return parseRailwayTicketTemplate(cleanText, fileName);
  }

  // 2. 商业电子收据专属模板 (如企业自开电子收据、报销小票、收款凭证，无国家防伪二维码)
  if (
    (/电\s*子\s*收\s*据|收\s*据|收\s*款\s*单\s*号|收\s*款\s*凭\s*证|收\s*条/.test(cleanText) || fileName.includes("收据")) &&
    !/非\s*税\s*收\s*入|社\s*会\s*团\s*体|团\s*体\s*会\s*费|财\s*政\s*部\s*监\s*制|财\s*政\s*局\s*监\s*制|增\s*值\s*税/.test(cleanText)
  ) {
    return parseCommercialReceiptTemplate(cleanText, fileName);
  }

  // 3. 财政电子票据专属模板（非税收入、社会团体会费、公益捐赠、医疗收费、学杂费等财政部/财政局监制票据）
  if (
    /非\s*税\s*收\s*入|社\s*会\s*团\s*体|团\s*体\s*会\s*费|会\s*费\s*统\s*一\s*票\s*据|统\s*一\s*票\s*据|财\s*政\s*电\s*子|财\s*政\s*部\s*监\s*制|财\s*政\s*局\s*监\s*制|捐\s*赠\s*统\s*一\s*票\s*据|医\s*疗\s*收\s*费|学\s*杂\s*费/.test(
      cleanText
    ) ||
    fileName.includes("非税") ||
    fileName.includes("会费") ||
    fileName.includes("票据")
  ) {
    return parseNonTaxInvoiceTemplate(cleanText, fileName);
  }

  // 4. 通用商业收据兜底
  if (/收\s*据|收\s*条|交\s*款\s*单/.test(cleanText) || fileName.includes("收据") || fileName.includes("副本")) {
    return parseCommercialReceiptTemplate(cleanText, fileName);
  }

  // 5. 数电发票 / 增值税电子发票标准模板 (默认)
  return parseDigitalVatInvoiceTemplate(cleanText, fileName);
}

