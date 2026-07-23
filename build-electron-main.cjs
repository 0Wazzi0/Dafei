const fs = require('fs');
const path = require('path');

// 读取编译后的Electron主进程文件
const sourcePath = './dist-electron/main.js';
const outputPath = './dist-electron/main.cjs';

if (fs.existsSync(sourcePath)) {
  let content = fs.readFileSync(sourcePath, 'utf8');
  
  // 替换ES模块语法为CommonJS语法
  content = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]electron['"]/g, 'const { $1 } = require(\'electron\')');
  content = content.replace(/import\s+(\w+)\s+from\s+['"](\w+)['"]/g, 'const $1 = require(\'$2\')');
  content = content.replace(/import\s*\{\s*\}\s*from\s*['"]url['"]/g, 'const { fileURLToPath } = require(\'url\')');
  
  // 将顶层await包装在async函数中（如果有的话）
  // 注意：对于Electron 14，我们只需要确保使用CommonJS语法
  
  // 写入新文件
  fs.writeFileSync(outputPath, content);
  
  console.log('Successfully converted main.js to CommonJS format');
} else {
  console.error('Source file does not exist:', sourcePath);
}
