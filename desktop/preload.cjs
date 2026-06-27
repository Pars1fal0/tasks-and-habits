const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rhythmDesktop", {
  syncReminders(payload) {
    ipcRenderer.send("reminders:sync", payload);
  },
  showTestNotification() {
    return ipcRenderer.invoke("reminders:test");
  },
  writeFileBackup(payload) {
    return ipcRenderer.invoke("backups:write-file", payload);
  },
});
