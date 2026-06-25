const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rhythmDesktop", {
  syncReminders(payload) {
    ipcRenderer.send("reminders:sync", payload);
  },
  showTestNotification() {
    return ipcRenderer.invoke("reminders:test");
  },
});
