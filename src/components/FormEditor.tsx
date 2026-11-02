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


const generateId = () => Math.random().toString(36).substr(2, 9);

export default defineComponent({
  name: 'FormEditor',
  components: {
    LabelCard,
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
    // 显示当前编辑状态提示
    editStatusTip() {
      if (this.isNewOrder) {
        return '新订单 - 自动保存草稿中';
      } else {
        return '编辑已有订单 - 修改后需手动保存';
      }
    },
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
    <div v-if="isPreviewing" class="print-preview-shell fixed inset-0 bg-white z-50 overflow-auto p-6 print:bg-transparent print:p-0 print:z-0">
      <!-- Actual Thermal Label Print Output -->
      <div class="thermal-print-root hidden print:block" :style="printStyleVars">
        <label-card v-for="label in filteredLabels" :key="'print-'+label.id" :label="label" />
      </div>

      <div class="no-print max-w-6xl mx-auto">
        <div class="flex items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-5">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">打印预览</h2>
            <p class="text-gray-500 mt-1">{{ selectMode ? '已选择 ' + selectedBundles.length + ' 扎' : '当前打印全部扎号' }}，共 {{ filteredLabels.length }} 张标签</p>
          </div>
          <div class="flex items-center gap-3">
            <button @click="exitPrintPreview" class="h-11 px-5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">返回编辑</button>
            <button @click="executePrint" class="h-11 px-5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center gap-2">
              <icon-printer :size="18" />
              开始打印
            </button>
          </div>
        </div>

        <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <button @click="toggleSelectMode" :class="selectMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'" class="h-10 px-4 rounded-lg font-medium transition">
              {{ selectMode ? '按扎选择：开' : '按扎选择：关' }}
            </button>
            <button v-if="selectMode" @click="selectAllBundles" class="h-10 px-4 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">全选</button>
            <button v-if="selectMode" @click="clearBundleSelection" class="h-10 px-4 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">清空</button>
            <button @click="resetPrintStyle" class="h-10 px-4 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">默认纸张</button>
          </div>

          <div v-if="selectMode" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <button
              v-for="label in labels"
              :key="'bundle-pick-' + label.id"
              @click="toggleBundleSelection(label.bundleNo)"
              :class="selectedBundles.includes(label.bundleNo) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'"
              class="border rounded-lg p-3 text-left hover:border-blue-300 transition"
            >
              <div class="font-bold">扎 {{ label.bundleNo }}</div>
              <div class="text-sm mt-1">{{ label.color }} / {{ label.size }}</div>
              <div class="text-xs text-gray-500 mt-1">{{ label.qty }} 件</div>
            </button>
          </div>
        </div>

        <div v-if="filteredLabels.length === 0" class="text-center py-20 text-gray-500 bg-gray-50 border border-gray-200 rounded-xl">
          没有可打印的标签，请选择扎号或返回编辑检查数量。
        </div>
        <div v-else class="label-preview-container" :style="printStyleVars">
          <label-card v-for="label in filteredLabels" :key="'preview-'+label.id" :label="label" />
        </div>
      </div>
    </div>

    <!-- Print Details Dialog -->
    <div v-if="showPrintDialog" class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-4 no-print">
      <div class="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 class="text-xl font-bold text-gray-900">打印详情</h3>
            <p class="text-sm text-gray-500 mt-1">选择打印模式和需要打印的部位</p>
          </div>
          <button @click="showPrintDialog = false" class="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-xl leading-none">x</button>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              @click="printMode = 'direct'"
              :class="printMode === 'direct' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'"
              class="h-14 rounded-lg border text-lg font-bold hover:border-blue-300 transition"
            >
              默认模式
            </button>
            <button
              type="button"
              @click="printMode = 'sectional'"
              :class="printMode === 'sectional' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'"
              class="h-14 rounded-lg border text-lg font-bold hover:border-blue-300 transition"
            >
              部位选择模式
            </button>
          </div>

          <div v-if="printMode === 'sectional'" class="border border-gray-200 rounded-xl bg-gray-50 p-5">
            <div class="flex items-center justify-between border-b border-gray-200 pb-3 mb-5">
              <div>
                <h4 class="text-lg font-bold text-gray-900">部位选择池</h4>
                <p class="text-sm text-gray-500 mt-1">点击选择，右键从池中移除。打印顺序按选中的部位依次输出。</p>
              </div>
              <span class="text-sm text-gray-500">已选 {{ selectedSections.length }} 个</span>
            </div>

            <div class="flex flex-wrap gap-3 mb-5">
              <button
                v-for="section in commonSections"
                :key="'section-pool-' + section"
                type="button"
                @click="toggleSectionSelection(section)"
                @contextmenu.prevent="removeFromPool('section', section)"
                :class="selectedSections.includes(section) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-900'"
                class="min-w-[74px] h-12 px-5 border rounded-lg text-lg font-bold hover:border-blue-300 shadow-sm transition"
              >
                {{ section }}
              </button>
            </div>

            <div class="flex gap-3">
              <input v-model="newSectionInput" @keyup.enter="addToPoolSection" type="text" placeholder="添加新部位..." class="flex-1 h-12 px-4 border border-gray-200 rounded-lg bg-white text-lg focus:border-blue-500 focus:ring-0 outline-none" />
              <button @click="addToPoolSection" class="h-12 px-6 rounded-lg bg-blue-600 text-white text-lg hover:bg-blue-700 transition">添加</button>
            </div>
          </div>
        </div>

        <div class="px-6 py-5 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="showPrintDialog = false" class="h-11 px-5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium">取消</button>
          <button @click="confirmPrint" class="h-11 px-6 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center gap-2">
            <icon-printer :size="18" />
            打印预览
          </button>
        </div>
      </div>
    </div>

    <!-- Main Editor UI -->
    <div v-if="!isPreviewing" class="min-h-screen bg-gray-50">
      <div class="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-screen-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div class="flex items-center gap-5 min-w-0">
            <button @click="goBackToList" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition" title="返回列表">
              <icon-arrow-left :size="24" />
            </button>
            <h2 class="text-2xl font-bold text-gray-900 truncate">{{ isNewOrder ? '新建裁床单' : '编辑裁床单' }}</h2>
            <span class="px-3 py-2 rounded bg-gray-100 text-gray-400 text-sm">{{ isNewOrder ? '草稿实时保存中' : '修改后请保存' }}</span>
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
          <div :class="isNewOrder ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'" class="mb-8 px-5 py-4 rounded-lg border flex items-center gap-3 text-lg">
            <icon-save :size="22" />
            <span>{{ isNewOrder ? '新订单 - 自动保存草稿中' : '已有订单 - 保存后更新数据库' }}</span>
          </div>

          <div v-if="saveSuccess" class="mb-8 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center text-lg">
            {{ isNewOrder ? '订单已创建！' : '订单已更新！' }}
          </div>

          <div class="grid grid-cols-3 gap-12 mb-10">
            <div class="relative">
              <label class="block text-lg text-gray-600 mb-4">款号 (STYLE NO.)</label>
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
              <label class="block text-lg text-gray-600 mb-4">客户 (CUSTOMER)</label>
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
              <label class="block text-lg text-gray-600 mb-4">床号 (BED NO.)</label>
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
              <div class="pr-10">
                <div class="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
                  <h3 class="text-xl font-bold text-gray-900">
                    颜色池
                    <span class="ml-2 text-sm font-normal text-gray-400">{{ poolColorMatches.length }} 个</span>
                  </h3>
                  <span class="text-sm text-gray-400">右键移除</span>
                </div>
                <div class="flex flex-wrap items-center gap-3 mb-4 min-h-[108px] content-start">
                  <button v-for="color in poolColorVisible" :key="'color-pool-' + color" @click="addRow(color)" @contextmenu.prevent="removeFromPool('color', color)" class="min-w-[62px] h-12 px-5 bg-white border border-gray-200 rounded-lg text-xl text-gray-900 hover:border-blue-300 hover:bg-blue-50 shadow-sm transition">{{ color }}</button>
                  <button v-if="poolColorHiddenCount > 0" @click="poolColorsExpanded = true" class="h-12 px-4 rounded-lg border border-dashed border-gray-300 text-base text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">展开 +{{ poolColorHiddenCount }}</button>
                  <button v-else-if="poolColorsExpanded && poolColorMatches.length > poolCollapsedLimit && !newColorInput.trim()" @click="poolColorsExpanded = false" class="h-12 px-4 rounded-lg border border-dashed border-gray-300 text-base text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">收起</button>
                  <span v-if="newColorInput.trim() && poolColorMatches.length === 0" class="text-base text-gray-400">没有匹配的颜色，按 Enter 可直接新增</span>
                </div>
                <div class="flex gap-3">
                  <div class="relative flex-1">
                    <input v-model="newColorInput" @keyup.enter="addRow(newColorInput); addToPoolColor()" type="text" :title="poolMatchHint" placeholder="搜索或新增颜色（文字 / 全拼 / 首字母）" class="w-full h-12 pl-4 pr-11 border border-gray-200 rounded-lg bg-white text-lg focus:border-blue-500 focus:ring-0 outline-none" />
                    <button v-if="newColorInput" @click="newColorInput = ''" title="清空" class="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600">×</button>
                  </div>
                  <button @click="addRow(newColorInput); addToPoolColor()" class="h-12 px-6 rounded-lg bg-blue-600 text-white text-lg hover:bg-blue-700 transition">添加</button>
                </div>
              </div>

              <div class="pl-10">
                <div class="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
                  <h3 class="text-xl font-bold text-gray-900">
                    尺码池
                    <span class="ml-2 text-sm font-normal text-gray-400">{{ poolSizeMatches.length }} 个</span>
                  </h3>
                  <span class="text-sm text-gray-400">右键移除</span>
                </div>
                <div class="flex flex-wrap items-center gap-3 mb-4 min-h-[108px] content-start">
                  <button v-for="size in poolSizeVisible" :key="'size-pool-' + size" @click="addCol(size)" @contextmenu.prevent="removeFromPool('size', size)" class="min-w-[62px] h-12 px-5 bg-white border border-gray-200 rounded-lg text-xl text-gray-900 hover:border-blue-300 hover:bg-blue-50 shadow-sm transition">{{ size }}</button>
                  <button v-if="poolSizeHiddenCount > 0" @click="poolSizesExpanded = true" class="h-12 px-4 rounded-lg border border-dashed border-gray-300 text-base text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">展开 +{{ poolSizeHiddenCount }}</button>
                  <button v-else-if="poolSizesExpanded && poolSizeMatches.length > poolCollapsedLimit && !newSizeInput.trim()" @click="poolSizesExpanded = false" class="h-12 px-4 rounded-lg border border-dashed border-gray-300 text-base text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">收起</button>
                  <span v-if="newSizeInput.trim() && poolSizeMatches.length === 0" class="text-base text-gray-400">没有匹配的尺码，按 Enter 可直接新增</span>
                </div>
                <div class="flex gap-3">
                  <div class="relative flex-1">
                    <input v-model="newSizeInput" @keyup.enter="addCol(newSizeInput); addToPoolSize()" type="text" :title="poolMatchHint" placeholder="搜索或新增尺码（文字 / 全拼 / 首字母）" class="w-full h-12 pl-4 pr-11 border border-gray-200 rounded-lg bg-white text-lg focus:border-blue-500 focus:ring-0 outline-none" />
                    <button v-if="newSizeInput" @click="newSizeInput = ''" title="清空" class="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600">×</button>
                  </div>
                  <button @click="addCol(newSizeInput); addToPoolSize()" class="h-12 px-6 rounded-lg bg-blue-600 text-white text-lg hover:bg-blue-700 transition">添加</button>
                </div>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto pb-2">
            <table class="min-w-full border-collapse text-gray-900">
              <thead>
                <tr class="bg-gray-50">
                  <th class="sticky left-0 z-20 w-[200px] min-w-[200px] max-w-[200px] h-24 border border-gray-300 bg-gray-50 relative align-top p-0">
                    <div class="absolute left-0 top-0 w-full h-full" style="background: linear-gradient(to top right, transparent 49.4%, #d1d5db 50%, transparent 50.6%);"></div>
                    <span class="absolute left-4 bottom-4 text-base font-bold">颜色</span>
                    <span class="absolute right-4 top-3 text-base font-bold">尺码</span>
                  </th>
                  <th v-for="(col, colIdx) in formData.cols" :key="'header-' + col.id" class="w-[112px] min-w-[112px] max-w-[112px] h-24 border border-gray-300 bg-gray-50 px-3 group relative">
                    <button
                      type="button"
                      draggable="true"
                      @dragstart="handleDragStart($event, colIdx, 'col')"
                      @dragover.prevent="handleDragOver($event, colIdx)"
                      @drop="handleDropCol($event, colIdx)"
                      @dragend="handleDragEnd"
                      title="拖动调整尺码顺序"
                      class="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-blue-100 hover:text-blue-600 active:cursor-grabbing"
                    >
                      <IconGripHorizontal :size="16" />
                    </button>
                    <input :value="col.name" @input="updateColName(colIdx, $event)" class="w-full bg-transparent text-center text-2xl font-bold outline-none focus:text-blue-600" />
                    <button @click="deleteCol(colIdx)" class="absolute right-2 top-2 w-7 h-7 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition">x</button>
                    <label class="absolute right-4 bottom-3 flex flex-col items-center gap-1 text-sm text-gray-600 font-medium">
                      <span>列复制<input type="checkbox" v-model="colSmartFill[col.id]" class="w-5 h-5" /></span>
                      
                    </label>
                  </th>
                  <th class="min-w-[120px] h-24 border border-gray-300 bg-gray-50 text-lg font-bold">合计</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIdx) in formData.rows" :key="'row-' + row.id" class="group">
                  <th class="sticky left-0 z-10 w-[200px] min-w-[200px] max-w-[200px] h-20 border border-gray-300 bg-gray-50 px-4 relative">
                    <button
                      type="button"
                      draggable="true"
                      @dragstart="handleDragStart($event, rowIdx, 'row')"
                      @dragover.prevent="handleDragOver($event, rowIdx)"
                      @drop="handleDropRow($event, rowIdx)"
                      @dragend="handleDragEnd"
                      title="拖动调整颜色顺序"
                      class="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-blue-100 hover:text-blue-600 active:cursor-grabbing"
                    >
                      <IconGripVertical :size="16" />
                    </button>
                    <input :value="row.name" @input="updateRowName(rowIdx, $event)" class="w-full bg-transparent text-center text-2xl font-bold outline-none focus:text-blue-600" />
                    <button @click="deleteRow(rowIdx)" class="absolute right-2 top-2 w-7 h-7 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition">x</button>
                    <span v-if="rowSmartFill[row.id]" class="absolute left-2 top-2 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">{{ rowIdx + 1 }}</span>
                  </th>
                  <td v-for="col in formData.cols" :key="'cell-' + row.id + '-' + col.id" class="w-[112px] min-w-[112px] max-w-[112px] h-20 border border-gray-300 bg-white text-center">
                    <input :value="getCellValue(row.id, col.id)" @input="updateCell(row.id, col.id, $event.target.value)" @focus="handleInputFocus" @keydown="handleCellKeyDown($event, row.id, col.id)" :data-row="row.id" :data-col="col.id" class="w-full h-full bg-transparent text-center text-2xl outline-none focus:bg-blue-50 focus:ring-2 focus:ring-blue-500" />
                  </td>
                  <td class="min-w-[120px] h-20 border border-gray-300 bg-gray-50 text-center text-xl font-bold">{{ colorTotals[row.id] || 0 }}</td>
                </tr>
                <tr>
                  <th class="sticky left-0 z-10 w-[200px] min-w-[200px] max-w-[200px] h-16 border border-gray-300 bg-gray-50 text-base font-bold">
                    <label class="inline-flex flex-col items-center gap-1 text-gray-600">
                      <span>行复制<input type="checkbox" :checked="isAllRowFillEnabled" @change="toggleAllRowFill" class="w-5 h-5" /></span>
                    </label>
                  </th>
                  <td v-for="col in formData.cols" :key="'total-' + col.id" class="w-[112px] min-w-[112px] max-w-[112px] h-16 border border-gray-300 bg-gray-50 text-center text-xl font-bold">{{ getColTotal(col.id) }}</td>
                  <td class="min-w-[120px] h-16 border border-gray-300 bg-blue-50 text-center text-xl font-bold text-blue-700">{{ totalPieces }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
});



