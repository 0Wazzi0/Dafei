import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';

const OUTPUT_DIR = './release/dafei0228-simple';
const ABS_OUTPUT_DIR = resolve(OUTPUT_DIR);

console.log('🚀 开始创建简单的dafei0228独立版本...');
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
  execSync(`rd /s /q "${OUTPUT_DIR}"`, { stdio: 'ignore' });
}
mkdirSync(OUTPUT_DIR, { recursive: true });

// 3. 创建简单的启动脚本
console.log('\n3️⃣ 创建启动脚本...');
const startBatContent = `
@echo off
TITLE Dafei0228 裁床单大师
SETLOCAL ENABLEDELAYEDEXPANSION

CD /D "%~dp0"

ECHO.
ECHO ╔══════════════════════════════════════╗
ECHO ║      Dafei0228 裁床单大师 v1.0       ║
ECHO ║     专业的服装裁床单管理系统         ║
ECHO ╚══════════════════════════════════════╝
ECHO.

REM 检查必要文件
IF NOT EXIST "resources\\app\\index.html" (
    ECHO ❌ 错误: 找不到应用资源文件
    PAUSE
    EXIT /B 1
)

ECHO ✅ 文件检查通过，正在启动应用...
ECHO.

REM 尝试直接启动Electron应用
npx electron app.js 2>nul
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
        npx electron app.js
    )
)

ECHO.
ECHO 应用已退出
PAUSE
`;

writeFileSync(join(ABS_OUTPUT_DIR, '启动dafei0228.bat'), startBatContent.trim());

// 4. 创建Node.js应用文件
const appJsContent = `
const { app, BrowserWindow } = require('electron');
const { join } = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Dafei0228 裁床单大师',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 加载打包后的前端应用
  mainWindow.loadFile(join(__dirname, 'resources/app/index.html'));
  
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

writeFileSync(join(ABS_OUTPUT_DIR, 'app.js'), appJsContent);

// 5. 创建package.json
const packageJson = {
  name: "dafei0228-simple",
  version: "1.0.0",
  main: "app.js",
  private: true,
  description: "Dafei0228 裁床单大师 - 简化版"
};

writeFileSync(join(ABS_OUTPUT_DIR, 'package.json'), JSON.stringify(packageJson, null, 2));

// 6. 复制前端资源
console.log('\n4️⃣ 复制前端资源...');
const resourcesDir = join(ABS_OUTPUT_DIR, 'resources', 'app');
mkdirSync(resourcesDir, { recursive: true });

// 简单的文件复制函数
function copyDir(src, dest) {
  if (!existsSync(src)) return;
  
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  const files = execSync(`dir "${src}" /b`, { encoding: 'utf8' }).split('\r\n').filter(f => f.trim());
  
  files.forEach(file => {
    if (file.trim()) {
      const srcPath = join(src, file.trim());
      const destPath = join(dest, file.trim());
      
      try {
        // 检查是否为目录
        const isDir = execSync(`if exist "${srcPath}\\*" (echo DIR) else (echo FILE)`, { 
          encoding: 'utf8', 
          cwd: src 
        }).includes('DIR');
        
        if (isDir) {
          copyDir(srcPath, destPath);
        } else {
          copyFileSync(srcPath, destPath);
        }
      } catch (err) {
        console.log('复制文件失败: ' + file.trim());
      }
    }
  });
}

// 复制dist目录
copyDir('./dist', resourcesDir);

// 7. 创建使用说明
console.log('\n5️⃣ 创建使用说明...');
const readmeContent = `
DAFEI0228 简化独立版本
===================

📦 文件说明
----------
• 启动dafei0228.bat - 主启动脚本
• app.js - Electron应用主程序
• package.json - 应用配置
• resources/app/ - 前端资源文件夹

🚀 使用方法
----------
1. 双击 "启动dafei0228.bat" 运行
2. 首次运行会自动安装Electron依赖
3. 之后可直接运行

⚠️ 注意事项
----------
• 需要网络连接进行首次依赖安装
• 需要安装Node.js环境
• 防火墙可能需要允许网络访问

📋 系统要求
----------
• Windows 7/8/10/11
• 已安装Node.js
• 网络连接(首次运行)
`;

writeFileSync(join(ABS_OUTPUT_DIR, '使用说明.txt'), readmeContent);

console.log('\n');
console.log('========================================');
console.log('✅ 简化版本创建完成!');
console.log('========================================');
console.log('📁 输出目录: ' + ABS_OUTPUT_DIR);
console.log('');
console.log('🎯 使用方法:');
console.log('1. 双击 "启动dafei0228.bat"');
console.log('2. 首次运行会自动安装依赖');
console.log('3. 应用启动后即可使用');
console.log('========================================');