"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
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
                preload: (0, path_1.join)(__dirname, 'preload.js')
            }
        });
        // 开发模式下加载 Vite 开发服务器
        if (process.env.NODE_ENV === 'development') {
            mainWindow.loadURL('http://localhost:5173');
            mainWindow.webContents.openDevTools();
        }
        else {
            // 生产模式下加载打包后的文件
            // 在 ASAR 打包的应用中，需要使用特殊的方法访问资源
            // 尝试使用 app.getAppPath() 并确保路径正确
            const appPath = electron_1.app.getAppPath();
            console.log(`App path: ${appPath}`);
            // 构造 index.html 的路径
            const indexPath = (0, path_1.join)(appPath, 'dist', 'index.html');
            console.log(`Looking for index.html at: ${indexPath}`);
            // 在 ASAR 环境中，existsSync 可能无法正确检测文件
            // 因此即使 existsSync 返回 false，我们也尝试加载
            try {
                mainWindow.loadFile(indexPath);
                console.log('Successfully loaded index.html');
            }
            catch (err) {
                console.error('Failed to load index.html:', err);
                // 如果直接加载失败，尝试使用 file:// 协议
                const fileUrl = `file://${indexPath}`;
                console.log(`Trying to load via file URL: ${fileUrl}`);
                try {
                    mainWindow.loadURL(fileUrl);
                    console.log('Successfully loaded index.html via file URL');
                }
                catch (urlErr) {
                    console.error('Failed to load via file URL:', urlErr);
                    // 最后的备选方案：显示错误页面
                    mainWindow.loadURL(`
            data:text/html;charset=utf-8,
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Dafei - Application Error</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 40px; }
                  h1 { color: #d32f2f; }
                  .path { background-color: #f5f5f5; padding: 10px; margin: 10px 0; word-break: break-all; }
                </style>
              </head>
              <body>
                <h1>Application Failed to Load</h1>
                <p>We couldn't load the main application page. This usually happens due to:</p>
                <ul>
                  <li>Missing application files</li>
                  <li>Incorrect file paths</li>
                  <li>Corrupted installation</li>
                </ul>
                
                <h2>Debug Information:</h2>
                <p>Looking for index.html at:</p>
                <div class="path">${indexPath.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                
                <h2>Possible Solutions:</h2>
                <ol>
                  <li>Reinstall the application</li>
                  <li>Contact support for assistance</li>
                </ol>
              </body>
            </html>
          `);
                }
            }
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
