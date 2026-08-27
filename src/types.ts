export type InvoiceCategory =
  | "餐饮费"
  | "交通费"
  | "住宿费"
  | "办公用品"
  | "通讯费"
  | "会议费"
  | "软件服务"
  | "培训费"
  | "租金"
  | "其他";

export interface InvoiceItem {
  id: string;
  name: string;
  spec?: string;
  unit?: string;
  quantity?: number;
  price?: number;
  amount: number;
  taxRate?: string;
  taxAmount?: number;
}

export interface InvoiceData {
  id: string;
  invoiceType: string; // e.g. "增值税电子普通发票", "增值税专用发票", "电子发票(普通发票)", "铁路车票", "航空运输电子客票行程单"
  invoiceCode?: string;
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  buyerName: string;
  buyerTaxId?: string;
  sellerName: string;
  sellerTaxId?: string;
  totalAmountWithoutTax: number;
  totalTaxAmount: number;
  totalAmountWithTax: number;
  totalAmountWithTaxCN: string;
  category: InvoiceCategory;
  remarks?: string;
  drawer?: string;
  taxRegion?: string;
  items: InvoiceItem[];
  fileUrl?: string; // Original uploaded file (base64 image/pdf or URL)
  fileName?: string;
  status?: "recognized" | "warning" | "error";
  duplicateWarning?: boolean;
  duplicateGroupIndex?: number; // Color index grouping for duplicate highlighting
  selectedForPrint?: boolean;
  importTime?: string; // 导入发票的时间 (YYYY-MM-DD HH:mm:ss)
  exportBatchTime?: string; // 导出到 Excel 的批次时间戳
  passengerName?: string; // 火车票/客票乘坐人姓名 (如: 李某年)
  passengerId?: string; // 乘坐人身份证号 (如: 130130********2459)
  trainRoute?: string; // 行程路线 (如: 昆山站 K850 苏州站)
  checkCode?: string; // 发票/票据校验码 (如: 6214f3 或 20位防伪校验码)
}

export type GridMode = "1" | "2" | "4"; // 1张/页, 2张/页, 4张/页(2x2)
export type PaperType =
  | "A4"
  | "A5"
  | "B5"
  | "InvoiceSpecial240"
  | "InvoiceSpecial210";

export interface PrintConfig {
  gridMode: GridMode;
  paperType: PaperType;
  showCropLines: boolean;
  showCategoryBadge: boolean;
  marginSize: "compact" | "normal" | "wide";
  orientation: "portrait" | "landscape";
  includeCoverPage: boolean;
  sortBy: "date_asc" | "date_desc" | "amount_desc" | "category" | "invoice_type";
}

export interface ReimbursementCoverData {
  companyName: string;
  department: string;
  applicant: string;
  reimbursementNo: string;
  date: string;
  reason: string;
  approver: string;
  financeAuditor: string;
  cashier: string;
}

export interface SystemSettings {
  aiApiKey: string; // General AI Model API Key (renamed from geminiApiKey)
  baiduApiKey: string; // Baidu Cloud OCR API Key (AK)
  baiduSecretKey: string; // Baidu Cloud OCR Secret Key (SK)
  defaultCompany: string;
  defaultDepartment: string;
  defaultApplicant: string;
  defaultApprover: string;
  defaultFinanceAuditor: string;
  defaultCashier: string;
  autoSaveInvoices: boolean;
  exportPassword?: string; // Password for Excel table protection
  protectExportedExcel?: boolean; // Enable Excel sheet protection
}
