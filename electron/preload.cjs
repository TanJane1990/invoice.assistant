const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveExcelDirect: (payload) => ipcRenderer.invoke("save-excel-direct", payload),
  checkFileExists: (payload) => ipcRenderer.invoke("check-file-exists", payload),
  openFileFolder: (payload) => ipcRenderer.invoke("open-file-folder", payload),
  parseInvoiceNative: (payload) => ipcRenderer.invoke("parse-invoice-native", payload),
});
