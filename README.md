<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Dafei 裁床单大师

## 项目简介

Dafei是一个专业的服装裁床单管理系统，支持二维矩阵编辑、智能填充、数据统计、报表生成等功能。

## 主要特性

- ✅ 订单管理与跟踪
- ✅ 二维矩阵编辑界面
- ✅ 智能填充算法
- ✅ 数据统计分析
- ✅ 报表生成与打印
- ✅ 标签打印功能
- ✅ Excel数据导出
- ✅ **单实例运行** - 防止重复启动多个实例

## 技术栈

- Vue 3 + TypeScript
- Vite 构建工具
- Electron 桌面应用框架
- IndexedDB 本地数据存储
- Tailwind CSS 样式框架（本地构建，非 CDN）
- SheetJS（xlsx，本地依赖）用于 Excel 导出
- 单元测试使用 Node 内置 `node:test`，直接运行 TypeScript

## 🔥 新增功能：单实例运行保护

为了解决用户反馈的问题："如果没关闭上一个打开的.exe软件，同时打开另一个.exe软件，后续那个会读不到数据库"，我们实现了单实例运行机制：

### 功能特点：
- 🚫 **防重复启动**：当应用已经在运行时，再次双击快捷方式不会创建新进程
- 🔧 **智能激活**：新启动请求会自动激活已存在的应用窗口
- 🔂 **窗口状态恢复**：如果窗口最小化，会自动恢复并获得焦点
- 💾 **数据保护**：确保所有数据操作都在同一个实例中进行，避免数据冲突

### 实现原理：
使用Electron的`app.requestSingleInstanceLock()` API实现：
```
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit(); // 获取锁失败则退出
} else {
  app.on('second-instance', () => {
    // 激活已有窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
```

## 安装与使用

### 开发环境
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 启动Electron开发模式
npm run electron:dev

# 运行单元测试
npm test
```

### 生产构建
```bash
# 构建前端资源
npm run build

# 打包Electron应用
npm run pack

# 打包为独立可执行文件
npm run pack
```

## 目录结构

```
dafei/
├── src/
│   ├── App.tsx                 # 主应用组件、哈希路由
│   ├── index.tsx               # 应用入口
│   ├── styles.css              # 样式入口（Tailwind）
│   ├── types.ts                # TypeScript类型定义
│   ├── domain/                 # 业务规则唯一实现（纯函数）
│   │   ├── money.ts            # 金额与件数
│   │   ├── bundle.ts           # 扎号与扎明细
│   │   ├── matrix.ts           # 小计与同名合并汇总
│   │   ├── labels.ts           # 热敏标签数据
│   │   └── pool.ts             # 颜色/尺码/部位池
│   ├── components/
│   │   ├── FormList.tsx        # 订单列表与Excel导出
│   │   ├── FormEditor.tsx      # 编辑页、二维表格、标签打印
│   │   ├── CuttingReport.tsx   # 裁床单报表
│   │   ├── DataManager.tsx     # 数据备份
│   │   └── Icons.ts            # 图标
│   └── services/
│       ├── db.ts               # IndexedDB 数据服务
│       └── poolMatch.ts        # 拼音模糊匹配
├── tests/                      # 单元测试
├── electron/                   # Electron主进程
│   ├── main.ts
│   └── preload.js
├── index.html                  # 页面入口与打印样式
├── tailwind.config.js
├── postcss.config.js
├── run-dev.bat                 # 开发调试启动脚本
└── release/                    # 打包输出目录
```

## 数据存储与迁移

### 📍 数据存储位置

订单数据存储在 **IndexedDB** 中（浏览器本地数据库）：
- **数据库名称**: `FabricCutDB`
- **存储对象**: `forms`
- **物理位置**: `%APPDATA%\Dafei\IndexedDB\`

### 🔄 版本升级数据迁移指南

#### 方法一：使用数据管理功能（推荐）

1. **升级前备份**
   - 打开旧版本应用
   - 点击右上角 **"数据管理"** 按钮
   - 点击 **"导出数据"** 按钮
   - 保存生成的 JSON 备份文件（建议备份到云盘或 U 盘）

2. **安装新版本**
   - 下载并安装新版本应用
   - 首次启动会自动创建新的数据库

3. **恢复数据**
   - 打开新版本应用
   - 点击右上角 **"数据管理"** 按钮
   - 点击 **"导入数据"** 按钮
   - 选择之前备份的 JSON 文件
   - 等待导入完成，系统会显示导入的数据条数

#### 方法二：手动复制数据库文件（高级用户）

1. 找到旧版本的数据库文件位置：
   ```
   %APPDATA%\Dafei\IndexedDB\
   ```

2. 复制整个 `IndexedDB` 文件夹

3. 安装新版本后，将备份的文件夹粘贴到相同位置

⚠️ **注意**: 方法二需要确保应用已完全关闭，否则可能导致数据损坏。

### 💾 定期备份建议

- 每次添加重要订单后立即导出备份
- 每周定期备份一次
- 版本升级前必须备份
- 备份文件建议存储在多个位置（本地 + 云盘）

### 🛡️ 数据安全提示

- 导出文件包含所有订单数据，请妥善保管
- 不要随意分享导出的 JSON 文件
- 导入数据时会合并现有数据，不会覆盖
- 清空数据操作不可恢复，请谨慎使用

## 常见问题

### Q: 为什么第二次启动应用没有反应？
A: 这是正常的单实例保护机制。应用会自动激活已存在的窗口，而不是创建新实例。

### Q: 如何强制关闭应用？
A: 可以通过任务管理器结束进程，或者在应用窗口中点击关闭按钮。

### Q: 数据会丢失吗？
A: 不会。数据存储在IndexedDB中，即使应用重启也会保留。

应用已内置单实例保护，无需单独测试脚本。
## 许可证

MIT License

## 联系方式

如有问题或建议，请提交Issue或Pull Request。

