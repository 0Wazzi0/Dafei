// 预加载脚本 - 在渲染进程和主进程之间建立安全通信。
//
// 原先这里暴露了 getAppVersion（ipcRenderer.invoke('get-app-version')），
// 但主进程从未注册对应的 ipcMain.handle，调用必然挂起；
// src/ 下也没有任何调用方。已移除该失效接口。
// 保留 contextBridge 入口，后续需要主进程能力（如静默打印）时在此追加。
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {});
