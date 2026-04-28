import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

// 构建路径
const BUILD_DIR = './dist';
const OUTPUT_DIR = './release/dafei0227-exe';
const ABS_OUTPUT_DIR = resolve(OUTPUT_DIR);

console.log('开始创建独立的 dafei0227 应用...');

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

// 3. 创建 Node.js 应用入口文件
console.log('2. 创建应用入口文件...');
const appEntryContent = `
const { app, BrowserWindow } = require('electron');
const { join } = require('path');

// 设置环境变量
process.env.NODE_ENV = 'production';

let mainWindow = null;

// 请求单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果获取锁失败，说明已经有实例在运行，直接退出
  app.quit();
} else {
  // 监听第二个实例启动事件
  app.on('second-instance', () => {
    // 当尝试启动第二个实例时，激活第一个实例的窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: '裁床单大师 - dafei0227',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 直接加载本地 HTML 文件
    mainWindow.loadFile(join(__dirname, 'dist/index.html'));
    
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

  // 优雅关闭
  process.on('SIGTERM', () => {
    app.quit();
  });

  process.on('SIGINT', () => {
    app.quit();
  });
}
`;

const appJsPath = join(ABS_OUTPUT_DIR, 'app.js');
writeFileSync(appJsPath, appEntryContent);

// 4. 创建 package.json for standalone
console.log('3. 创建独立应用配置...');
const standalonePackage = {
  name: "dafei0227",
  version: "1.0.0",
  main: "app.js",
  private: true,
  dependencies: {
    "electron": "^31.0.0"
  }
};

writeFileSync(join(ABS_OUTPUT_DIR, 'package.json'), JSON.stringify(standalonePackage, null, 2));

// 5. 复制资源文件
console.log('4. 复制应用资源...');
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

copyRecursive(BUILD_DIR, join(ABS_OUTPUT_DIR, 'dist'));

// 6. 创建启动脚本
console.log('5. 创建启动脚本...');
const launcherContent = `
@echo off
chcp 65001 >nul
title 裁床单大师 - dafei0227
cd /d "%~dp0"
echo ========================================
echo   裁床单大师 - dafei0227 独立版本
echo ========================================
echo.
echo 正在启动应用...
echo 请确保已安装 Node.js 和 Electron
echo 如果遇到问题，请访问: https://nodejs.org/
echo.

npm list electron >nul 2>&1
if %errorlevel% equ 0 (
  electron app.js
) else (
  echo Electron 未安装，正在尝试安装...
  npm install electron@latest
  if %errorlevel% equ 0 (
    electron app.js
  ) else (
    echo 安装失败，请手动安装:
    echo npm install -g electron
    echo 然后重新运行此脚本
    pause
  )
)
`;
writeFileSync(join(ABS_OUTPUT_DIR, '启动dafei0227.bat'), launcherContent.trim());

const powershellLauncher = `
# PowerShell 启动脚本 - dafei0227
Set-Location $PSScriptRoot
$OutputEncoding = New-Object -typename System.Text.UTF8Encoding
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "裁床单大师 - dafei0227"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  裁床单大师 - dafei0227 独立版本" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "正在启动应用..." -ForegroundColor Yellow

# 检查 Electron 是否已安装
try {
  $electronCheck = npm list electron 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "正在启动 dafei0227 应用..." -ForegroundColor Yellow
    electron app.js
  } else {
    Write-Host "Electron 未安装，正在安装..." -ForegroundColor Yellow
    npm install electron@latest
    if ($LASTEXITCODE -eq 0) {
      electron app.js
    } else {
      Write-Host "安装失败，请手动安装:" -ForegroundColor Red
      Write-Host "npm install -g electron" -ForegroundColor Yellow
      Write-Host "然后重新运行此脚本" -ForegroundColor Yellow
      Read-Host "按回车键退出"
    }
  }
} catch {
  Write-Host "发生错误: $_" -ForegroundColor Red
  Read-Host "按回车键退出"
}
`;
writeFileSync(join(ABS_OUTPUT_DIR, '启动dafei0227.ps1'), powershellLauncher.trim());

// 7. 创建使用说明
console.log('6. 创建使用说明...');
const readmeContent = `
裁床单大师 - dafei0227 独立版本
================================

🚀 这是一个基于 Vue 3 + Electron 的桌面应用程序

📁 文件结构:
├── app.js              # 应用主程序
├── dist/               # 前端资源文件
│   ├── index.html      # 主页面
│   └── assets/         # 静态资源
├── package.json        # 应用配置
├── 启动dafei0227.bat   # Windows 批处理启动脚本
├── 启动dafei0227.ps1   # PowerShell 启动脚本
└── 使用说明.txt        # 本文件

⚡ 运行方法:
1. 双击 "启动dafei0227.bat" (推荐)
2. 或右键点击 "启动dafei0227.ps1" 选择"使用 PowerShell 运行"
3. 或在命令行中执行: electron app.js

📋 系统要求:
- Windows 7 或更高版本
- Node.js 16 或更高版本
- Internet 连接(首次运行时自动安装 Electron)

🔧 首次运行:
应用会在第一次启动时自动下载并安装 Electron 框架，
这可能需要几分钟时间，请耐心等待。

🛡️ 安全提示:
- 请从可信来源获取此应用
- 运行前请确保杀毒软件未误报
- 如有疑问请联系开发者

📞 技术支持:
如有问题，请联系技术支持团队。

🎉 祝您使用愉快！
`;
writeFileSync(join(ABS_OUTPUT_DIR, '使用说明.txt'), readmeContent.trim());

console.log('独立应用打包完成！');
console.log('📁 发布目录: ' + ABS_OUTPUT_DIR);
console.log('');
console.log('✅ 打包成功！');
console.log('📦 分发说明:');
console.log('1. 将整个文件夹压缩后分发给用户');
console.log('2. 用户解压后双击"启动dafei0227.bat"即可运行');
console.log('3. 首次运行会自动安装必要的依赖');
console.log('');
console.log('💡 提示: 这种方式体积小，但需要用户电脑安装 Node.js');