
import { defineComponent } from 'vue';
import { getFormsFromDB, deleteFormFromDB } from '../services/db.ts';
import { IconPlus, IconEdit, IconFileText, IconLoader2, IconTrash2, IconSearch, IconDownload, IconClipboard } from './Icons.ts';

// 澹版槑鍏ㄥ眬 XLSX 鍙橀噺锛岄伩鍏?TS 鎶ラ敊
declare const XLSX: any;

export default defineComponent({
  name: 'FormList',
  components: {
    IconPlus, IconEdit, IconFileText, IconLoader2, IconTrash2, IconSearch, IconDownload, IconClipboard
  },
  data() {
    return {
      forms: [] as any[],
      loading: true,
      searchQuery: '',
      startDate: '',
      endDate: '',
      // 鍒嗛〉鐩稿叧
      currentPage: 1,
      pageSize: 10
    };
  },
  computed: {
    filteredForms() {
      const query = this.searchQuery.trim().toLowerCase();
      const start = this.startDate ? new Date(this.startDate).getTime() : 0;
      const end = this.endDate ? new Date(this.endDate).getTime() + 86400000 : Infinity; // 鍖呭惈缁撴潫褰撳ぉ
      
      return this.forms.filter(form => {
        const style = (form.styleNumber || '').toLowerCase();
        const customer = (form.customer || '').toLowerCase();
        const remark = (form.remark || '').toLowerCase();
        const time = form.createdAt || 0;
        
        const matchesSearch = !query || style.includes(query) || customer.includes(query) || remark.includes(query);
        const matchesTime = time >= start && time <= end;
        
        return matchesSearch && matchesTime;
      });
    },
    
    // 分页后的数据
    paginatedForms() {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.filteredForms.slice(start, end);
    },
    
    totalPages() {
      return Math.ceil(this.filteredForms.length / this.pageSize);
    },
    
    showingRange() {
      if (this.filteredForms.length === 0) return '共 0 条';
      const start = (this.currentPage - 1) * this.pageSize + 1;
      const end = Math.min(this.currentPage * this.pageSize, this.filteredForms.length);
      return `第 ${start}-${end} 条，共 ${this.filteredForms.length} 条`;
    }
  },
  mounted() {
    this.loadForms();
  },
  methods: {
    async loadForms() {
      this.loading = true;
      try {
        const data = await getFormsFromDB();
        this.forms = data;
      } catch (err) {
        console.error(err);
      } finally {
        this.loading = false;
      }
    },
    
    // 缈婚〉鏂规硶
    goToPage(page: number) {
      if (page < 1 || page > this.totalPages) return;
      this.currentPage = page;
    },
    
    prevPage() {
      this.goToPage(this.currentPage - 1);
    },
    
    nextPage() {
      this.goToPage(this.currentPage + 1);
    },
    
    async handleDelete(id: string, e: MouseEvent) {
      if (e && e.stopPropagation) e.stopPropagation();
      try {
        if (!confirm('确定要删除这个订单吗？')) return;
        await deleteFormFromDB(id);
        this.forms = this.forms.filter(f => f.id !== id);
      } catch (err) {
        console.error('Failed to delete form:', err);
        alert('删除订单失败，请重试。');
      }
    },
    
    calculateTotal(data: any) {
      return Object.values(data).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
    },
    
    // 璁＄畻璁㈠崟閲戦
    calculateOrderAmount(form: any) {
      const totalQty = this.calculateTotal(form.data);
      const amountPerPiece = Number(form.amountPerPiece);
      if (Number.isFinite(amountPerPiece)) {
        return amountPerPiece * totalQty;
      }
      if (form.totalAmount !== undefined) {
        return Number(form.totalAmount) || 0;
      }
      return 0;
    },
    
    formatDate(timestamp: number) {
      const d = new Date(timestamp);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    buildExcelFileName() {
      const search = this.searchQuery.trim().replace(/[\\/:*?"<>|]/g, '_');
      const dateRange = [this.startDate, this.endDate].filter(Boolean).join('_');
      const nameParts = ['订单记录', search, dateRange].filter(Boolean);
      const baseName = nameParts.join('_') || `订单记录_${this.formatDate(Date.now())}`;
      return baseName.toLowerCase().endsWith('.xlsx') ? baseName : `${baseName}.xlsx`;
    },

    exportToExcel() {
      if (this.filteredForms.length === 0) {
        alert('没有可导出的数据，请检查筛选条件。');
        return;
      }

      const dataRows = this.filteredForms.map((form, index) => {
        const totalQty = this.calculateTotal(form.data);
        const totalAmount = this.calculateOrderAmount(form);
        return [
          index + 1,
          this.formatDate(form.createdAt),
          form.styleNumber || '-',
          form.customer || '-',
          totalQty,
          form.amountPerPiece || "",
          form.additionalFee || 0,
          totalAmount,
          form.remark || ""
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([
        ["青蓝服装裁剪工作室"],
        ["编号", "下单日期", "款号", "客户", "订单总数", "单价金额", "附加费用", "总金额", "备注"],
        ...dataRows
      ]);

      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }
      ];

      // 璁剧疆鍒楀
      ws['!cols'] = [
        { wch: 8 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 12 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 24 }
      ];

      // 鍒涘缓宸ヤ綔绨垮苟涓嬭浇
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "订单导出");
      
      const fileName = this.buildExcelFileName();
      XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
    },

    handleCreate() {
      this.$emit('create');
    }
  },
  template: `
    <div class="min-h-screen bg-gray-50 p-4 md:p-8">
      <div class="max-w-6xl mx-auto">
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-800">青蓝服装裁剪工作室</h1>
            <p class="text-gray-500 mt-1">订单管理系统 v2.0</p>
          </div>
          <button 
            @click="handleCreate"
            class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold shadow-lg shadow-blue-600/20 transition-all transform hover:scale-105 whitespace-nowrap"
          >
            <icon-plus :size="20" />
            新建裁床单          </button>
        </div>

        <!-- Toolbar: Filters & Export -->
        <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-8 flex flex-col lg:flex-row gap-4 items-end">
          <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            <div>
              <label class="block text-xs font-bold text-gray-400 mb-1 uppercase">搜索客户/款号</label>
              <div class="relative">
                <icon-search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="18" />
                <input 
                  v-model="searchQuery"
                  type="text"
                  placeholder="输入关键字..."
                  class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-400 mb-1 uppercase">开始时间</label>
              <input 
                v-model="startDate"
                type="date"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-400 mb-1 uppercase">结束时间</label>
              <input 
                v-model="endDate"
                type="date"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>
          
          <button 
            @click="exportToExcel"
            class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-md shadow-emerald-600/10 transition-all whitespace-nowrap"
          >
            <icon-download :size="18" />
            导出 Excel
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center min-h-[40vh] text-gray-500 gap-2">
          <icon-loader2 class="animate-spin" /> 加载中...
        </div>

        <!-- Empty States -->
        <div v-else-if="forms.length === 0" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <div class="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500">
            <icon-file-text :size="40" />
          </div>
          <h2 class="text-xl font-semibold text-gray-800 mb-2">暂无数据</h2>
          <p class="text-gray-500 mb-6">点击右上角按钮创建您的第一张裁床单。</p>
        </div>
        
        <div v-else-if="filteredForms.length === 0" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <icon-search :size="32" />
          </div>
          <h2 class="text-lg font-semibold text-gray-700 mb-2">未找到符合条件的订单</h2>
          <p class="text-gray-500">请尝试调整搜索关键字或日期范围。</p>
        </div>

        <!-- Grid List -->
        <div v-else>
          <!-- Table Header -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
            <div class="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <div class="col-span-2">编号</div>
              <div class="col-span-2">款号</div>
              <div class="col-span-2">床次</div>
              <div class="col-span-2">客户</div>
              <div class="col-span-2">数量</div>
              <div class="col-span-2 text-center">金额</div>
            </div>
            
            <!-- Table Body with dividers -->
            <div class="divide-y divide-gray-100">
              <div 
                v-for="(form, index) in paginatedForms" 
                :key="form.id"
                @click="$emit('edit', form)"
                class="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50 cursor-pointer transition-colors group border-b border-gray-100 last:border-b-0"
              >
                <div class="col-span-2 flex items-center">
                  <span class="text-sm font-medium text-gray-900">{{ (this.currentPage - 1) * this.pageSize + index + 1 }}</span>
                </div>
                <div class="col-span-2 flex items-center">
                  <span class="text-sm font-medium text-gray-900 truncate" :title="form.styleNumber">{{ form.styleNumber || '-' }}</span>
                </div>
                <div class="col-span-2 flex items-center">
                  <span class="px-2 py-1 bg-gray-100 text-xs font-bold text-gray-600 rounded">{{ form.bedNumber || '0' }}</span>
                </div>
                <div class="col-span-2 flex items-center">
                  <span class="text-sm text-gray-600 truncate" :title="form.customer">{{ form.customer || '-' }}</span>
                </div>
                <div class="col-span-2 flex items-center">
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                    {{ calculateTotal(form.data) }}
                  </span>
                </div>
                <div class="col-span-2 flex items-center justify-center gap-2">
                  <span class="text-sm font-medium text-gray-900">
                    ¥{{ calculateOrderAmount(form).toFixed(2) }}
                  </span>
                  <button 
                    @click.stop="handleDelete(form.id, $event)"
                    class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    title="删除订单"
                  >
                    <icon-trash2 :size="16" />
                  </button>
                </div>
                <div v-if="form.remark" class="col-span-12 -mt-2 text-sm text-gray-500 truncate" :title="form.remark">备注：{{ form.remark }}</div>
              </div>

            </div>
          </div>
          
          <!-- Pagination -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 flex items-center justify-between">
            <div class="text-sm text-gray-600">
              {{ showingRange }}
            </div>
            
            <div class="flex items-center gap-2">
              <button
                @click="prevPage"
                :disabled="currentPage === 1"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                上一页              </button>
              
              <!-- Page Numbers -->
              <div class="flex items-center gap-1">
                <template v-for="page in totalPages" :key="page">
                  <button
                    v-if="page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2)"
                    @click="goToPage(page)"
                    :class="[
                      'w-10 h-10 text-sm font-medium rounded-lg transition-colors',
                      currentPage === page 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    ]"
                  >
                    {{ page }}
                  </button>
                  <span v-else-if="page === currentPage - 3 || page === currentPage + 3" key="ellipsis-{{page}}" class="px-2 text-gray-400">
                    ...
                  </span>
                </template>
              </div>
              
              <button
                @click="nextPage"
                :disabled="currentPage === totalPages"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                下一页              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
});










