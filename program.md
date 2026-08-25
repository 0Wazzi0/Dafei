# Dafei 项目说明

本文档根据当前工作区代码整理，主要用于后续开发、排查问题和新会话快速了解项目。本文档本身不是项目配置文件，修改这里不会改变程序行为。

## 1. 项目概况

Dafei 是一个本地运行的服装裁床单管理桌面应用，主要用于：

- 创建、编辑和删除订单；
- 使用颜色 × 尺码二维表格录入数量；
- 统计颜色、尺码、扎号和订单总数；
- 生成裁床单报表；
- 生成 40mm × 80mm 热敏标签并打印；
- 导出订单 Excel；
- 导出、导入订单 JSON 备份；
- 保存颜色池、尺码池和部位池；
- 防止同一台电脑重复启动多个应用实例。

## 2. 技术栈

- 前端框架：Vue 3
- 开发语言：TypeScript
- 组件写法：`.tsx` 文件中的 Vue `defineComponent` 和模板字符串
- 前端构建：Vite
- 桌面容器：Electron
- 本地数据：IndexedDB
- 池数据和部分设置：localStorage
- 样式：Tailwind CSS CDN + `index.html` 中的全局 CSS
- Excel 导出：SheetJS CDN
- Windows 打包：electron-builder
- Windows 架构：当前配置为 `ia32`，目标是兼容旧版 Windows，包括 Windows 7

## 3. 依赖及版本

以下版本来自当前 `package.json`：

### dependencies

```json
{
  "vue": "3"
}
```

### devDependencies

```json
{
  "@types/node": "^22.14.0",
  "@vitejs/plugin-vue": "^5.2.4",
  "concurrently": "^8.2.2",
  "cross-env": "^7.0.3",
  "electron": "^14.2.9",
  "electron-builder": "^26.7.0",
  "typescript": "~5.8.2",
  "vite": "^6.2.0",
  "wait-on": "^7.2.0"
}
```

### 外部 CDN

- Tailwind CSS：`index.html` 中通过 `cdn.tailwindcss.com` 引入；
- SheetJS：`index.html` 中通过 SheetJS CDN 引入，当前脚本版本为 `xlsx-0.20.1`。

## 4. 常用命令

```bash
# 启动 Vite 开发服务器
npm run dev

# 构建前端
npm run build

# 编译 Electron 主进程
npm run compile:electron

# 启动 Electron 开发模式
npm run electron:dev

# 构建前端、编译 Electron 并打包 Windows portable ia32 exe
npm run pack
```

当前 `npm run pack` 的实际流程是：

1. 执行 `vite build`；
2. 执行 `tsc -p tsconfig.electron.json`；
3. 执行 `build-electron-main.cjs`，将 Electron 主进程转换为 CommonJS 文件；
4. 使用 electron-builder 打包 portable、ia32 版本。

## 5. 当前目录结构

```text
dafei/
├── src/
│   ├── App.tsx                    # 页面状态、哈希路由和页面切换
│   ├── index.tsx                  # Vue 应用入口
│   ├── types.ts                   # CuttingForm、MatrixHeader 等类型
│   ├── components/
│   │   ├── FormList.tsx           # 首页订单列表
│   │   ├── FormEditor.tsx         # 新建/编辑订单、二维表格和标签打印
│   │   ├── CuttingReport.tsx      # 裁床单报表和报表打印
│   │   ├── DataManager.tsx        # JSON 数据导入、导出和清空
│   │   └── Icons.ts               # 图标组件
│   └── services/
│       └── db.ts                  # IndexedDB 数据访问和 JSON 订单备份
├── electron/
│   ├── main.ts                    # Electron 主进程、窗口和用户数据目录
│   └── preload.js                 # preload 文件
├── build-electron-main.cjs        # 主进程编译结果转换脚本
├── index.html                     # 页面入口、CDN 和打印 CSS
├── package.json                   # npm 脚本、依赖和 electron-builder 配置
├── package-lock.json              # npm 依赖锁定文件
├── vite.config.ts                 # Vite 配置
├── tsconfig.json                  # 前端 TypeScript 配置
├── tsconfig.electron.json         # Electron 主进程 TypeScript 配置
├── program.md                    # 当前项目说明文档
└── release/                       # 打包输出目录，生成后存在
```

旧的根目录 `components/`、`services/`、`App.tsx`、`index.tsx` 等不属于当前源码入口。当前代码引用的是 `src/` 下的文件。

## 6. 主要功能和实现位置

### 6.1 应用入口和页面切换

文件：`src/App.tsx`

负责：

- 管理 `list`、`create`、`edit`、`report` 四种页面状态；
- 创建订单、编辑订单和打开裁床单报表；
- 使用 URL hash 保存页面位置，例如：
  - `#/list`
  - `#/create`
  - `#/edit/{订单ID}`
  - `#/report/{订单ID}`
- 通过 `getFormById()` 根据订单 ID 恢复详情页；
- 挂载 `FormList`、`FormEditor`、`CuttingReport` 和 `DataManager`。

### 6.2 首页订单列表

文件：`src/components/FormList.tsx`

负责：

- 从 IndexedDB 读取订单；
- 按客户、款号、备注搜索；
- 按开始日期和结束日期筛选；
- 分页显示订单；
- 点击订单进入编辑页面；
- 删除订单；
- 导出 Excel；
- 在列表中显示备注。

Excel 导出包括：

- 编号；
- 下单日期；
- 款号；
- 客户；
- 订单总数；
- 单价金额；
- 附加费用；
- 总金额；
- 备注。

Excel 文件名由搜索栏内容和日期筛选条件组合生成，并会补充 `.xlsx` 后缀。

### 6.3 订单编辑和二维表格

文件：`src/components/FormEditor.tsx`

负责：

- 编辑款号、客户、床号、单价、附加费用和备注；
- 编辑颜色行、尺码列和数量；
- 颜色池、尺码池、部位池的添加和移除；
- 颜色、尺码的智能填充；
- 颜色总数、尺码总数和订单总数计算；
- 保存订单和新订单草稿自动保存；
- 跳转裁床单报表；
- 打开热敏标签打印预览。

二维表格数量使用以下键保存：

```text
${row.id}_${col.id}
```

因此调整颜色行或尺码列的显示顺序时，只改变 `rows` 或 `cols` 数组顺序，不改变数量键，原有数量仍然对应原来的颜色和尺码。

当前已支持：

- 颜色行拖动排序；
- 尺码列拖动排序；
- 首列颜色列固定显示；
- 横向内容过多时，后续列可通过横向滚动查看。

金额逻辑当前为：

```text
总金额 = 单价 × 订单数量
```

`additionalFee` 作为单独的附加费用字段保存，默认值为 `0`。当前列表和报表中的金额计算主要使用单价 × 数量；附加费用在订单数据和 Excel 中单独保留。

### 6.4 热敏标签打印

热敏标签打印的核心实现有两个文件。

#### 业务和标签数据生成

文件：`src/components/FormEditor.tsx`

关键位置和逻辑：

- `labels` 计算属性：根据颜色、尺码和数量生成每张标签的数据；
- `bundleMap`：为有数量的颜色 × 尺码单元格分配扎号；
- `filteredLabels`：根据是否开启按扎选择，筛选需要打印的标签；
- `openPrintDialog()`：打开打印模式选择窗口；
- `confirmPrint()`：进入打印预览；
- `executePrint()`：调用 `window.print()` 执行浏览器/Electron 页面打印；
- `printOrder()`：从订单编辑页进入打印流程。

标签中当前包含：

- 工作室名称；
- 款号；
- 床号；
- 颜色；
- 尺码；
- 扎号；
- 件数；
- 部位名称（选择部位打印时）；
- 当前页码和总页数。

打印模式包括：

- 打印全部扎号；
- 按扎号选择打印；
- 按部位打印。

#### 打印页面样式和纸张尺寸

文件：`index.html`

打印 CSS 位于 `@media print` 中，主要负责：

- 设置纸张尺寸为 `40mm 80mm`；
- 设置页面边距为 `0`；
- 隐藏网页头部、按钮和其他 `.no-print` 元素；
- 只显示 `.thermal-print-root`；
- 每张 `.print-label` 使用 `page-break-after: always`；
- 控制标签字体、行距、内边距和页码；
- 去除浏览器默认页眉页脚带来的网页头。

打印参数由 `FormEditor.tsx` 通过 CSS 变量传给页面，包括：

```text
--paper-width
--paper-height
--print-font-size
--print-line-spacing
--print-padding
--print-gap
```

默认纸张参数在 `FormEditor.tsx` 的 data 中设置：

```text
paperWidth: 40
paperHeight: 80
printFontSize: 22
```

注意：`resetPrintStyle()` 当前会把字号重置为 `14`，所以点击“默认纸张”后字号可能与初始预览字号不同。

Electron 主进程 `electron/main.ts` 当前没有调用 `webContents.print()`、打印机枚举或打印队列 API。热敏标签打印实际依赖渲染页面的 `window.print()`、Chromium 打印流程、Windows 打印驱动和打印机队列。

### 6.5 裁床单报表

文件：`src/components/CuttingReport.tsx`

负责：

- 显示订单基本信息；
- 显示备注；
- 显示表格一：扎号及数量分布；
- 显示表格二：同颜色同尺码汇总；
- 显示表格三：扎明细清单；
- 通过 `window.print()` 打印裁床单报表。

报表数据仍通过 `row.id` 和 `col.id` 读取原始数量，因此颜色、尺码排序不会使数量错位。

### 6.6 数据管理

文件：`src/components/DataManager.tsx`

负责：

- 导出所有订单为 JSON；
- 从 JSON 导入订单并合并到现有订单；
- 清空所有订单；
- 显示订单数量、最后导出时间和最后导入时间。

当前 JSON 导入/导出只处理 IndexedDB 中的订单，不包含：

- 颜色池；
- 尺码池；
- 部位池；
- 历史记录隐藏项；
- 其他 localStorage 数据。

## 7. 数据结构和存储位置

### 7.1 订单数据

文件：`src/services/db.ts`

IndexedDB 配置：

```text
数据库名：FabricCutDB
对象仓库：forms
版本：1
主键：id
```

订单类型定义在 `src/types.ts` 的 `CuttingForm`：

- `id`
- `styleNumber`
- `customer`
- `bedNumber`
- `createdAt`
- `updatedAt`
- `rows`
- `cols`
- `data`
- `amountPerPiece`
- `additionalFee`
- `remark`
- `totalAmount`

其中 `totalAmount` 是兼容历史数据保留的可选字段，当前保存订单时会清除该字段，使用单价 × 数量计算金额。

### 7.2 颜色池、尺码池和部位池

文件：`src/components/FormEditor.tsx`

使用 localStorage 保存：

```text
pool_colors       # 颜色池
pool_sizes        # 尺码池
pool_sections     # 部位池
pool_sections_v2  # 部位池版本标记
```

客户和款号历史隐藏项由 `src/services/db.ts` 写入：

```text
hidden_customers
hidden_styleNumbers
```

### 7.3 Electron 用户数据目录

文件：`electron/main.ts`

程序启动时固定设置：

```ts
app.setPath('userData', join(app.getPath('appData'), 'Dafei'));
```

Windows 下数据根目录通常为：

```text
%APPDATA%\Dafei\
```

IndexedDB 和 localStorage 都由 Electron/Chromium 存放在这个 userData 根目录下的对应子目录中。具体子目录由 Chromium 管理，不建议手动修改文件。

这个固定路径很重要：即使 exe 文件名、`productName` 或打包输出目录改变，只要 `electron/main.ts` 中的 `userData` 路径不变，应用仍会尝试读取同一份数据。

## 8. Electron 主进程

文件：`electron/main.ts`

负责：

- 创建 1200 × 800 的主窗口；
- 设置最小窗口尺寸；
- 配置 preload；
- 开发模式加载 Vite 地址；
- 生产模式加载 `dist/index.html`；
- 设置固定 userData 路径；
- 使用 `app.requestSingleInstanceLock()` 防止重复启动；
- 第二次启动时激活已运行的窗口。

主进程还没有实现：

- 打印机列表读取；
- 打印队列控制；
- 打印任务重试；
- 通过 Electron IPC 直接发送静默打印任务。

## 9. 当前打包配置

文件：`package.json`

当前配置：

```json
{
  "name": "dafei-win7-0317",
  "version": "1.0.0",
  "build": {
    "appId": "com.daifei.dafei-win7-0317",
    "productName": "dafei-0818",
    "directories": {
      "output": "release/dafei-0818"
    },
    "win": {
      "target": [
        {
          "target": "portable",
          "arch": ["ia32"]
        }
      ],
      "artifactName": "dafei-0818.exe"
    },
    "portable": {
      "artifactName": "dafei-0818.exe"
    }
  }
}
```

字段作用：

- `name`：npm 项目包名，主要用于项目标识和 npm 元数据；
- `appId`：Electron 应用唯一标识，主要用于应用身份和系统集成；
- `productName`：应用显示名称；
- `directories.output`：打包输出文件夹；
- `artifactName`：最终 exe 文件名；
- `arch: ia32`：生成 32 位 Windows 程序。

修改版本命名时，通常需要同步检查：

- `productName`
- `directories.output`
- `win.artifactName`
- `portable.artifactName`

`name` 和 `appId` 不应因为每天的 exe 文件名变化而随意修改，尤其不要用它们来决定数据目录。数据目录当前由 `electron/main.ts` 固定为 `Dafei`。

## 10. 已知限制和排查提示

### 打印任务只完成一部分

当前软件层面通过 `window.print()` 将多个标签交给 Chromium 和 Windows 打印队列，Electron 主进程没有管理打印任务。因此出现“打印机队列中有任务，但只打印一部分”时，需要同时检查：

- 打印预览中的标签数量是否正确；
- 是否误开启按扎选择；
- Windows 打印队列是否卡住；
- 打印机驱动和纸张尺寸是否正确；
- 40mm × 80mm 自定义纸张是否正确；
- 打印机是否需要断电重启；
- 是否存在多个打印任务同时发送。

### 订单数据找不到

优先检查：

1. `electron/main.ts` 中的 userData 路径是否仍为 `Dafei`；
2. 当前 exe 是否使用同一 Windows 用户账户；
3. `%APPDATA%\Dafei\` 是否存在；
4. IndexedDB 是否被清理；
5. 是否可以通过“数据管理”导入之前的 JSON 备份。

### 订单导入后颜色池没有恢复

这是当前设计行为：JSON 导入只导入 `forms` 订单对象，不导入 localStorage 中的颜色池、尺码池和部位池。

### 订单详情空白

页面通过 `src/App.tsx` 从 hash 中获取订单 ID，再调用 `src/services/db.ts` 的 `getFormById()`。如果 hash 中的 ID 不存在、数据目录改变或 IndexedDB 读取失败，应用会回到订单列表。

### 中文乱码

页面入口使用 UTF-8：

```html
<meta charset="UTF-8" />
```

如果只有某个页面乱码，应优先检查对应 `.tsx` 文件是否被错误编码保存。当前 `FormList.tsx` 和 `CuttingReport.tsx` 中仍可看到部分历史乱码注释，但页面显示文字应以模板中的实际字符串为准。

## 11. 后续可考虑的整理方向

以下内容目前没有在本次文档更新中修改代码，只作为后续维护建议：

- 将打印标签生成、打印样式参数和打印控制从 `FormEditor.tsx` 拆分为独立模块；
- 为订单、打印标签和导入导出数据增加更严格的类型；
- 将颜色池、尺码池、部位池纳入统一备份文件；
- 将 CDN 依赖改为本地依赖，减少离线环境下的加载风险；
- 将打印任务改为 Electron 主进程可控的打印流程，以便记录打印机、处理失败和重试；
- 清理历史乱码注释，避免后续维护时误解代码；
- 补充二维表格拖动排序、数据迁移和打印任务数量的自动化测试。
