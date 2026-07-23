
import { defineComponent } from 'vue';
import { saveFormToDB, getLastBedNumber, getUniqueCustomers, getUniqueStyleNumbers, removeFromHistory, getHiddenHistory } from '../services/db.ts';
import { CuttingForm, MatrixHeader } from '../types.ts';
import { 
  IconPlus, IconSave, IconPrinter, IconArrowLeft, 
  IconGripVertical, IconGripHorizontal, IconCopy, IconTrash2, IconClipboard,
  IconDownload, IconUpload, IconDatabase, IconLoader2
} from './Icons.ts';


const generateId = () => Math.random().toString(36).substr(2, 9);
const DEFAULT_COLORS = ['红', '绿', '蓝', '黑', '白', '黄', '藏青', '灰'];
const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const DEFAULT_SECTIONS = ['袖口', '前幅', '后幅'];

const getStoredPool = (key: string, defaults: string[]) => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [...defaults];
};

const getStoredSectionPool = () => {
  const stored = localStorage.getItem('pool_sections');
  if (!stored) return [...DEFAULT_SECTIONS];

  const pool = JSON.parse(stored);
  if (localStorage.getItem('pool_sections_v2') === '1') return pool;

  const migratedPool = [...pool, ...DEFAULT_SECTIONS.filter((item) => !pool.includes(item))];
  localStorage.setItem('pool_sections', JSON.stringify(migratedPool));
  localStorage.setItem('pool_sections_v2', '1');
  return migratedPool;
};

const saveStoredPool = (key: string, pool: string[]) => {
  localStorage.setItem(key, JSON.stringify(pool));
};

export default defineComponent({
  name: 'FormEditor',
  components: {
    IconPlus, IconSave, IconPrinter, IconArrowLeft, 
    IconGripVertical, IconGripHorizontal, IconCopy, IconTrash2, IconClipboard,
    IconDownload, IconUpload, IconDatabase,
    IconLoader2 // 添加缺失的图标组件
  },
  emits: ['back', 'save', 'report'], // 添加emits声明
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
      commonColors: getStoredPool('pool_colors', DEFAULT_COLORS) as string[],
      commonSizes: getStoredPool('pool_sizes', DEFAULT_SIZES) as string[],
      commonSections: getStoredSectionPool() as string[],
      selectedSections: [] as string[],
      newColorInput: '',
      newSizeInput: '',
      newSectionInput: '',
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
      // 标记是否为新建订单（从未保存过）
      isNewOrder: !this.initialData,
      // 打印样式配置（实际打印输出）
      printFontSize: 14,        // 字号大小 (px)
      printLineSpacing: 1.2,    // 行间距倍数
      printPadding: 8,          // 内边距 (px)
      printGap: 10,             // 标签间距 (px)
      paperWidth: 40,           // 纸张宽度 (mm)
      paperHeight: 80,          // 纸张高度 (mm)
      // 打印预览相关
      printScale: 100,
      printOffsetX: 0,
      printOffsetY: 0,
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
    // 打印预览样式
    previewStyle() {
      return {
        transform: `scale(${this.printScale / 100})`,
        transformOrigin: 'center top',
        marginLeft: `${this.printOffsetX}px`,
        marginTop: `${this.printOffsetY}px`
      };
    },
    bundleMap(): Map<string, number> {
      const map = new Map<string, number>();
      let counter = 1;
      const rows = this.formData.rows || [];
      const cols = this.formData.cols || [];
      
      cols.forEach((col: MatrixHeader) => {
        rows.forEach((row: MatrixHeader) => {
          const key = `${row.id}_${col.id}`;
          const qty = this.formData.data[key] || 0;
          if (qty > 0) {
            map.set(key, counter++);
          }
        });
      });
      return map;
    },
    labels() {
      const list: any[] = [];
      const rows = this.formData.rows || [];
      const cols = this.formData.cols || [];
      
      const sectionsToPrint = this.printMode === 'sectional' && this.selectedSections.length > 0 
        ? this.selectedSections 
        : [''];

      sectionsToPrint.forEach((sectionName) => {
        cols.forEach((col: MatrixHeader) => {
          rows.forEach((row: MatrixHeader) => {
            const key = `${row.id}_${col.id}`;
            const qty = this.formData.data[key] || 0;
            if (qty > 0) {
              const bundleNo = this.bundleMap.get(key);
              list.push({
                id: `${key}_${sectionName}`,
                styleNumber: this.formData.styleNumber || '-',
                customer: this.formData.customer || '-',
                bedNumber: this.formData.bedNumber || '-',
                color: row.name,
                size: col.name,
                bundleNo: bundleNo,
                qty: qty,
                section: sectionName
              });
            }
          });
        });
      });
      
      const totalCount = list.length;
      return list.map((item, index) => ({ 
        ...item, 
        currentPage: index + 1, 
        totalPage: totalCount 
      }));
    },
    totalBundles(): number { return this.bundleMap.size; },
    totalPieces(): number {
      const values = Object.values(this.formData.data) as number[];
      return values.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
    },
    // 计算每个颜色的总数
    colorTotals(): Record<string, number> {
      const totals: Record<string, number> = {};
      
      this.formData.rows.forEach((row: MatrixHeader) => {
        totals[row.id] = 0;
        
        this.formData.cols.forEach((col: MatrixHeader) => {
          const key = `${row.id}_${col.id}`;
          const qty = this.formData.data[key] || 0;
          totals[row.id] += qty;
        });
      });
      
      return totals;
    },
    // 计算每个尺码的总数
    sizeTotals(): Record<string, number> {
      const totals: Record<string, number> = {};
      
      this.formData.cols.forEach((col: MatrixHeader) => {
        totals[col.id] = 0;
        
        this.formData.rows.forEach((row: MatrixHeader) => {
          const key = `${row.id}_${col.id}`;
          const qty = this.formData.data[key] || 0;
          totals[col.id] += qty;
        });
      });
      
      return totals;
    },
    // 计算总金额
    calculatedTotalAmount(): number {
      const amountPerPiece = Number(this.formData.amountPerPiece) || 0;
      return amountPerPiece * this.totalPieces;
    },
    isAllRowFillEnabled(): boolean {
      return this.formData.rows.length > 0 && this.formData.rows.every((r: MatrixHeader) => this.rowSmartFill[r.id]);
    },
    isAllColFillEnabled(): boolean {
      return this.formData.cols.length > 0 && this.formData.cols.every((c: MatrixHeader) => this.colSmartFill[c.id]);
    },
    // 过滤后的标签（根据选择模式）
    filteredLabels() {
      if (!this.selectMode || this.selectedBundles.length === 0) {
        return this.labels;
      }
      return this.labels.filter(label => this.selectedBundles.includes(label.bundleNo));
    },
    // 打印样式计算属性
    printStyleVars() {
      return {
        '--print-font-size': `${this.printFontSize}px`,
        '--print-line-spacing': this.printLineSpacing,
        '--print-padding': `${this.printPadding}px`,
        '--print-gap': `${this.printGap}px`,
        '--paper-width': `${this.paperWidth}mm`,
        '--paper-height': `${this.paperHeight}mm`
      };
    }
  },
  methods: {
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
        saveStoredPool('pool_colors', this.commonColors);
      }
      this.newColorInput = '';
    },
    addToPoolSize() {
      const name = this.newSizeInput.trim();
      if (name && !this.commonSizes.includes(name)) {
        this.commonSizes.push(name);
        saveStoredPool('pool_sizes', this.commonSizes);
      }
      this.newSizeInput = '';
    },
    addToPoolSection() {
      const name = this.newSectionInput.trim();
      if (name && !this.commonSections.includes(name)) {
        this.commonSections.push(name);
        saveStoredPool('pool_sections', this.commonSections);
      }
      if (name && !this.selectedSections.includes(name)) {
        this.selectedSections.push(name);
      }
      this.newSectionInput = '';
    },
    removeFromPool(type: 'color' | 'size' | 'section', name: string) {
      if (type === 'color') {
        this.commonColors = this.commonColors.filter((c: string) => c !== name);
        saveStoredPool('pool_colors', this.commonColors);
      } else if (type === 'size') {
        this.commonSizes = this.commonSizes.filter((s: string) => s !== name);
        saveStoredPool('pool_sizes', this.commonSizes);
      } else {
        this.commonSections = this.commonSections.filter((s: string) => s !== name);
        saveStoredPool('pool_sections', this.commonSections);
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
      newRows.splice(dropIndex, 0, draggedItem);
      this.formData.rows = newRows;
      
      this.dragItem = null;
      this.dragOverItem = null;
    },
    handleDropCol(e: DragEvent) {
      e.preventDefault();
      // Col drop logic handled in header if needed, or kept as is if not using draggable cols in UI
      // Currently only rows are draggable in the requested template change context usually
    },
    async handleSave() {
      this.saving = true;
      try {
        const finalData = { ...JSON.parse(JSON.stringify(this.formData)), updatedAt: Date.now() };
        await saveFormToDB(finalData);
        this.$emit('save', finalData);
        this.saveSuccess = true;
        setTimeout(() => { this.saveSuccess = false; }, 2000);
      } catch (err) {
        alert("保存失败: " + (err as Error).message);
      } finally { this.saving = false; }
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
    // 打印控制方法
    resetPrintSettings() {
      this.printScale = 100;
      this.printOffsetX = 0;
      this.printOffsetY = 0;
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
    adjustPrintScale(delta: number) {
      this.printScale = Math.max(50, Math.min(150, this.printScale + delta));
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
        this.formData.totalAmount = undefined;

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

    // 新增方法：打印订单
    printOrder() {
      this.openPrintDialog();
    },
    
    // 计算属性
    get totalPieces() {
      if (!this.formData || !this.formData.data) {
        return 0;
      }
      return Object.values(this.formData.data).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
    },
    
    get colorTotals() {
      if (!this.formData) {
        return {};
      }
      const totals: Record<string, number> = {};
      this.formData.rows.forEach((row: MatrixHeader) => {
        totals[row.id] = this.formData.cols.reduce((sum: number, col: MatrixHeader) => 
          sum + (this.formData.data[`${row.id}_${col.id}`] || 0), 0);
      });
      return totals;
    },
    
    get bundleMap() {
      if (!this.formData) {
        return new Map<string, number>();
      }
      // 创建一个映射，将每个单元格坐标映射到其所属的扎号
      const map = new Map<string, number>();
      let bundleNo = 1;
      this.formData.rows.forEach((row: MatrixHeader) => {
        this.formData.cols.forEach((col: MatrixHeader) => {
          const key = `${row.id}_${col.id}`;
          map.set(key, bundleNo++);
        });
      });
      return map;
    },
    
    get isAllRowFillEnabled() {
      if (!this.formData) {
        return false;
      }
      return this.formData.rows.every((r: MatrixHeader) => this.rowSmartFill[r.id]);
    },
    
    get isAllColFillEnabled() {
      if (!this.formData) {
        return false;
      }
      return this.formData.cols.every((c: MatrixHeader) => this.colSmartFill[c.id]);
    },
    
    get printStyleVars() {
      return {
        '--paper-width': this.paperWidth + 'mm',
        '--paper-height': this.paperHeight + 'mm',
        '--print-font-size': this.printFontSize + 'px',
        '--print-line-spacing': this.printLineSpacing,
        '--print-padding': this.printPadding + 'px',
        '--print-gap': this.printGap + 'px',
      };
    },
    
    get filteredLabels() {
      if (!this.selectMode || this.selectedBundles.length === 0) {
        return this.labels;
      }
      return this.labels.filter(label => this.selectedBundles.includes(label.bundleNo));
    }
  },
  template: `
    <!-- Thermal Label Preview Interface -->
    <div v-if="isPreviewing" class="print-preview-shell fixed inset-0 bg-white z-50 overflow-auto p-6 print:bg-transparent print:p-0 print:z-0">
      <!-- Actual Thermal Label Print Output -->
      <div class="thermal-print-root hidden print:block" :style="printStyleVars">
        <div v-for="label in filteredLabels" :key="'print-'+label.id" class="print-label">
           <div class="label-content">
              <div class="label-header">青蓝服装裁剪工作室</div>
              <div class="label-row"><b>款号：</b>{{ label.styleNumber }}</div>
              <div class="label-row"><b>床号：</b>{{ label.bedNumber }}</div>
              <div class="label-row"><b>颜色：</b>{{ label.color }}</div>
              <div class="label-row"><b>尺码：</b>{{ label.size }}</div>
              <div class="label-row"><b>扎号：</b>{{ label.bundleNo }}</div>
              <div class="label-row"><b>件数：</b>{{ label.qty }}</div>
              <div v-if="label.section" class="flex mt-auto text-[12px] font-black py-0.5 justify-start">
                 {{ label.section }}
              </div>
              <div class="label-footer">
                <span>第 {{ label.currentPage }} 张</span>
                <span>共 {{ label.totalPage }} 张</span>
              </div>
           </div>
        </div>
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
          <div v-for="label in filteredLabels" :key="'preview-'+label.id" class="label-preview-card">
            <div class="label-inner">
              <div class="label-header">青蓝服装裁剪工作室</div>
              <div class="label-row"><b>款号：</b>{{ label.styleNumber }}</div>
              <div class="label-row"><b>床号：</b>{{ label.bedNumber }}</div>
              <div class="label-row"><b>颜色：</b>{{ label.color }}</div>
              <div class="label-row"><b>尺码：</b>{{ label.size }}</div>
              <div class="label-row"><b>扎号：</b>{{ label.bundleNo }}</div>
              <div class="label-row"><b>件数：</b>{{ label.qty }}</div>
              <div v-if="label.section" class="mt-auto text-[12px] font-black py-0.5">{{ label.section }}</div>
              <div class="label-footer">
                <span>第 {{ label.currentPage }} 张</span>
                <span>共 {{ label.totalPage }} 张</span>
              </div>
            </div>
          </div>
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
      <div class="bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-screen-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div class="flex items-center gap-5 min-w-0">
            <button @click="goBackToList" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition" title="返回列表">
              <icon-arrow-left :size="24" />
            </button>
            <h2 class="text-2xl font-bold text-gray-900 truncate">{{ isNewOrder ? '新建裁床单' : '编辑裁床单' }}</h2>
            <span class="px-3 py-2 rounded bg-gray-100 text-gray-400 text-sm">{{ isNewOrder ? '草稿实时保存中' : '修改后请保存' }}</span>
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
              <input v-model="formData.styleNumber" type="text" :disabled="!isNewOrder" class="w-full h-14 border-0 border-b-2 border-gray-200 bg-transparent px-0 text-3xl font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-0 outline-none disabled:text-gray-500" placeholder="款号" @focus="loadHistory('styleNumber')" @blur="hideHistory('styleNumber')" />
              <button type="button" @mousedown.prevent="toggleStyleNumberHistory" class="absolute right-0 bottom-4 text-gray-400 hover:text-gray-700" title="选择历史款号">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div v-if="showStyleNumberHistory" class="absolute left-0 right-0 z-20 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                <div v-for="item in styleNumberHistory" :key="item.value" @mousedown.prevent="selectHistoryItem('styleNumber', item.value)" class="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                  <div class="font-medium text-gray-900">{{ item.value }}</div>
                  <div class="text-xs text-gray-500">使用 {{ item.count }} 次</div>
                </div>
              </div>
            </div>

            <div class="relative">
              <label class="block text-lg text-gray-600 mb-4">客户 (CUSTOMER)</label>
              <input v-model="formData.customer" type="text" class="w-full h-14 border-0 border-b-2 border-gray-200 bg-transparent px-0 text-3xl font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-0 outline-none" placeholder="客户" @focus="loadHistory('customer')" @blur="hideHistory('customer')" />
              <button type="button" @mousedown.prevent="toggleCustomerHistory" class="absolute right-0 bottom-4 text-gray-400 hover:text-gray-700" title="选择历史客户">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <div v-if="showCustomerHistory" class="absolute left-0 right-0 z-20 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                <div v-for="item in customerHistory" :key="item.value" @mousedown.prevent="selectHistoryItem('customer', item.value)" class="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0">
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
                <p class="text-sm text-gray-500 mt-1">总金额 = 单价 x 订单数量</p>
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
                <label class="block text-sm font-bold text-gray-600 mb-2">总金额</label>
                <div class="h-12 px-4 rounded-lg border border-blue-200 bg-blue-50 flex items-center text-2xl font-bold text-blue-700">¥{{ calculatedTotalAmount.toFixed(2) }}</div>
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-2">其他费用 (元)</label>
                <input :value="formData.additionalFee ?? 0" @input="updateAmountValue('additionalFee', $event)" type="number" min="0" step="0.01" class="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-2xl font-bold text-gray-900 focus:border-blue-500 focus:ring-0 outline-none" placeholder="0.00" />
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
                <div class="flex items-center justify-between border-b border-gray-200 pb-3 mb-5">
                  <h3 class="text-xl font-bold text-gray-900">颜色池</h3>
                  <span class="text-sm text-gray-400">右键移除</span>
                </div>
                <div class="flex flex-wrap gap-3 mb-5">
                  <button v-for="color in commonColors" :key="'color-pool-' + color" @click="addRow(color)" @contextmenu.prevent="removeFromPool('color', color)" class="min-w-[62px] h-12 px-5 bg-white border border-gray-200 rounded-lg text-xl text-gray-900 hover:border-blue-300 hover:bg-blue-50 shadow-sm transition">{{ color }}</button>
                </div>
                <div class="flex gap-3">
                  <input v-model="newColorInput" @keyup.enter="addRow(newColorInput); addToPoolColor()" type="text" placeholder="添加新颜色..." class="flex-1 h-12 px-4 border border-gray-200 rounded-lg bg-white text-lg focus:border-blue-500 focus:ring-0 outline-none" />
                  <button @click="addRow(newColorInput); addToPoolColor()" class="h-12 px-6 rounded-lg bg-blue-600 text-white text-lg hover:bg-blue-700 transition">添加</button>
                </div>
              </div>

              <div class="pl-10">
                <div class="flex items-center justify-between border-b border-gray-200 pb-3 mb-5">
                  <h3 class="text-xl font-bold text-gray-900">尺码池</h3>
                  <span class="text-sm text-gray-400">右键移除</span>
                </div>
                <div class="flex flex-wrap gap-3 mb-5">
                  <button v-for="size in commonSizes" :key="'size-pool-' + size" @click="addCol(size)" @contextmenu.prevent="removeFromPool('size', size)" class="min-w-[62px] h-12 px-5 bg-white border border-gray-200 rounded-lg text-xl text-gray-900 hover:border-blue-300 hover:bg-blue-50 shadow-sm transition">{{ size }}</button>
                </div>
                <div class="flex gap-3">
                  <input v-model="newSizeInput" @keyup.enter="addCol(newSizeInput); addToPoolSize()" type="text" placeholder="添加新尺码..." class="flex-1 h-12 px-4 border border-gray-200 rounded-lg bg-white text-lg focus:border-blue-500 focus:ring-0 outline-none" />
                  <button @click="addCol(newSizeInput); addToPoolSize()" class="h-12 px-6 rounded-lg bg-blue-600 text-white text-lg hover:bg-blue-700 transition">添加</button>
                </div>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto pb-2">
            <table class="min-w-full border-collapse text-gray-900">
              <thead>
                <tr class="bg-gray-50">
                  <th class="w-40 h-24 border border-gray-300 relative align-top p-0">
                    <div class="absolute left-0 top-0 w-full h-full" style="background: linear-gradient(to top right, transparent 49.4%, #d1d5db 50%, transparent 50.6%);"></div>
                    <span class="absolute left-4 bottom-4 text-base font-bold">颜色</span>
                    <span class="absolute right-4 top-3 text-base font-bold">尺码</span>
                  </th>
                  <th v-for="(col, colIdx) in formData.cols" :key="'header-' + col.id" class="w-[112px] min-w-[112px] max-w-[112px] h-24 border border-gray-300 bg-gray-50 px-3 group relative">
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
                  <th class="w-40 h-20 border border-gray-300 bg-gray-50 px-4 relative">
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
                  <th class="w-40 h-16 border border-gray-300 bg-gray-50 text-base font-bold">
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



