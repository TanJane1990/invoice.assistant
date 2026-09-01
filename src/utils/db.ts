import { InvoiceData } from "../types";

const DB_NAME = "InvoiceAssistantDB";
const DB_VERSION = 1;
const STORE_NAME = "invoices";

let dbInstance: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not supported in this environment"));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * 异步从 IndexedDB 加载全部发票数据
 * 若 IndexedDB 为空，自动从旧版 localStorage 读取并无缝迁移至 IndexedDB
 */
export async function loadInvoicesFromDb(): Promise<InvoiceData[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const invoices: InvoiceData[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (invoices && invoices.length > 0) {
      return invoices;
    }

    // 平滑数据迁移：若 IndexedDB 为空，尝试从旧版 localStorage 迁移数据
    if (typeof window !== "undefined" && window.localStorage) {
      const legacyData = localStorage.getItem("saved_invoices_v1");
      if (legacyData) {
        try {
          const parsed = JSON.parse(legacyData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // 异步存入 IndexedDB
            await saveInvoicesToDbDirect(parsed);
            return parsed;
          }
        } catch (e) {
          console.warn("Legacy localStorage invoice parse error:", e);
        }
      }
    }

    return [];
  } catch (err) {
    console.warn("Load invoices from IndexedDB failed, fallback to localStorage:", err);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = localStorage.getItem("saved_invoices_v1") || localStorage.getItem("saved_invoices_metadata_v1");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  }
}

/**
 * 内部直接将发票全量批量存入 IndexedDB
 */
async function saveInvoicesToDbDirect(invoices: InvoiceData[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // 清理旧数据并重新批量存入
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      if (invoices.length === 0) {
        resolve();
        return;
      }
      let completed = 0;
      let hasError = false;

      invoices.forEach((inv) => {
        const putReq = store.put(inv);
        putReq.onsuccess = () => {
          completed++;
          if (completed === invoices.length && !hasError) {
            resolve();
          }
        };
        putReq.onerror = () => {
          hasError = true;
          reject(putReq.error);
        };
      });
    };

    clearReq.onerror = () => reject(clearReq.error);
  });
}

// 异步批处理防抖计时器（300ms 防抖，高频勾选/排序时聚合为单次写入，0 阻塞）
let saveTimer: any = null;

/**
 * 异步防抖持久化发票全量数据到 IndexedDB（完全运行在后台线程，0 毫秒阻塞主线程 UI）
 */
export function saveInvoicesToDb(invoices: InvoiceData[]): Promise<void> {
  return new Promise((resolve) => {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(async () => {
      try {
        await saveInvoicesToDbDirect(invoices);
        resolve();
      } catch (err) {
        console.warn("Failed to persist invoices to IndexedDB:", err);
        resolve();
      }
    }, 300);
  });
}

/**
 * 单条删除发票数据
 */
export async function deleteInvoiceFromDb(id: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Delete invoice from IndexedDB failed:", err);
  }
}
