
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
const DEFAULT_SECTIONS = ['袖子', '前幅', '后幅', '领子', '口袋', '里布'];

const getStoredPool = (key: string, defaults: string[]) => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [...defaults];
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
        ? JSON.parse(JSON.stringify(this.initialData)) 
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
      commonSections: getStoredPool('pool_sections', DEFAULT_SECTIONS) as string[],
      selectedSections: [] as string[],
      newColorInput: '',
      newSizeInput: '',
      newSectionInput: '',
      rowSmartFill: {} as Record<string, boolean>,
      colSmartFill: {} as Record<string, boolean>,
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
      if (this.formData.totalAmount !== undefined) {
        return this.formData.totalAmount;
      }
      if (this.formData.amountPerPiece !== undefined) {
        return this.formData.amountPerPiece * this.totalPieces;
      }
      return 0;
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
      window.print();
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

    // 新增方法：保存表单
    async saveForm() {
      this.saving = true;
      try {
        // 更新时间戳
        this.formData.updatedAt = Date.now();
        
        // 保存到数据库
        const savedForm = await saveFormToDB(this.formData);
        
        // 更新本地状态
        this.saveSuccess = true;
        this.isNewOrder = false; // 标记为已保存
        
        // 3秒后隐藏成功消息
        setTimeout(() => {
          this.saveSuccess = false;
        }, 3000);
        
        // 触发保存成功的事件
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
      this.isPreviewing = true;
      // 在打印预览模式下触发打印
      setTimeout(() => {
        window.print();
      }, 100);
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
      if (!this.formData) {
        return [];
      }
      // 如果未启用选择模式，返回所有标签
      if (!this.selectMode || this.selectedBundles.length === 0) {
        const labels = [];
        this.formData.rows.forEach((row: MatrixHeader) => {
          this.formData.cols.forEach((col: MatrixHeader) => {
            const qty = this.formData.data[`${row.id}_${col.id}`];
            if (qty) {
              labels.push({
                id: `${row.id}_${col.id}`,
                styleNumber: this.formData.styleNumber,
                bedNumber: this.formData.bedNumber,
                color: row.name,
                size: col.name,
                qty,
                bundleNo: this.bundleMap.get(`${row.id}_${col.id}`),
                totalPage: this.totalPieces,
                currentPage: labels.length + 1,
                section: this.selectedSections.length > 0 ? this.selectedSections.join(',') : undefined
              });
            }
          });
        });
        return labels;
      }

      // 如果启用了选择模式，只返回选定的扎号
      const selectedLabels = [];
      this.formData.rows.forEach((row: MatrixHeader) => {
        this.formData.cols.forEach((col: MatrixHeader) => {
          const bundleNo = this.bundleMap.get(`${row.id}_${col.id}`);
          if (bundleNo && this.selectedBundles.includes(bundleNo)) {
            const qty = this.formData.data[`${row.id}_${col.id}`];
            if (qty) {
              selectedLabels.push({
                id: `${row.id}_${col.id}`,
                styleNumber: this.formData.styleNumber,
                bedNumber: this.formData.bedNumber,
                color: row.name,
                size: col.name,
                qty,
                bundleNo,
                totalPage: this.totalPieces,
                currentPage: this.selectedBundles.indexOf(bundleNo) + 1,
                section: this.selectedSections.length > 0 ? this.selectedSections.join(',') : undefined
              });
            }
          }
        });
      });
      return selectedLabels;
    }
  },
  template: `
    <!-- Debug Info -->
    <div class="bg-yellow-100 p-4 mb-4 rounded">
      <p>FormEditor Debug Info:</p>
      <p>- isPreviewing: {{ isPreviewing }}</p>
      <p>- formData: {{ formData ? 'Exists' : 'Null' }}</p>
      <p>- isNewOrder: {{ isNewOrder }}</p>
    </div>

    <!-- Thermal Label Preview Interface -->
    <div v-if="isPreviewing" class="fixed inset-0 bg-white z-50 overflow-auto p-8 print:bg-transparent print:p-0 print:z-0">
      <!-- Actual Thermal Label Print Output -->
      <div class="hidden print:block" :style="printStyleVars">
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
    </div>

    <!-- Main Editor UI -->
    <div v-if="!isPreviewing" class="flex-1 overflow-auto p-4 md:p-8">
      <div class="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-8 min-h-[800px]">
        
        <!-- 编辑状态提示条 -->
        <div :class="isNewOrder ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'" 
             class="mb-6 p-4 rounded-lg border flex items-center gap-3">
          <svg v-if="isNewOrder" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-70">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-70">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div>
            <div class="font-semibold">{{ isNewOrder ? '新建裁床单 (草稿)' : '编辑裁床单' }}</div>
            <div class="text-sm opacity-80">{{ isNewOrder ? '此订单尚未保存至数据库' : '您正在编辑已有订单' }}</div>
          </div>
        </div>
        
        <!-- Back & Save Buttons -->
        <div class="flex justify-between items-center mb-6">
          <button 
            @click="$emit('back')" 
            class="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <icon-arrow-left :size="18" />
            返回列表
          </button>
          
          <div class="flex items-center gap-3">
            <button 
              @click="printOrder"
              class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <icon-printer :size="18" />
              打印标签
            </button>
            
            <button 
              @click="saveForm"
              :disabled="saving"
              class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <icon-save v-if="!saving" :size="18" />
              <icon-loader2 v-else :size="18" :spin="true" />
              {{ saving ? '保存中...' : (isNewOrder ? '保存订单' : '更新订单') }}
            </button>
            
            <div v-if="saveSuccess" class="text-green-600 font-medium flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              已保存
            </div>
          </div>
        </div>
        
        <!-- Status Message -->
        <div v-if="saveSuccess" class="mb-6 p-3 bg-green-50 text-green-700 rounded-lg text-center">
          {{ isNewOrder ? '订单已创建！' : '订单已更新！' }}
        </div>
        
        <!-- Form Fields -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">款号 *</label>
            <input 
              v-model="formData.styleNumber"
              type="text" 
              :disabled="!isNewOrder"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:bg-gray-100"
              placeholder="输入款号"
              @focus="loadHistory('styleNumber')"
              @blur="hideHistory('styleNumber')"
            />
            <!-- 款号历史记录下拉列表 -->
            <div v-if="showStyleNumberHistory" class="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
              <div 
                v-for="item in styleNumberHistory" 
                :key="item.value"
                @click="selectHistoryItem('styleNumber', item.value)"
                class="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div class="font-medium">{{ item.value }}</div>
                <div class="text-xs text-gray-500">{{ new Date(item.lastUsed).toLocaleString() }} · 使用 {{ item.count }} 次</div>
              </div>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">客户 *</label>
            <input 
              v-model="formData.customer"
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="输入客户"
              @focus="loadHistory('customer')"
              @blur="hideHistory('customer')"
            />
            <!-- 客户历史记录下拉列表 -->
            <div v-if="showCustomerHistory" class="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
              <div 
                v-for="item in customerHistory" 
                :key="item.value"
                @click="selectHistoryItem('customer', item.value)"
                class="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div class="font-medium">{{ item.value }}</div>
                <div class="text-xs text-gray-500">{{ new Date(item.lastUsed).toLocaleString() }} · 使用 {{ item.count }} 次</div>
              </div>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">床次</label>
            <input 
              v-model="formData.bedNumber"
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="输入床次"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">总件数</label>
            <input 
              :value="totalPieces"
              readonly
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
          </div>
        </div>
        
        <!-- Section Selection -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">选择部位</label>
          <div class="flex flex-wrap gap-2">
            <label 
              v-for="section in commonSections" 
              :key="'section-' + section"
              class="inline-flex items-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input 
                v-model="selectedSections" 
                type="checkbox" 
                :value="section"
                class="rounded text-blue-600 focus:ring-blue-500"
              />
              {{ section }}
            </label>
          </div>
        </div>
        
        <!-- Matrix Editor -->
        <div class="border border-gray-200 rounded-xl p-4 md:p-6 mb-8 bg-gray-50">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-semibold text-gray-800">裁床数据</h2>
            <div class="flex gap-2">
              <button 
                @click="showPrintSettings = true"
                class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
              >
                打印设置
              </button>
              <button 
                @click="addRow()"
                class="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <icon-plus :size="16" />
                添加行
              </button>
              <button 
                @click="addCol()"
                class="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <icon-plus :size="16" />
                添加列
              </button>
            </div>
          </div>
          
          <!-- Matrix Controls -->
          <div class="mb-6">
            <div class="flex flex-col sm:flex-row gap-4">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">添加颜色</label>
                <div class="flex">
                  <input 
                    v-model="newColorInput"
                    @keyup.enter="addToPoolColor"
                    type="text" 
                    placeholder="输入颜色名称"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                  <button 
                    @click="addRow(newColorInput); newColorInput = ''"
                    class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 border-y border-r border-gray-300 rounded-r-lg transition"
                  >
                    <icon-plus :size="18" />
                  </button>
                </div>
                
                <!-- Pool of common colors -->
                <div class="mt-2 flex flex-wrap gap-1 max-w-full overflow-auto hide-scrollbar pb-2">
                  <button
                    v-for="color in commonColors"
                    :key="'color-pool-' + color"
                    @click="addRow(color)"
                    class="px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-blue-50 transition whitespace-nowrap"
                  >
                    {{ color }}
                  </button>
                </div>
              </div>
              
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">添加尺码</label>
                <div class="flex">
                  <input 
                    v-model="newSizeInput"
                    @keyup.enter="addToPoolSize"
                    type="text" 
                    placeholder="输入尺码"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                  <button 
                    @click="addCol(newSizeInput); newSizeInput = ''"
                    class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 border-y border-r border-gray-300 rounded-r-lg transition"
                  >
                    <icon-plus :size="18" />
                  </button>
                </div>
                
                <!-- Pool of common sizes -->
                <div class="mt-2 flex flex-wrap gap-1 max-w-full overflow-auto hide-scrollbar pb-2">
                  <button
                    v-for="size in commonSizes"
                    :key="'size-pool-' + size"
                    @click="addCol(size)"
                    class="px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-blue-50 transition whitespace-nowrap"
                  >
                    {{ size }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Matrix Header -->
          <div class="overflow-x-auto">
            <div class="flex min-w-max">
              <div class="w-32 flex-shrink-0"></div>
              <div class="flex">
                <!-- Column headers with delete buttons -->
                <div 
                  v-for="(col, colIdx) in formData.cols" 
                  :key="'header-' + col.id"
                  class="w-24 flex relative group"
                >
                  <input
                    :value="col.name"
                    @input="updateColName(colIdx, $event)"
                    class="w-full px-2 py-1.5 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
                  />
                  <button 
                    @click="deleteCol(colIdx)"
                    class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
                <div class="w-24 flex-shrink-0"></div>
              </div>
            </div>
            
            <!-- Matrix Rows - 使用普通div代替draggable -->
            <div class="space-y-3">
              <div 
                v-for="(row, rowIdx) in formData.rows" 
                :key="'row-' + row.id"
                class="flex items-center group">
                <!-- Row header with drag handle and delete button -->
                <div class="w-32 flex items-center gap-2 pr-2">
                  <div class="text-center w-8">
                    <icon-grip-vertical 
                      class="text-gray-400" 
                      :size="18" 
                    />
                  </div>
                  <input
                    :value="row.name"
                    @input="updateRowName(rowIdx, $event)"
                    class="flex-1 px-2 py-1.5 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
                  />
                  <button 
                    @click="deleteRow(rowIdx)"
                    class="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 text-xs"
                  >
                    ×
                  </button>
                </div>
                
                <div class="flex">
                  <!-- Cells for this row -->
                  <div 
                    v-for="(col, colIdx) in formData.cols" 
                    :key="'cell-' + row.id + '-' + col.id"
                    class="w-24"
                  >
                    <input
                      :value="getCellValue(row.id, col.id)"
                      @input="updateCell(row.id, col.id, $event.target.value)"
                      @focus="handleInputFocus"
                      @keydown="handleCellKeyDown($event, row.id, col.id)"
                      class="w-full px-2 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
                    />
                  </div>
                  
                  <!-- Total for this row -->
                  <div class="w-24 flex items-center justify-center">
                    <span class="font-bold text-gray-800">{{ colorTotals[row.id] }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Column Totals Row -->
            <div class="flex mt-3 pt-3 border-t border-gray-300">
              <div class="w-32 flex-shrink-0">
                <div class="font-bold text-gray-800 text-center py-2">小计</div>
              </div>
              <div class="flex">
                <div 
                  v-for="(col, colIdx) in formData.cols" 
                  :key="'total-' + col.id"
                  class="w-24"
                >
                  <div class="w-full px-2 py-2 text-center bg-gray-100 font-bold text-gray-800 rounded-lg">
                    {{ getColTotal(col.id) }}
                  </div>
                </div>
                <div class="w-24 flex items-center justify-center">
                  <span class="font-bold text-gray-800">{{ totalPieces }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Smart Fill Controls -->
        <div class="mt-8 pt-6 border-t border-gray-200">
          <div class="flex items-center gap-4">
            <div class="flex items-center">
              <input 
                type="checkbox" 
                :checked="isAllRowFillEnabled"
                @change="toggleAllRowFill"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="ml-2 text-sm font-medium text-gray-700">整行智能填充</span>
            </div>
            
            <div class="flex items-center">
              <input 
                type="checkbox" 
                :checked="isAllColFillEnabled"
                @change="toggleAllColFill"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="ml-2 text-sm font-medium text-gray-700">整列智能填充</span>
            </div>
          </div>
          
          <div class="mt-4 text-sm text-gray-600">
            <p><strong>智能填充说明：</strong>勾选后，输入某格数值时，同行/同列后续格子将自动填充相同数值</p>
          </div>
        </div>
      </div>
    </div>
  `
});
