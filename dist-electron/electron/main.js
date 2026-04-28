"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
// 直接使用__dirname，因为在CommonJS中可用
const __dirname = path_1.default.resolve();
let mainWindow = null;
// 请求单实例锁
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    // 如果获取锁失败，说明已经有实例在运行，直接退出
    electron_1.app.quit();
}
else {
    // 监听第二个实例启动事件
    electron_1.app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 当尝试启动第二个实例时，激活第一个实例的窗口
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });
    function createWindow() {
        mainWindow = new electron_1.BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            title: 'Dafei',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path_1.default.join(__dirname, '..', 'electron', 'preload.js')
            }
        });
        // 开发模式下加载 Vite 开发服务器
        if (process.env.NODE_ENV === 'development') {
            mainWindow.loadURL('http://localhost:5173');
            mainWindow.webContents.openDevTools();
        }
        else {
            // 生产模式下加载打包后的文件
            mainWindow.loadFile(path_1.default.join(__dirname, '..', 'dist', 'index.html'));
        }
        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    }
    electron_1.app.whenReady().then(() => {
        createWindow();
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
    electron_1.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
}
