import { execSync } from 'child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const OUTPUT_DIR = './release/dafei0317';

console.log('🚀 开始打包 dafei0317 便携版（支持 Win7）...\n');

// 1. 构建前端应用
console.log('1️⃣ 构建前端应用...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ 前端构建完成\n');
} catch (error) {
  console.error('❌ 前端构建失败:', error.message);
  process.exit(1);
}

// 2. 清理旧的输出目录
console.log('2️⃣ 清理旧版本...');
if (existsSync(OUTPUT_DIR)) {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
mkdirSync(OUTPUT_DIR, { recursive: true });
console.log('✅ 输出目录已准备\n');

// 3. 使用 electron-builder 打包
console.log('3️⃣ 执行 Electron 打包（首次运行可能需要 5-10 分钟下载依赖）...');
try {
  execSync('npx electron-builder -w portable --x64', { 
    stdio: 'inherit'
  });
  console.log('\n✅ 打包完成！\n');
} catch (error) {
  console.error('❌ 打包失败:', error.message);
  process.exit(1);
}

// 4. 重命名生成的文件
console.log('4️⃣ 重命名输出文件...');
try {
  const files = existsSync(OUTPUT_DIR) ? require('fs').readdirSync(OUTPUT_DIR) : [];
  const portableExe = files.find(f => f.endsWith('Portable.exe') || f.endsWith('.exe'));
  
  if (portableExe && !portableExe.includes('dafei0317')) {
    const oldPath = join(OUTPUT_DIR, portableExe);
    const newPath = join(OUTPUT_DIR, 'dafei0317.exe');
    renameSync(oldPath, newPath);
    console.log(`✅ 已重命名为：dafei0317.exe\n`);
  } else if (portableExe) {
    console.log(`✅ 输出文件：${portableExe}\n`);
  }
} catch (error) {
  console.warn('⚠️  重命名文件时出错:', error.message);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎉 打包成功完成！');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📦 输出位置：${resolve(OUTPUT_DIR)}`);
console.log('📁 主要文件：dafei0317.exe');
console.log('\n💡 使用说明：');
console.log('   - 用户下载后双击 dafei0317.exe 即可运行');
console.log('   - 无需安装任何依赖或 Node.js 环境');
console.log('   - 可将整个文件夹分发给用户');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
