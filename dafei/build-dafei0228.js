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

// 主进程文件 - 使用dafei0228名称
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
      title: 'Dafei 裁床单大师 - dafei0228',
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
  name: "dafei0228",
  version: "1.0.0",
  main: "main.js",
  private: true,
  description: "裁床单大师 - 专业的服装裁床单管理系统 - dafei0228版本",
  author: "Dafei Team",
  license: "MIT"
};

writeFileSync(join(ABS_OUTPUT_DIR, 'package.json'), JSON.stringify(packageJson, null, 2));

// 6. 创建启动脚本
console.log('\n6️⃣ 创建启动脚本...');

// Windows 批处理脚本
const batchScript = `
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
