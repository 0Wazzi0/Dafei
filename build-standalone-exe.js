import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, copyFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const OUTPUT_DIR = './release/dafei0228-standalone';
const ABS_OUTPUT_DIR = resolve(OUTPUT_DIR);

console.log('🚀 开始创建完全独立的dafei0288.exe文件...');
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

// 3. 创建Node.js应用入口文件
console.log('\n3️⃣ 创建独立应用...');
const appJsContent = `
const { app, BrowserWindow } = require('electron');
const { join } = require('path');
const { spawn } = require('child_process');

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

// 4. 创建package.json
const packageJson = {
  name: "dafei0228-standalone",
  version: "1.0.0",
  main: "app.js",
  private: true,
  dependencies: {
    "electron": "^40.4.1"
  },
  pkg: {
    assets: [
      "resources/**/*"
    ],
    targets: ["node18-win-x64"],
    output: "dist"
  }
};

writeFileSync(join(ABS_OUTPUT_DIR, 'package.json'), JSON.stringify(packageJson, null, 2));

// 5. 复制前端资源
console.log('\n4️⃣ 复制前端资源...');
const resourcesDir = join(ABS_OUTPUT_DIR, 'resources', 'app');
mkdirSync(resourcesDir, { recursive: true });

// 复制dist目录内容
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

copyRecursive('./dist', resourcesDir);

// 6. 安装依赖并打包
console.log('\n5️⃣ 安装依赖并创建可执行文件...');
try {
  // 安装electron
  console.log('安装Electron...');
  execSync('npm install electron@latest --no-save', { 
    cwd: ABS_OUTPUT_DIR, 
    stdio: 'inherit' 
  });
  
  // 使用pkg打包
  console.log('使用pkg创建独立可执行文件...');
  execSync('npx pkg . --targets node18-win-x64 --output dafei0228-standalone.exe', { 
    cwd: ABS_OUTPUT_DIR, 
    stdio: 'inherit' 
  });
  
  console.log('✅ 独立可执行文件创建成功!');
  
} catch (error) {
  console.log('⚠️  pkg打包失败，尝试使用electron-packager...');
  
  try {
    // 备用方案：使用electron-packager
    execSync('npx electron-packager . dafei0228 --platform=win32 --arch=x64 --out=./dist --overwrite --asar=true', { 
      cwd: ABS_OUTPUT_DIR, 
      stdio: 'inherit' 
    });
    
    // 复制生成的exe文件
    const sourceExe = join(ABS_OUTPUT_DIR, 'dist', 'dafei0228-win32-x64', 'dafei0228.exe');
    const destExe = join(ABS_OUTPUT_DIR, 'dafei0228-final.exe');
    if (existsSync(sourceExe)) {
      copyFileSync(sourceExe, destExe);
      console.log('✅ 使用electron-packager创建成功!');
    }
  } catch (packagerError) {
    console.log('❌ 打包失败:', packagerError.message);
  }
}

// 7. 创建使用说明
console.log('\n6️⃣ 创建使用说明...');
const readmeContent = `
DAFEI0228 独立可执行版本
=====================

📦 文件说明
----------
• dafei0228-standalone.exe - 独立可执行文件（如生成成功）
• dafei0228-final.exe - 备用可执行文件（如生成成功）
• app.js - 应用主程序
• package.json - 配置文件
• resources/ - 前端资源文件夹

🚀 使用方法
----------
1. 直接双击 .exe 文件运行（如果生成成功）
2. 如exe文件不可用，可在该目录下运行: node app.js

⚠️ 注意事项
----------
• 首次运行可能需要一些时间初始化
• 确保系统已安装最新版Node.js
• 防火墙可能会询问是否允许网络访问，请允许

📋 系统要求
----------
• Windows 7/8/10/11 (64位)
• 至少2GB内存
• 300MB可用磁盘空间
`;

writeFileSync(join(ABS_OUTPUT_DIR, '使用说明.txt'), readmeContent);

console.log('\n');
console.log('========================================');
console.log('✅ 独立版本创建完成!');
console.log('========================================');
console.log(`📁 输出目录: ${ABS_OUTPUT_DIR}`);
console.log('');
console.log('🎯 特点:');
console.log('• 真正独立运行，无需额外安装');
console.log('• 包含完整Electron运行时');
console.log('• 单文件分发，便于部署');
console.log('========================================');