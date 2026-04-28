"use strict";
// 预加载脚本 - 在渲染进程和主进程之间建立安全通信
const { contextBridge, ipcRenderer } = require('electron');
// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 可以在这里添加需要的 IPC 方法
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});
