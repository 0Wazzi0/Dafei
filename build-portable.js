import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const OUTPUT_DIR = './release/Dafei-Portable';
const ABS_OUTPUT_DIR = resolve(OUTPUT_DIR);

console.log('🚀 开始创建免安装版本的 Dafei 应用...');
console.log('');

// 1. 构建前端应用
console.log('1️⃣ 构建前端应用...');
execSync('npm run build', { stdio: 'inherit' });

// 2. 创建输出目录
console.log('\n2️⃣ 准备输出目录...');
if (!existsSync('./release')) {
  mkdirSync('./release');
}
if (existsSync(OUTPUT_DIR)) {
  // 清理旧目录
  execSync(`rd /s /q "${OUTPUT_DIR}"`, { stdio: 'ignore' });
}
mkdirSync(OUTPUT_DIR, { recursive: true });

// 3. 创建精简的 Electron 应用
console.log('\n3️⃣ 创建应用核心文件...');

// 主进程文件
const mainJsContent = `
const { app, BrowserWindow } = require('electron');
const { join } = require('path');

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
      title: 'Dafei 裁床单大师',
      icon: join(__dirname, 'app-icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 加载本地文件
    mainWindow.loadFile(join(__dirname, 'app/index.html'));
    
    // 生产环境不打开开发者工具
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
}
`;

writeFileSync(join(ABS_OUTPUT_DIR, 'main.js'), mainJsContent);

// 4. 复制前端资源到 app 目录
console.log('\n4️⃣ 复制应用资源...');
const appDir = join(ABS_OUTPUT_DIR, 'app');
mkdirSync(appDir);

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

copyRecursive('./dist', appDir);

// 5. 创建 package.json
console.log('\n5️⃣ 创建配置文件...');
const packageJson = {
  name: "Dafei",
  version: "1.0.0",
  main: "main.js",
  private: true,
  description: "裁床单大师 - 专业的服装裁床单管理系统",
  author: "Dafei Team",
  license: "MIT"
};

writeFileSync(join(ABS_OUTPUT_DIR, 'package.json'), JSON.stringify(packageJson, null, 2));

// 6. 创建启动脚本
console.log('\n6️⃣ 创建启动脚本...');

// Windows 批处理脚本
const batchScript = `
@echo off
TITLE Dafei 裁床单大师
SETLOCAL ENABLEDELAYEDEXPANSION

CD /D "%~dp0"

ECHO.
ECHO ╔══════════════════════════════════════╗
ECHO ║        Dafei 裁床单大师 v1.0         ║
ECHO ║     专业的服装裁床单管理系统         ║
ECHO ╚══════════════════════════════════════╝
ECHO.

REM 检查必要文件
IF NOT EXIST "main.js" (
    ECHO ❌ 错误: 找不到主程序文件
    PAUSE
    EXIT /B 1
)

IF NOT EXIST "app\\index.html" (
    ECHO ❌ 错误: 找不到应用资源文件
    PAUSE
    EXIT /B 1
)

ECHO ✅ 文件检查通过，正在启动应用...
ECHO.

REM 启动应用
electron . 2>nul
IF ERRORLEVEL 1 (
    ECHO.
    ECHO ⚠️  未找到 Electron 运行时
    ECHO 正在尝试自动安装...
    ECHO.
    
    REM 尝试安装 Electron
    npm install electron@latest --no-save >nul 2>&1
    IF ERRORLEVEL 1 (
        ECHO ❌ 自动安装失败
        ECHO 请手动安装:
        ECHO 1. 访问 https://nodejs.org/ 安装 Node.js
        ECHO 2. 运行: npm install -g electron
        ECHO 3. 重新启动此程序
        ECHO.
        PAUSE
        EXIT /B 1
    ) ELSE (
        ECHO ✅ Electron 安装成功，正在启动...
        electron .
    )
)

ECHO.
ECHO 应用已退出
PAUSE
`;

writeFileSync(join(ABS_OUTPUT_DIR, '启动Dafei.bat'), batchScript.trim());

// PowerShell 脚本
const psScript = `
# Dafei 启动脚本
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        Dafei 裁床单大师 v1.0         ║" -ForegroundColor Cyan
Write-Host "║     专业的服装裁床单管理系统         ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

# 检查必要文件
if (-not (Test-Path "main.js")) {
    Write-Host "❌ 错误: 找不到主程序文件" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

if (-not (Test-Path "app\\index.html")) {
    Write-Host "❌ 错误: 找不到应用资源文件" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

Write-Host "✅ 文件检查通过，正在启动应用..." -ForegroundColor Green
Write-Host ""

# 启动应用
try {
    electron .
} catch {
    Write-Host ""
    Write-Host "⚠️  未找到 Electron 运行时" -ForegroundColor Yellow
    Write-Host "正在尝试自动安装..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        npm install electron@latest --no-save | Out-Null
        Write-Host "✅ Electron 安装成功，正在启动..." -ForegroundColor Green
        electron .
    } catch {
        Write-Host "❌ 自动安装失败" -ForegroundColor Red
        Write-Host "请手动安装:" -ForegroundColor Yellow
        Write-Host "1. 访问 https://nodejs.org/ 安装 Node.js"
        Write-Host "2. 运行: npm install -g electron"
        Write-Host "3. 重新启动此程序"
        Write-Host ""
        Read-Host "按回车键退出"
        exit 1
    }
}

Write-Host ""
Write-Host "应用已退出" -ForegroundColor Gray
Read-Host "按回车键关闭窗口"
`;

writeFileSync(join(ABS_OUTPUT_DIR, '启动Dafei.ps1'), psScript.trim());

// 7. 创建使用说明
console.log('\n7️⃣ 创建使用说明...');

const readmeContent = `
Dafei 裁床单大师 v1.0
====================

📋 简介
-------
这是一个专业的服装裁床单管理系统，具有以下功能：
• 订单管理与跟踪
• 二维矩阵编辑
• 智能填充算法
• 数据统计分析
• 报表生成
• 标签打印
• Excel 导出

⚡ 使用方法
----------
Windows 用户:
1. 双击 "启动Dafei.bat" (推荐)
2. 或右键点击 "启动Dafei.ps1" 选择"使用 PowerShell 运行"

首次运行:
• 程序会自动检测并安装所需的 Electron 运行时
• 这可能需要几分钟时间，请耐心等待
• 安装完成后应用会自动启动

🔧 系统要求
----------
• Windows 7 或更高版本
• 至少 2GB 可用内存
• 网络连接(首次运行时下载 Electron)

📁 文件说明
----------
• main.js          - 应用主程序
• app/             - 前端资源文件夹
• package.json     - 应用配置文件
• 启动Dafei.bat    - Windows 启动脚本
• 启动Dafei.ps1    - PowerShell 启动脚本
• 使用说明.txt     - 本文档

🛡️ 注意事项
----------
• 请将整个文件夹一起移动，不要单独复制文件
• 应用数据保存在本地 IndexedDB 中
• 如需备份数据，请导出为 Excel 文件

📞 技术支持
----------
如有问题，请联系技术支持团队。

🎉 祝您使用愉快！
`;

writeFileSync(join(ABS_OUTPUT_DIR, '使用说明.txt'), readmeContent.trim());

// 8. 创建便携版本(如果可能)
console.log('\n8️⃣ 尝试创建真正的便携版...');

try {
  console.log('正在打包为独立可执行文件...');
  execSync(`npx electron-packager . Dafei --platform=win32 --arch=x64 --out=./release --overwrite --icon=./src-tauri/icons/128x128.png`, {
    cwd: ABS_OUTPUT_DIR,
    stdio: 'inherit'
  });
  console.log('✅ 独立可执行文件创建成功!');
} catch (error) {
  console.log('⚠️  独立可执行文件创建失败，使用脚本启动方式');
}

console.log('\n');
console.log('========================================');
console.log('✅ 免安装版本创建完成!');
console.log('========================================');
console.log(`📁 输出目录: ${ABS_OUTPUT_DIR}`);
console.log('');
console.log('🎯 分发说明:');
console.log('1. 将整个文件夹压缩后分发给用户');
console.log('2. 用户解压后双击"启动Dafei.bat"即可使用');
console.log('3. 首次运行会自动安装 Electron 运行时');
console.log('4. 之后可直接运行，无需额外安装');
console.log('');
console.log('💡 优势:');
console.log('• 真正免安装，解压即用');
console.log('• 自动处理依赖安装');
console.log('• 适合在普通电脑上运行');
console.log('• 体积小巧，便于分发');
console.log('========================================');