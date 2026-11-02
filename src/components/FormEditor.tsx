import { defineComponent } from 'vue';
import { saveFormToDB, getLastBedNumber, getUniqueCustomers, getUniqueStyleNumbers, getLatestAmountPerPieceByStyleNumber, removeFromHistory, getHiddenHistory } from '../services/db.ts';
import { matchPoolItem, POOL_MATCH_HINT } from '../services/poolMatch.ts';
import { CuttingForm, MatrixHeader } from '../types.ts';
import { 
  IconPlus, IconSave, IconPrinter, IconArrowLeft, 
  IconGripVertical, IconGripHorizontal, IconCopy, IconTrash2, IconClipboard,
  IconDownload, IconUpload, IconDatabase, IconLoader2
} from './Icons.ts';
import {
  DEFAULT_COLORS,
  DEFAULT_SIZES,
  POOL_KEYS,
  getStoredPool,
  getStoredSectionPool,
  saveStoredPool
} from '../domain/pool.ts';
import { orderAmount, orderPieces, totalAmountOnSave } from '../domain/money.ts';
import { buildBundleMap, countBundles } from '../domain/bundle.ts';
import { buildColorTotals, buildSizeTotals } from '../domain/matrix.ts';
import { buildLabels, filterLabelsByBundles } from '../domain/labels.ts';
import LabelCard from './LabelCard.tsx';
import PrintPreview from './PrintPreview.tsx';
import PrintDialog from './PrintDialog.tsx';
import MatrixTable from './MatrixTable.tsx';
import PoolColumn from './PoolColumn.tsx';


const generateId = () => Math.random().toString(36).substr(2, 9);

export default defineComponent({
  name: 'FormEditor',
  components: {
    LabelCard,
    PrintPreview,
    PrintDialog,
    MatrixTable,
    PoolColumn,
    IconPlus, IconSave, IconPrinter, IconArrowLeft, 
    IconGripVertical, IconGripHorizontal, IconCopy, IconTrash2, IconClipboard,
    IconDownload, IconUpload, IconDatabase,
    IconLoader2 // 添加缺失的图标组件
  },
  emits: ['back', 'save', 'save-as-new', 'report'], // 添加emits声明
  props: {
    initialData: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      formData: (this.initialData 
        ? { additionalFee: 0, remark: '', ...JSON.parse(JSON.stringify(this.initialData)) } 
        : {
            id: generateId(),
            styleNumber: '',
            customer: '',
            bedNumber: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            rows: [] as MatrixHeader[],
            cols: [] as MatrixHeader[],
            data: {} as Record<string, number>,
            amountPerPiece: undefined,
            additionalFee: 0,
            remark: '',
            totalAmount: undefined
          }) as CuttingForm,
      saving: false,
      saveSuccess: false,
      isPreviewing: false,
      showPrintDialog: false,
      printMode: 'direct' as 'direct' | 'sectional',
      dragItem: null as number | null,
      dragOverItem: null as number | null,
      commonColors: getStoredPool(POOL_KEYS.colors, DEFAULT_COLORS) as string[],
      commonSizes: getStoredPool(POOL_KEYS.sizes, DEFAULT_SIZES) as string[],
      commonSections: getStoredSectionPool() as string[],
      selectedSections: [] as string[],
      newColorInput: '',
      newSizeInput: '',
      newSectionInput: '',
      // 池子折叠状态：默认只展示前 poolCollapsedLimit 个，其余折叠
      poolColorsExpanded: false,
      poolSizesExpanded: false,
      poolCollapsedLimit: 12,
      poolMatchHint: POOL_MATCH_HINT,
      rowSmartFill: {} as Record<string, boolean>,
      colSmartFill: {} as Record<string, boolean>,
      amountInputMode: (this.initialData && this.initialData.totalAmount !== undefined && this.initialData.totalAmount !== '')
        ? 'total'
        : 'unit',
      // 历史记录
      customerHistory: [] as {value: string, lastUsed: number, count: number}[],
      styleNumberHistory: [] as {value: string, lastUsed: number, count: number}[],
      hiddenCustomers: [] as string[],
      hiddenStyleNumbers: [] as string[],
      showCustomerHistory: false,
      showStyleNumberHistory: false,
      amountAutoFilled: false,
      styleNumberLookupSeq: 0,
      // 标记是否为新建订单（从未保存过）
      isNewOrder: !this.initialData,
      // 打印样式配置（实际打印输出）
      printFontSize: 22,        // 字号大小 (px)
      printLineSpacing: 1.2,    // 行间距倍数
      printPadding: 8,          // 内边距 (px)
      printGap: 10,             // 标签间距 (px)
      paperWidth: 40,           // 纸张宽度 (mm)
      paperHeight: 80,          // 纸张高度 (mm)
      showPrintSettings: false,
      // 选择性打印功能
      selectMode: false,
      selectedBundles: [] as number[]
    };
  },
  watch: {
    // 深度监听数据变化实现自动保存草稿（仅新订单）
    formData: {
      handler() {
        if (this.isNewOrder) {
          this.autoSaveDraft();
        }
      },
      deep: true
    }
  },
  mounted() {
    console.log('FormEditor mounted', {
      initialData: this.initialData,
      isPreviewing: this.isPreviewing,
      formData: this.formData
    });

    // 需要将异步操作封装到一个内部异步函数中
    (async () => {
      if (!this.initialData) {
        const lastNo = await getLastBedNumber();
        this.formData.bedNumber = String(lastNo + 1);
      }
      // 加载历史记录
      await this.loadHistory();
      
      // 添加键盘事件监听，允许使用ESC键退出预览模式
      window.addEventListener('keydown', this.handleKeyDown);
    })();
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
  },
  computed: {
    // 扎号分配：唯一实现见 domain/bundle.ts，遍历顺序固定为「尺码列外层、颜色行内层」
    bundleMap(): Map<string, number> {
      return buildBundleMap(this.formData.rows, this.formData.cols, this.formData.data);
    },
    // 标签数据：唯一实现见 domain/labels.ts
    labels() {
      return buildLabels(this.formData, {
        printMode: this.printMode,
        selectedSections: this.selectedSections
      });
    },
    totalBundles(): number {
      return countBundles(this.formData.rows, this.formData.cols, this.formData.data);
    },
    totalPieces(): number {
      return orderPieces(this.formData);
    },
    // 颜色小计：唯一实现见 domain/matrix.ts
    colorTotals(): Record<string, number> {
      return buildColorTotals(this.formData.rows, this.formData.cols, this.formData.data);
    },
    // 尺码小计：唯一实现见 domain/matrix.ts
    sizeTotals(): Record<string, number> {
      return buildSizeTotals(this.formData.rows, this.formData.cols, this.formData.data);
    },
    // 总金额：唯一实现见 domain/money.ts。无有效单价时回退 totalAmount，
    // 修复历史订单在编辑页显示 0.00 的问题。
    calculatedTotalAmount(): number {
      return orderAmount(this.formData, this.totalPieces);
    },
    isAllRowFillEnabled(): boolean {
      return this.formData.rows.length > 0 && this.formData.rows.every((r: MatrixHeader) => this.rowSmartFill[r.id]);
    },
    isAllColFillEnabled(): boolean {
      return this.formData.cols.length > 0 && this.formData.cols.every((c: MatrixHeader) => this.colSmartFill[c.id]);
    },
    // 过滤后的标签（根据选择模式）：唯一实现见 domain/labels.ts
    filteredLabels() {
      return filterLabelsByBundles(this.labels, this.selectMode, this.selectedBundles);
    },
    filteredCustomerHistory() {
      const query = this.formData.customer.trim().toLowerCase();
      if (!query) return this.customerHistory;
      return this.customerHistory.filter(item => item.value.toLowerCase().includes(query));
    },
    filteredStyleNumberHistory() {
      const query = this.formData.styleNumber.trim().toLowerCase();
      if (!query) return this.styleNumberHistory;
      return this.styleNumberHistory.filter(item => item.value.toLowerCase().includes(query));
    },
    // 打印样式计算属性
    printStyleVars() {
      return {
        '--print-font-size': `${this.printFontSize}px`,
        '--print-line-spacing': this.printLineSpacing,
        '--print-padding': `${this.printPadding}px`,
        '--print-gap': `${this.printGap}px`,
        '--paper-width': `${this.paperWidth}mm`,
        '--paper-height': `${this.paperHeight}mm`,
        '--print-area-width': '28mm',
        '--print-area-height': '60mm',
        '--print-area-top': '10mm'
      };
    },
    // 颜色池匹配结果
    poolColorMatches(): string[] {
      const query = this.newColorInput;
      if (!query.trim()) return this.commonColors;
      return this.commonColors.filter((name: string) => matchPoolItem(name, query));
    },
    // 颜色池实际展示项：未展开且未搜索时只展示前 N 个
    poolColorVisible(): string[] {
      const list = this.poolColorMatches;
      if (this.poolColorsExpanded || this.newColorInput.trim()) return list;
      return list.slice(0, this.poolCollapsedLimit);
    },
    poolColorHiddenCount(): number {
      return Math.max(0, this.poolColorMatches.length - this.poolColorVisible.length);
    },
    // 尺码池匹配结果
    poolSizeMatches(): string[] {
      const query = this.newSizeInput;
      if (!query.trim()) return this.commonSizes;
      return this.commonSizes.filter((name: string) => matchPoolItem(name, query));
    },
    poolSizeVisible(): string[] {
      const list = this.poolSizeMatches;
      if (this.poolSizesExpanded || this.newSizeInput.trim()) return list;
      return list.slice(0, this.poolCollapsedLimit);
    },
    poolSizeHiddenCount(): number {
      return Math.max(0, this.poolSizeMatches.length - this.poolSizeVisible.length);
    }
  },
  methods: {
    formatCreatedDate(timestamp: number) {
      const date = new Date(timestamp);
      return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    },

    // 处理键盘事件
    handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && this.isPreviewing) {
        this.isPreviewing = false;
      }
    },
    
    // 自动保存草稿（静默）
    async autoSaveDraft() {
      try {
        await saveFormToDB({ ...JSON.parse(JSON.stringify(this.formData)), updatedAt: Date.now() });
      } catch (e) {
        console.warn("草稿自动保存失败", e);
      }
    },
    addToPoolColor() {
      const name = this.newColorInput.trim();
      if (name && !this.commonColors.includes(name)) {
        this.commonColors.push(name);
        saveStoredPool(POOL_KEYS.colors, this.commonColors);
      }
      this.newColorInput = '';
    },
    addToPoolSize() {
      const name = this.newSizeInput.trim();
      if (name && !this.commonSizes.includes(name)) {
        this.commonSizes.push(name);
        saveStoredPool(POOL_KEYS.sizes, this.commonSizes);
      }
      this.newSizeInput = '';
    },
    addToPoolSection() {
      const name = this.newSectionInput.trim();
      if (name && !this.commonSections.includes(name)) {
        this.commonSections.push(name);
        saveStoredPool(POOL_KEYS.sections, this.commonSections);
      }
      if (name && !this.selectedSections.includes(name)) {
        this.selectedSections.push(name);
      }
      this.newSectionInput = '';
    },
    removeFromPool(type: 'color' | 'size' | 'section', name: string) {
      if (type === 'color') {
        this.commonColors = this.commonColors.filter((c: string) => c !== name);
        saveStoredPool(POOL_KEYS.colors, this.commonColors);
      } else if (type === 'size') {
        this.commonSizes = this.commonSizes.filter((s: string) => s !== name);
        saveStoredPool(POOL_KEYS.sizes, this.commonSizes);
      } else {
        this.commonSections = this.commonSections.filter((s: string) => s !== name);
        saveStoredPool(POOL_KEYS.sections, this.commonSections);
        this.selectedSections = this.selectedSections.filter((s) => s !== name);
      }
    },
    toggleSectionSelection(name: string) {
      const idx = this.selectedSections.indexOf(name);
      if (idx > -1) {
        this.selectedSections.splice(idx, 1);
      } else {
        this.selectedSections.push(name);
      }
    },
    getBundleNumber(rowId: string, colId: string) { return this.bundleMap.get(`${rowId}_${colId}`); },
    getCellValue(rowId: string, colId: string) { return this.formData.data[`${rowId}_${colId}`] || 0; },
    getColTotal(colId: string) {
      return this.formData.rows.reduce((sum: number, row: MatrixHeader) => sum + (this.formData.data[`${row.id}_${colId}`] || 0), 0);
    },
    toggleAllRowFill(e: Event) {
      const checked = (e.target as HTMLInputElement).checked;
      this.formData.rows.forEach((r: MatrixHeader) => this.rowSmartFill[r.id] = checked);
    },
    toggleAllColFill(e: Event) {
      const checked = (e.target as HTMLInputElement).checked;
      this.formData.cols.forEach((c: MatrixHeader) => this.colSmartFill[c.id] = checked);
    },
    addRow(name = '') {
      const newRow = { id: generateId(), name };
      this.formData.rows.push(newRow);
      this.rowSmartFill[newRow.id] = false;
    },
    deleteRow(index: number) {
      const rowId = this.formData.rows[index].id;
      this.formData.cols.forEach((col: MatrixHeader) => delete this.formData.data[`${rowId}_${col.id}`]);
      delete this.rowSmartFill[rowId];
      this.formData.rows.splice(index, 1);
    },
    addCol(name = '') {
      const newCol = { id: generateId(), name };
      this.formData.cols.push(newCol);
      this.colSmartFill[newCol.id] = false;
    },
    deleteCol(index: number) {
      const colId = this.formData.cols[index].id;
      this.formData.rows.forEach((row: MatrixHeader) => delete this.formData.data[`${row.id}_${colId}`]);
      delete this.colSmartFill[colId];
      this.formData.cols.splice(index, 1);
    },
    updateCell(rowId: string, colId: string, value: string) {
      const numValue = parseInt(value) || 0;
      this.formData.data[`${rowId}_${colId}`] = numValue;
      if (this.rowSmartFill[rowId]) {
        const idx = this.formData.cols.findIndex((c: MatrixHeader) => c.id === colId);
        if (idx !== -1) {
          for (let i = idx + 1; i < this.formData.cols.length; i++)
            this.formData.data[`${rowId}_${this.formData.cols[i].id}`] = numValue;
        }
      }
      if (this.colSmartFill[colId]) {
        const idx = this.formData.rows.findIndex((r: MatrixHeader) => r.id === rowId);
        if (idx !== -1) {
          for (let i = idx + 1; i < this.formData.rows.length; i++)
            this.formData.data[`${this.formData.rows[i].id}_${colId}`] = numValue;
        }
      }
    },
    handleInputFocus(e: FocusEvent) { (e.target as HTMLInputElement).select(); },
    // 重命名这个方法以避免重复
    handleCellKeyDown(e: KeyboardEvent, rowId: string, colId: string) {
      // 阻止上下箭头键的默认行为（数字增减）
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }
      
      // 处理方向键导航
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.navigateTableCell(e.key, rowId, colId);
      }
    },
    navigateTableCell(direction: string, currentRowId: string, currentColId: string) {
      const rows = this.formData.rows;
      const cols = this.formData.cols;
      
      // 找到当前行列的索引
      const currentRowIndex = rows.findIndex(row => row.id === currentRowId);
      const currentColIndex = cols.findIndex(col => col.id === currentColId);
      
      let newRowIndex = currentRowIndex;
      let newColIndex = currentColIndex;
      
      // 根据方向计算新的位置
      switch (direction) {
        case 'ArrowUp':
          newRowIndex = Math.max(0, currentRowIndex - 1);
          break;
        case 'ArrowDown':
          newRowIndex = Math.min(rows.length - 1, currentRowIndex + 1);
          break;
        case 'ArrowLeft':
          newColIndex = Math.max(0, currentColIndex - 1);
          break;
        case 'ArrowRight':
          newColIndex = Math.min(cols.length - 1, currentColIndex + 1);
          break;
      }
      
      // 获取新的行列ID
      const newRowId = rows[newRowIndex].id;
      const newColId = cols[newColIndex].id;
      
      // 查找并聚焦到新的输入框
      const newInput = document.querySelector(`input[data-row="${newRowId}"][data-col="${newColId}"]`) as HTMLInputElement;
      if (newInput) {
        newInput.focus();
        newInput.select();
      }
    },
    handleDragStart(e: DragEvent, index: number, type: string) {
      this.dragItem = index;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", type); // Use standard text/plain for better compatibility
      }
      // Add a slight delay to allow the drag image to be generated before hiding the element
      setTimeout(() => { 
        if (e.target instanceof HTMLElement) {
          e.target.style.opacity = '0.5'; 
        }
      }, 0);
    },
    handleDragEnd(e: DragEvent) {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '1';
      }
      this.dragItem = null;
      this.dragOverItem = null;
    },
    handleDragOver(e: DragEvent, index: number) { 
      e.preventDefault(); // Necessary to allow dropping
      this.dragOverItem = index; 
    },
    handleDropRow(e: DragEvent, dropIndex: number) {
      e.preventDefault();
      const type = e.dataTransfer ? e.dataTransfer.getData("text/plain") : '';
      
      if (type !== 'row' || this.dragItem === null || this.dragItem === dropIndex) return;
      
      const newRows = [...this.formData.rows];
      const draggedItem = newRows.splice(this.dragItem, 1)[0];
      const targetIndex = this.dragItem < dropIndex ? dropIndex - 1 : dropIndex;
      newRows.splice(targetIndex, 0, draggedItem);
      this.formData.rows = newRows;
      
      this.dragItem = null;
      this.dragOverItem = null;
    },
    handleDropCol(e: DragEvent, dropIndex: number) {
      e.preventDefault();
      const type = e.dataTransfer ? e.dataTransfer.getData("text/plain") : '';

      if (type !== 'col' || this.dragItem === null || this.dragItem === dropIndex) return;

      const newCols = [...this.formData.cols];
      const draggedItem = newCols.splice(this.dragItem, 1)[0];
      const targetIndex = this.dragItem < dropIndex ? dropIndex - 1 : dropIndex;
      newCols.splice(targetIndex, 0, draggedItem);
      this.formData.cols = newCols;

      this.dragItem = null;
      this.dragOverItem = null;
    },
    openPrintDialog() {
      if (this.totalBundles === 0) {
        alert("表格中没有数据，无法打印。");
        return;
      }
      this.showPrintDialog = true;
    },
    confirmPrint() {
      if (this.printMode === 'sectional' && this.selectedSections.length === 0) {
        alert("请选择至少一个部位。");
        return;
      }
      this.showPrintDialog = false;
      this.isPreviewing = true;
      window.scrollTo(0, 0);
    },
    executePrint() {
      if (this.selectMode && this.selectedBundles.length === 0) {
        alert('请选择至少一个扎号，或关闭选择模式后打印全部。');
        return;
      }
      this.$nextTick(() => window.print());
    },
    exitPrintPreview() {
      this.isPreviewing = false;
      this.selectMode = false;
      this.selectedBundles = [];
    },
    async loadHistory() {
      try {
        // 加载被隐藏的历史记录
        this.hiddenCustomers = getHiddenHistory('customer');
        this.hiddenStyleNumbers = getHiddenHistory('styleNumber');
        
        // 获取完整历史记录
        const allCustomers = await getUniqueCustomers();
        const allStyleNumbers = await getUniqueStyleNumbers();
        
        // 过滤掉已隐藏的
        this.customerHistory = allCustomers.filter(c => !this.hiddenCustomers.includes(c.value));
        this.styleNumberHistory = allStyleNumbers.filter(s => !this.hiddenStyleNumbers.includes(s.value));
      } catch (err) {
        console.error('加载历史记录失败:', err);
      }
    },
    async removeCustomer(value: string, event: MouseEvent) {
      event.stopPropagation();
      event.preventDefault();
      
      if (!confirm(`确定要从历史记录中删除"${value}"吗？\n\n注意：这不会删除已有的订单数据，只是不在下拉列表中显示。`)) {
        return;
      }
      
      try {
        removeFromHistory('customer', value);
        this.hiddenCustomers.push(value);
        this.customerHistory = this.customerHistory.filter(c => c.value !== value);
      } catch (err) {
        console.error('删除历史记录失败:', err);
        alert('删除失败，请重试');
      }
    },
    async removeStyleNumber(value: string, event: MouseEvent) {
      event.stopPropagation();
      event.preventDefault();
      
      if (!confirm(`确定要从历史记录中删除"${value}"吗？\n\n注意：这不会删除已有的订单数据，只是不在下拉列表中显示。`)) {
        return;
      }
      
      try {
        removeFromHistory('styleNumber', value);
        this.hiddenStyleNumbers.push(value);
        this.styleNumberHistory = this.styleNumberHistory.filter(s => s.value !== value);
      } catch (err) {
        console.error('删除历史记录失败:', err);
        alert('删除失败，请重试');
      }
    },
    toggleCustomerHistory() {
      this.showCustomerHistory = !this.showCustomerHistory;
      this.showStyleNumberHistory = false;
    },
    toggleStyleNumberHistory() {
      this.showStyleNumberHistory = !this.showStyleNumberHistory;
      this.showCustomerHistory = false;
    },
    handleCustomerFocus() {
      this.showCustomerHistory = true;
      this.showStyleNumberHistory = false;
      this.loadHistory('customer');
    },
    handleCustomerInput() {
      this.showCustomerHistory = true;
      this.showStyleNumberHistory = false;
    },
    handleStyleNumberFocus() {
      this.showStyleNumberHistory = true;
      this.showCustomerHistory = false;
      this.loadHistory('styleNumber');
    },
    async handleStyleNumberInput() {
      this.showStyleNumberHistory = true;
      this.showCustomerHistory = false;
      await this.applyHistoricalAmountPerPiece();
    },
    async applyHistoricalAmountPerPiece() {
      const styleNumber = this.formData.styleNumber.trim();
      const lookupSeq = ++this.styleNumberLookupSeq;
      if (!styleNumber) return;

      const amountPerPiece = await getLatestAmountPerPieceByStyleNumber(styleNumber);
      if (lookupSeq !== this.styleNumberLookupSeq || this.formData.styleNumber.trim() !== styleNumber) {
        return;
      }

      if (amountPerPiece !== undefined) {
        if (this.formData.amountPerPiece === undefined || this.amountAutoFilled) {
          this.formData.amountPerPiece = amountPerPiece;
          this.amountAutoFilled = true;
        }
      } else if (this.amountAutoFilled) {
        this.formData.amountPerPiece = undefined;
        this.amountAutoFilled = false;
      }
    },
    hideHistory(type: 'customer' | 'styleNumber') {
      setTimeout(() => {
        if (type === 'customer') {
          this.showCustomerHistory = false;
        } else {
          this.showStyleNumberHistory = false;
        }
      }, 150);
    },
    async selectHistoryItem(type: 'customer' | 'styleNumber', value: string) {
      if (type === 'customer') {
        this.formData.customer = value;
        this.showCustomerHistory = false;
      } else {
        this.formData.styleNumber = value;
        this.showStyleNumberHistory = false;
        await this.applyHistoricalAmountPerPiece();
      }
    },
    // 重置打印样式为默认值
    resetPrintStyle() {
      this.printFontSize = 14;
      this.printLineSpacing = 1.2;
      this.printPadding = 8;
      this.printGap = 10;
      this.paperWidth = 40;
      this.paperHeight = 80;
    },
    // 选择性打印方法
    toggleSelectMode() {
      this.selectMode = !this.selectMode;
      if (!this.selectMode) {
        this.selectedBundles = [];
      }
    },
    toggleBundleSelection(bundleNo: number) {
      const index = this.selectedBundles.indexOf(bundleNo);
      if (index > -1) {
        this.selectedBundles.splice(index, 1);
      } else {
        this.selectedBundles.push(bundleNo);
      }
    },
    selectAllBundles() {
      const allBundles = [...new Set(this.labels.map(l => l.bundleNo))];
      this.selectedBundles = allBundles;
    },
    clearBundleSelection() {
      this.selectedBundles = [];
    },
    // 新增方法：更新行名称
    updateRowName(index: number, event: Event) {
      const target = event.target as HTMLInputElement;
      this.formData.rows[index].name = target.value;
    },
    
    // 新增方法：更新列名称
    updateColName(index: number, event: Event) {
      const target = event.target as HTMLInputElement;
      this.formData.cols[index].name = target.value;
    },

    setAmountInputMode(mode: 'unit' | 'total') {
      this.amountInputMode = mode;
      if (mode === 'total') {
        this.formData.amountPerPiece = undefined;
      } else {
        this.formData.totalAmount = undefined;
      }
    },

    updateAmountValue(field: 'amountPerPiece' | 'additionalFee' | 'totalAmount', event: Event) {
      const target = event.target as HTMLInputElement;
      const value = target.value === '' ? undefined : Number(target.value);
      this.formData[field] = value !== undefined && Number.isFinite(value) ? value : undefined;
      if (field === 'amountPerPiece') {
        this.amountAutoFilled = false;
      }
    },

    goBackToList() {
      this.isPreviewing = false;
      this.showPrintDialog = false;
      this.selectMode = false;
      this.selectedBundles = [];
      this.$emit('back');
    },

    async saveForm() {
      this.saving = true;
      try {
        this.formData.additionalFee = Number(this.formData.additionalFee) || 0;
        // 无有效单价时保留历史 totalAmount。重构前这里无条件置 undefined，
        // 导致打开一张旧订单点一次保存，该单的总金额就永久丢失。
        this.formData.totalAmount = totalAmountOnSave(this.formData);

        const savedForm = JSON.parse(JSON.stringify({
          ...this.formData,
          updatedAt: Date.now()
        }));

        await saveFormToDB(savedForm);
        this.formData = JSON.parse(JSON.stringify(savedForm));
        this.saveSuccess = true;
        this.isNewOrder = false;

        setTimeout(() => {
          this.saveSuccess = false;
        }, 3000);

        this.$emit('save', savedForm);
      } catch (error) {
        console.error('Failed to save form:', error);
        alert('保存失败: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        this.saving = false;
      }
    },

    async saveAsNewForm() {
      this.saving = true;
      try {
        const now = Date.now();
        const savedForm = JSON.parse(JSON.stringify({
          ...this.formData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
          additionalFee: Number(this.formData.additionalFee) || 0,
          totalAmount: totalAmountOnSave(this.formData)
        }));

        await saveFormToDB(savedForm);
        this.formData = JSON.parse(JSON.stringify(savedForm));
        this.saveSuccess = true;
        this.isNewOrder = false;

        setTimeout(() => {
          this.saveSuccess = false;
        }, 3000);

        this.$emit('save-as-new', savedForm);
      } catch (error) {
        console.error('Failed to save form as new:', error);
        alert('另存为新订单失败: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        this.saving = false;
      }
    },

    // 新增方法：打印订单
    printOrder() {
      this.openPrintDialog();
    },
  },
  template: `
    <!-- Thermal Label Preview Interface -->
    <print-preview
      v-if="isPreviewing"
      :labels="filteredLabels"
      :all-labels="labels"
      :select-mode="selectMode"
      :selected-bundles="selectedBundles"
      :style-vars="printStyleVars"
      @exit="exitPrintPreview"
      @print="executePrint"
      @toggle-select-mode="toggleSelectMode"
      @select-all="selectAllBundles"
      @clear-selection="clearBundleSelection"
      @reset-style="resetPrintStyle"
      @toggle-bundle="toggleBundleSelection"
    />

    <print-dialog
      v-if="showPrintDialog"
      v-model:print-mode="printMode"
      v-model:new-section-input="newSectionInput"
      :selected-sections="selectedSections"
      :common-sections="commonSections"
      @close="showPrintDialog = false"
      @toggle-section="toggleSectionSelection"
      @remove-section="(section) => removeFromPool('section', section)"
      @add-section="addToPoolSection"
      @confirm="confirmPrint"
    />

    <!-- Main Editor UI -->
    <div v-if="!isPreviewing" class="min-h-screen bg-gray-50">
      <div class="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-screen-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div class="flex items-center gap-5 min-w-0">
            <button @click="goBackToList" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition" title="返回列表">
              <icon-arrow-left :size="24" />
            </button>
            <h2 class="text-2xl font-bold text-gray-900 truncate">{{ isNewOrder ? '新建裁床单' : '编辑裁床单' }}</h2>
            <span v-if="!isNewOrder" class="text-sm text-gray-500 whitespace-nowrap">创建时间：{{ formatCreatedDate(formData.createdAt) }}</span>
          </div>
          <div class="flex items-center gap-3">
            <button @click="$emit('report', formData)" class="h-12 px-6 flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-lg font-medium transition">
              <icon-clipboard :size="22" />
              裁床单报表
            </button>
            <button @click="printOrder" class="h-12 px-6 flex items-center gap-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-lg font-medium transition">
              <icon-printer :size="22" />
              打印菲
            </button>
            <button @click="saveAsNewForm" :disabled="saving" class="h-12 px-6 flex items-center gap-2 rounded-lg bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-60 text-lg font-medium transition">
              <icon-copy :size="22" />
              另存为新订单
            </button>
            <button @click="saveForm" :disabled="saving" class="h-12 px-6 flex items-center gap-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 text-lg font-medium transition">
              <icon-save v-if="!saving" :size="22" />
              <icon-loader2 v-else :size="22" :spin="true" />
              {{ saving ? '保存中...' : '保存订单' }}
            </button>
          </div>
        </div>
      </div>

      <div class="max-w-screen-2xl mx-auto px-6 py-10">
        <div class="bg-white border border-gray-200 rounded-xl shadow-sm px-10 py-10 min-h-[760px]">
          <div v-if="saveSuccess" class="mb-8 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center text-lg">
            {{ isNewOrder ? '订单已创建！' : '订单已更新！' }}
          </div>

          <div class="grid grid-cols-3 gap-12 mb-10">
            <div class="relative">
              <label class="block text-lg text-gray-600 mb-4">款号</label>
              <input v-model="formData.styleNumber" type="text" class="w-full h-14 border-0 border-b-2 border-gray-200 bg-transparent px-0 text-3xl font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-0 outline-none disabled:text-gray-500" placeholder="款号" @focus="handleStyleNumberFocus" @input="handleStyleNumberInput" @blur="hideHistory('styleNumber')" />
              <button type="button" @mousedown.prevent="toggleStyleNumberHistory" class="absolute right-0 bottom-4 text-gray-400 hover:text-gray-700" title="选择历史款号">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div v-if="showStyleNumberHistory" class="absolute left-0 right-0 z-20 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                <div v-for="item in filteredStyleNumberHistory" :key="item.value" @mousedown.prevent="selectHistoryItem('styleNumber', item.value)" class="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                  <div class="font-medium text-gray-900">{{ item.value }}</div>
                  <div class="text-xs text-gray-500">使用 {{ item.count }} 次</div>
                </div>
              </div>
            </div>

            <div class="relative">
              <label class="block text-lg text-gray-600 mb-4">客户</label>
              <input v-model="formData.customer" type="text" class="w-full h-14 border-0 border-b-2 border-gray-200 bg-transparent px-0 text-3xl font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-0 outline-none" placeholder="客户" @focus="handleCustomerFocus" @input="handleCustomerInput" @blur="hideHistory('customer')" />
              <button type="button" @mousedown.prevent="toggleCustomerHistory" class="absolute right-0 bottom-4 text-gray-400 hover:text-gray-700" title="选择历史客户">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div v-if="showCustomerHistory" class="absolute left-0 right-0 z-20 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                <div v-for="item in filteredCustomerHistory" :key="item.value" @mousedown.prevent="selectHistoryItem('customer', item.value)" class="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                  <div class="font-medium text-gray-900">{{ item.value }}</div>
                  <div class="text-xs text-gray-500">使用 {{ item.count }} 次</div>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-lg text-gray-600 mb-4">床号</label>
              <input v-model="formData.bedNumber" type="text" class="w-full h-14 border-0 border-b-2 border-gray-200 bg-transparent px-0 text-3xl font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-0 outline-none" placeholder="床号" />
            </div>
          </div>

          <div class="border border-gray-200 rounded-xl bg-white px-8 py-7 mb-6">
            <div class="flex flex-wrap items-center justify-between gap-6 mb-6">
              <div>
                <h3 class="text-xl font-bold text-gray-900">金额输入</h3>
                <p class="text-sm text-gray-500 mt-1">总金额 = 单价 x 订单数量 + 其他费用</p>
              </div>
            </div>

            <div class="grid grid-cols-4 gap-6">
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-2">订单数量</label>
                <div class="h-12 px-4 rounded-lg border border-gray-200 bg-gray-50 flex items-center text-2xl font-bold text-gray-900">{{ totalPieces }}</div>
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-2">单价金额 (元)</label>
                <input :value="formData.amountPerPiece ?? ''" @input="updateAmountValue('amountPerPiece', $event)" type="number" min="0" step="0.01" class="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-2xl font-bold text-gray-900 focus:border-blue-500 focus:ring-0 outline-none" placeholder="0.00" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-2">其他费用 (元)</label>
                <input :value="formData.additionalFee ?? 0" @input="updateAmountValue('additionalFee', $event)" type="number" min="0" step="0.01" class="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-2xl font-bold text-gray-900 focus:border-blue-500 focus:ring-0 outline-none" placeholder="0.00" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-2">总金额</label>
                <div class="h-12 px-4 rounded-lg border border-blue-200 bg-blue-50 flex items-center text-2xl font-bold text-blue-700">¥{{ calculatedTotalAmount.toFixed(2) }}</div>
              </div>
              
            </div>
          </div>

          <div class="border border-gray-200 rounded-xl bg-white px-8 py-7 mb-10">
            <label class="block text-sm font-bold text-gray-600 mb-2">订单备注</label>
            <textarea v-model="formData.remark" rows="3" class="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-lg text-gray-900 focus:border-blue-500 focus:ring-0 outline-none resize-y" placeholder="手动添加备注，不会打印在标签上"></textarea>
          </div>

          <div class="border border-gray-200 rounded-xl bg-gray-50 px-8 py-7 mb-10">
            <div class="grid grid-cols-2 gap-10 divide-x divide-gray-200">
              <pool-column
                side="left"
                title="颜色池"
                :count="poolColorMatches.length"
                :items="poolColorVisible"
                :hidden-count="poolColorHiddenCount"
                :expanded="poolColorsExpanded"
                :collapsed-limit="poolCollapsedLimit"
                :input="newColorInput"
                :hint="poolMatchHint"
                placeholder="搜索或新增颜色（文字 / 全拼 / 首字母）"
                empty-hint="没有匹配的颜色，按 Enter 可直接新增"
                @pick="addRow"
                @remove="(value) => removeFromPool('color', value)"
                @expand="poolColorsExpanded = true"
                @collapse="poolColorsExpanded = false"
                @update:input="newColorInput = $event"
                @submit="addRow(newColorInput); addToPoolColor()"
                @clear="newColorInput = ''"
              />

              <pool-column
                side="right"
                title="尺码池"
                :count="poolSizeMatches.length"
                :items="poolSizeVisible"
                :hidden-count="poolSizeHiddenCount"
                :expanded="poolSizesExpanded"
                :collapsed-limit="poolCollapsedLimit"
                :input="newSizeInput"
                :hint="poolMatchHint"
                placeholder="搜索或新增尺码（文字 / 全拼 / 首字母）"
                empty-hint="没有匹配的尺码，按 Enter 可直接新增"
                @pick="addCol"
                @remove="(value) => removeFromPool('size', value)"
                @expand="poolSizesExpanded = true"
                @collapse="poolSizesExpanded = false"
                @update:input="newSizeInput = $event"
                @submit="addCol(newSizeInput); addToPoolSize()"
                @clear="newSizeInput = ''"
              />
            </div>
          </div>

          <matrix-table
            :rows="formData.rows"
            :cols="formData.cols"
            :data="formData.data"
            :row-smart-fill="rowSmartFill"
            :col-smart-fill="colSmartFill"
            :color-totals="colorTotals"
            :size-totals="sizeTotals"
            :total-pieces="totalPieces"
            :is-all-row-fill-enabled="isAllRowFillEnabled"
            @update-row-name="updateRowName"
            @update-col-name="updateColName"
            @delete-row="deleteRow"
            @delete-col="deleteCol"
            @update-cell="updateCell"
            @cell-focus="handleInputFocus"
            @cell-keydown="handleCellKeyDown"
            @drag-start="handleDragStart"
            @drag-over="handleDragOver"
            @drop-row="handleDropRow"
            @drop-col="handleDropCol"
            @drag-end="handleDragEnd"
            @toggle-all-row-fill="toggleAllRowFill"
          />
        </div>
      </div>
    </div>
  `
});



