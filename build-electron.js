import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// 构建路径
const BUILD_DIR = './dist';
const ELECTRON_DIR = './electron';
const OUTPUT_DIR = './release/Dafei-win32-x64';

console.log('开始打包 Dafei 应用...');

// 1. 构建前端应用
console.log('1. 构建前端应用...');
execSync('npm run build', { stdio: 'inherit' });

// 2. 创建输出目录
if (!existsSync('./release')) {
  mkdirSync('./release');
}
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 3. 创建编译后的 Electron JS 文件
console.log('2. 创建 Electron 运行文件...');
const electronJsContent = `
const { app, BrowserWindow } = require('electron');
const { join } = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Dafei',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    }
  });

  // 加载打包后的文件
  mainWindow.loadFile(join(__dirname, 'dist/index.html'));
  
  // 开发时可以打开开发者工具
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
`;

writeFileSync(join(OUTPUT_DIR, 'main.js'), electronJsContent);

// 4. 复制预加载脚本
console.log('3. 复制预加载脚本...');
copyFileSync('./electron/preload.js', join(OUTPUT_DIR, 'preload.js'));

// 5. 创建启动脚本
console.log('4. 创建启动脚本...');
const launcherContent = `
@echo off
cd /d "%~dp0"
if exist "Dafei.exe" (
  echo 正在启动 Dafei...
  start "" "Dafei.exe"
) else (
  echo 请先安装 Electron: npm install -g electron
  echo 然后运行: electron main.js
  pause
)
`;
writeFileSync(join(OUTPUT_DIR, '启动Dafei.bat'), launcherContent.trim());

const powershellLauncher = `
# PowerShell 启动脚本
Set-Location $PSScriptRoot
if (Test-Path "Dafei.exe") {
    Write-Host "正在启动 Dafei..."
    Start-Process "Dafei.exe"
} else {
    Write-Host "请先安装 Electron: npm install -g electron"
    Write-Host "然后运行: electron main.js"
    Read-Host "按回车键退出"
}
`;
writeFileSync(join(OUTPUT_DIR, '启动Dafei.ps1'), powershellLauncher.trim());

// 6. 复制资源文件
console.log('5. 复制应用资源...');
copyFileSync('./package.json', join(OUTPUT_DIR, 'package.json'));

// 复制整个 dist 目录
function copyRecursive(src, dest) {
  const stats = statSync(src);
  if (stats.isDirectory()) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    const files = readdirSync(src);
    files.forEach(file => {
      copyRecursive(join(src, file), join(dest, file));
    });
  } else {
    copyFileSync(src, dest);
  }
}

copyRecursive(BUILD_DIR, join(OUTPUT_DIR, 'dist'));

console.log('打包完成！');
console.log(`发布目录: ${OUTPUT_DIR}`);
console.log('');
console.log('使用说明:');
console.log('方法一 (推荐):');
console.log('1. 双击 "启动Dafei.bat" 或 "启动Dafei.ps1"');
console.log('');
console.log('方法二 (需要安装 Electron):');
console.log('1. 在目标电脑上安装 Node.js');
console.log('2. 运行: npm install -g electron');
console.log('3. 在发布目录中运行: electron main.js');
console.log('');
console.log('方法三 (制作独立exe):');
console.log('1. 下载 Electron 官方发布的便携版');
console.log('2. 将 electron.exe 复制到发布目录并重命名为 Dafei.exe');
console.log('3. 双击 Dafei.exe 即可运行');