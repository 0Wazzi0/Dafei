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
  "pinyin-pro": "^3.29.5",
  "vue": "3",
  "xlsx": "^0.18.5"
}
```

### devDependencies

```json
{
  "@types/node": "^22.14.0",
  "@vitejs/plugin-vue": "^5.2.4",
  "autoprefixer": "^10.6.2",
  "concurrently": "^8.2.2",
  "cross-env": "^7.0.3",
  "electron": "^14.2.9",
  "electron-builder": "^26.7.0",
  "postcss": "^8.5.32",
  "tailwindcss": "^3.4.19",
  "typescript": "~5.8.2",
  "vite": "^6.2.0",
  "wait-on": "^7.2.0"
}
```

### 外部 CDN

当前**没有任何外部 CDN 依赖**。Tailwind 与 SheetJS 已改为本地依赖：

- Tailwind：`tailwind.config.js` + `postcss.config.js` + `src/styles.css`，构建期生成静态 CSS；
- SheetJS：`src/components/FormList.tsx` 中 `import * as XLSX from 'xlsx'`。

这一项改动的原因：旧版本从 `cdn.tailwindcss.com` 与 `cdn.sheetjs.com` 加载，断网时全站失去样式、导出 Excel 报 `XLSX is not defined`，而 portable exe 多部署在无外网的车间电脑上。

注意：npm 渠道的 `xlsx` 最新即 `0.18.5`；原先 CDN 上的 `0.20.1` 只能通过 SheetJS 自有渠道获取。当前代码用到的 `utils.aoa_to_sheet` / `utils.book_new` / `utils.book_append_sheet` / `writeFile` / `!merges` / `!cols` 在 0.18.5 中均可用。

## 4. 常用命令

```bash
# 启动 Vite 开发服务器
npm run dev

# 构建前端
npm run build

# 运行单元测试（node:test，直接跑 TypeScript，无需额外框架）
npm test

# 编译 Electron 主进程
npm run compile:electron

# 启动 Electron 开发模式（自动编译主进程 + 起 Vite + 等端口就绪后启动 Electron）
npm run electron:dev

# 构建前端、编译 Electron 并打包 Windows portable ia32 exe
npm run pack
```

当前 `npm run pack` 的实际流程是：

1. 执行 `vite build`；
2. 执行 `tsc -p tsconfig.electron.json`，直接输出 CommonJS 格式的主进程文件；
3. 使用 electron-builder 打包 portable、ia32 版本。

历史上的第 3 步「用 build-electron-main.cjs 把 ESM 转 CJS」已删除：`tsconfig.electron.json` 的 `module` 本来就是 `CommonJS`，tsc 输出已是 `require` 形式，那个脚本的 `import ... from` 正则永远匹配不到，实际只做了 `main.js` 到 `main.cjs` 的复制，而 `package.json` 的 `main` 指向的正是 `main.js`。

开发时可以二选一：

- `npm run electron:dev`：一条命令起完整开发环境；
- `run-dev.bat`：先手动 `npm run dev`，再双击该脚本，以 `--remote-debugging-port=9222` 启动 Electron，便于连接调试器。

## 5. 当前目录结构

```text
dafei/
├── src/
│   ├── App.tsx                    # 页面状态、哈希路由和页面切换
│   ├── index.tsx                  # Vue 应用入口
│   ├── styles.css                 # 样式入口（@tailwind base/components/utilities）
│   ├── types.ts                   # CuttingForm、MatrixHeader 等类型
│   ├── domain/                    # 纯函数层：业务规则的唯一实现
│   │   ├── money.ts               # 金额与件数（含 totalAmount 回退规则）
│   │   ├── bundle.ts              # 扎号分配与扎明细
│   │   ├── matrix.ts              # 颜色/尺码小计、同名合并汇总
│   │   ├── labels.ts              # 热敏标签数据生成、按扎号筛选
│   │   └── pool.ts                # 颜色池/尺码池/部位池读写
│   ├── components/
│   │   ├── FormList.tsx           # 首页订单列表、Excel 导出
│   │   ├── FormEditor.tsx         # 新建/编辑订单、二维表格和标签打印
│   │   ├── CuttingReport.tsx      # 裁床单报表和报表打印
│   │   ├── DataManager.tsx        # JSON 数据导入、导出和清空
│   │   └── Icons.ts               # 图标组件
│   └── services/
│       ├── db.ts                  # IndexedDB 数据访问和 JSON 订单备份
│       └── poolMatch.ts           # 颜色池/尺码池的拼音模糊匹配
├── tests/                         # node:test 单元测试
│   ├── money.test.ts              # 金额规则
│   ├── bundle.test.ts             # 扎号顺序与连续性
│   ├── matrix.test.ts             # 小计与同名合并
│   ├── labels.test.ts             # 标签张数、页码、部位展开
│   └── pool-match.test.ts         # 拼音/首字母匹配
├── electron/
│   ├── main.ts                    # Electron 主进程、窗口和用户数据目录
│   └── preload.js                 # preload 文件
├── index.html                     # 页面入口和打印 CSS
├── tailwind.config.js             # Tailwind 扫描范围
├── postcss.config.js              # PostCSS 插件
├── package.json                   # npm 脚本、依赖和 electron-builder 配置
├── package-lock.json              # npm 依赖锁定文件
├── vite.config.ts                 # Vite 配置
├── tsconfig.json                  # 前端 TypeScript 配置
├── tsconfig.electron.json         # Electron 主进程 TypeScript 配置
├── run-dev.bat                    # 开发时以调试端口启动 Electron
├── program.md                     # 当前项目说明文档
└── release/                       # 打包输出目录，生成后存在
```

旧的根目录 `components/`、`services/`、`App.tsx`、`index.tsx` 等不属于当前源码入口。当前代码引用的是 `src/` 下的文件。

`src/domain/` 是业务规则的唯一实现处。历史上一部分规则（金额、扎号、汇总）在三个组件里各写一遍且互不一致，现已全部收敛到这里。修改这些规则时只改 domain 层，不要在组件里另写一份。

`tests/` 下用例的期望值取自重构前的实现，作为行为基线。改动 domain 层后必须让 `npm test` 保持通过。

`build-electron-main.cjs` 已删除；`dist-electron/`、`dist/`、`release/` 均为构建产物，不纳入版本库。


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

金额规则由 `src/domain/money.ts` 的 `orderAmount()` 统一实现，按优先级：

```text
1. 有有效单价：总金额 = 单价 × 订单数量 + 其他费用
2. 无有效单价、但有 totalAmount：直接使用 totalAmount
3. 两者都没有：仅其他费用
```

「有效单价」指能转成有限数字的值；空字符串、null、undefined 一律视为未填，而不是 0。这个区分决定了历史订单能否正确回退到 `totalAmount`。

`additionalFee` 默认值为 `0`，在列表中作为独立列导出。

保存时 `totalAmount` 的去留由 `totalAmountOnSave()` 决定：有有效单价才清空该字段（金额可由单价推导），无有效单价则原样保留。

重构前这套规则在 `FormEditor`、`FormList`、`CuttingReport` 中各写一遍且互不一致，导致只有 `totalAmount` 的历史订单在编辑页显示 0.00、而在列表和报表显示正确金额。现已收敛为单一实现，修改金额规则只改 `domain/money.ts`。

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

其中 `totalAmount` 是兼容历史数据保留的可选字段。保存规则：有有效单价时清空该字段（金额由单价推导），无有效单价时保留原值。

注意：重构前保存逻辑无条件清空该字段。用户打开一张只有 `totalAmount` 的旧订单、点一次保存，该单的总金额就永久丢失，之后连列表和报表也会显示 0。该问题已修复，`tests/money.test.ts` 中有对应回归用例。

### 7.2 颜色池、尺码池和部位池

文件：`src/components/FormEditor.tsx`

键名集中在 `src/domain/pool.ts` 的 `POOL_KEYS` 中，**键名与取值范围不可更改**，用户机器上已有数据依赖这些键。

```text
pool_colors       # 颜色池
pool_sizes        # 尺码池
pool_sections     # 部位池
pool_sections_v2  # 部位池版本标记，用于一次性补齐默认部位
```

客户和款号历史隐藏项由 `src/services/db.ts` 写入：

```text
hidden_customers
hidden_styleNumbers
```

数据管理面板的操作时间戳由 `src/components/DataManager.tsx` 写入：

```text
lastExport        # 最后导出时间
lastImport        # 最后导入时间
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
    "productName": "dafei-1030",
    "directories": {
      "output": "release/${productName}"
    },
    "win": {
      "icon": "images/icon.ico",
      "target": [
        {
          "target": "portable",
          "arch": ["ia32"]
        }
      ],
      "artifactName": "${productName}.exe"
    },
    "portable": {
      "artifactName": "${productName}.exe"
    }
  }
}
```

字段作用：

- `name`：npm 项目包名，主要用于项目标识和 npm 元数据；
- `appId`：Electron 应用唯一标识，主要用于应用身份和系统集成；
- `productName`：应用显示名称，同时是**唯一需要修改的版本号字段**；
- `directories.output`：打包输出文件夹，引用 `${productName}`；
- `artifactName`：最终 exe 文件名，引用 `${productName}`；
- `arch: ia32`：生成 32 位 Windows 程序。

出包时只改 `productName` 一处，输出目录与 exe 文件名自动跟随。重构前三处都是硬编码，每次发版要改 4 个地方，且已出现文档与实物不一致（本文件此前记录的还是 `dafei-0818`，实际产物已是 `dafei-1030`）。

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

### 已完成（2026-11 重构）

- CDN 依赖本地化：Tailwind 与 SheetJS 均改为本地依赖，产物不再请求外网，断网可用；
- 金额、扎号、汇总、标签生成从三个组件收敛到 `src/domain/`，消除同一规则多份实现；
- 修复历史订单金额被销毁的问题（编辑页显示 0.00、保存即抹掉 `totalAmount`）；
- 补充单元测试：`tests/` 下 44 个用例，覆盖金额、扎号、汇总、标签、拼音匹配；
- 清理 `FormEditor.tsx` 中 105 行死代码（含 7 个与 computed 同名的重复 getter）；
- IndexedDB 连接单例化，导入由逐条事务改为单事务；
- 删除冗余的 build-electron-main 构建步骤，修正 `electron:dev` 端口，版本号单一化；
- 清除 `CuttingReport.tsx` 中 summaryMatrix 区域的乱码注释。

### 仍待处理

- `CuttingReport.tsx` 第 35 行附近仍有 GBK/UTF-8 混合乱码的注释。**不要用脚本批量转码**，会把中文模板正文一起破坏，只能逐处手工替换；
- `FormEditor.tsx` 仍有约 1150 行，尚未按 UI 区块拆分为独立组件；打印标签模板在其中重复两份（预览一份、打印一份）；
- 二维表格的键盘导航仍通过 `document.querySelector` 直接操作 DOM，应改为 ref 数组；
- 类型偏弱：前端 `tsconfig.json` 未开 `strict`，`any` 较多；`DataManager.tsx` 与 `vite.config.ts` 各有一个既存类型错误；
- 颜色池、尺码池、部位池仍未纳入 JSON 备份文件，换机迁移后需重新维护；
- 打印任务仍依赖 `window.print()`，Electron 主进程未介入，无法记录打印机、处理失败与重试。该项需先在真机记录一次「只打印一部分」时的队列状态再决定方案；
- 二维表格拖动排序、数据迁移等交互流程尚无自动化测试。
