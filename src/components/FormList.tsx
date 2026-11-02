import { defineComponent } from 'vue';
import * as XLSX from 'xlsx';
import { getFormsFromDB, deleteFormFromDB } from '../services/db.ts';
import { orderAmount, sumPieces } from '../domain/money.ts';
import { IconPlus, IconEdit, IconFileText, IconLoader2, IconTrash2, IconSearch, IconDownload, IconClipboard } from './Icons.ts';

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
      deleteConfirmId: '',
      deleteConfirmLabel: '',
      deleteError: '',
      deleting: false,
      // 分页相关
      currentPage: 1,
      pageSize: 10,
      // 表格列宽：表头与数据行共用同一条模板，保证逐列对齐
      tableGrid: '56px 158px 84px minmax(0, 1.3fr) 84px 140px 118px minmax(0, 1fr) 48px'
    };
  },
  computed: {
    filteredForms() {
      const query = this.searchQuery.trim().toLowerCase();
      const start = this.startDate ? new Date(this.startDate).getTime() : 0;
      const end = this.endDate ? new Date(this.endDate).getTime() + 86400000 : Infinity; // 包含结束当天

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
      return `第 ${start}–${end} 条，共 ${this.filteredForms.length} 条`;
    },

    isFiltered() {
      return this.filteredForms.length !== this.forms.length;
    },

    // 统计条：均基于当前筛选结果，避免"筛选后数字还是全量"的误导
    statOrderCount() {
      return this.filteredForms.length;
    },

    statTotalPieces() {
      return this.filteredForms.reduce((sum, form) => sum + this.calculateTotal(form.data || {}), 0);
    },

    statTotalAmount() {
      return this.filteredForms.reduce((sum, form) => sum + this.calculateOrderAmount(form), 0);
    },

    statMonthCount() {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      return this.filteredForms.filter(form => {
        const d = new Date(form.createdAt || 0);
        return d.getFullYear() === year && d.getMonth() === month;
      }).length;
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

    // 翻页方法
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

    handleDelete(id: string, e: MouseEvent) {
      if (e && e.stopPropagation) e.stopPropagation();
      const form = this.forms.find(f => f.id === id);
      this.deleteConfirmId = id;
      this.deleteConfirmLabel = form ? [form.styleNumber, form.customer].filter(Boolean).join(' / ') : '';
      this.deleteError = '';
    },

    cancelDelete() {
      if (this.deleting) return;
      this.deleteConfirmId = '';
      this.deleteConfirmLabel = '';
      this.deleteError = '';
    },

    async confirmDelete() {
      if (!this.deleteConfirmId || this.deleting) return;
      this.deleting = true;
      this.deleteError = '';
      try {
        const id = this.deleteConfirmId;
        await deleteFormFromDB(id);
        this.forms = this.forms.filter(f => f.id !== id);
        const totalPages = Math.max(1, Math.ceil(this.filteredForms.length / this.pageSize));
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        this.deleteConfirmId = '';
        this.deleteConfirmLabel = '';
      } catch (err) {
        console.error('Failed to delete form:', err);
        this.deleteError = '删除订单失败，请重试。';
      } finally {
        this.deleting = false;
      }
    },

    calculateTotal(data: any) {
      return sumPieces(data);
    },

    // 计算订单金额：唯一实现见 domain/money.ts
    calculateOrderAmount(form: any) {
      return orderAmount(form, this.calculateTotal(form.data));
    },

    // 千分位，避免四位数以上要数零
    formatNumber(value: number) {
      return (Number(value) || 0).toLocaleString('zh-CN');
    },

    formatAmount(value: number) {
      return '¥' + (Number(value) || 0).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    },

    formatDate(timestamp: number) {
      const d = new Date(timestamp);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
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

      // 设置列宽
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

      // 创建工作簿并下载
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
    <div class="min-h-[calc(100vh-64px)] bg-[#F4F6F9]">
      <div class="flex flex-col gap-4 px-6 py-6">

        <!-- 页头 -->
        <div class="shrink-0 flex items-center justify-between gap-6">
          <div class="min-w-0">
            <h1 class="text-[32px] leading-[1.15] font-bold text-[#0F172A]">青蓝服装裁剪工作室</h1>
            <p class="text-[15px] text-[#64748B] mt-1.5">
              共 {{ forms.length }} 张裁床单
              <span v-if="isFiltered" class="text-blue-600">· 已筛选出 {{ filteredForms.length }} 张</span>
              <span v-else>· 订单管理系统 v2.0</span>
            </p>
          </div>
          <button
            @click="handleCreate"
            class="shrink-0 h-14 px-7 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[19px] font-bold
                   flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-colors"
          >
            <icon-plus :size="22" />
            新建裁床单
          </button>
        </div>

        <!-- 统计条 -->
        <div class="shrink-0 bg-white rounded-xl border border-[#E6EAF0] px-8 py-4 grid grid-cols-4 gap-6">
          <div>
            <div class="text-[28px] leading-tight font-bold text-[#0F172A]">{{ formatNumber(statOrderCount) }}</div>
            <div class="text-[14px] text-[#64748B] mt-0.5">订单总数</div>
          </div>
          <div>
            <div class="text-[28px] leading-tight font-bold text-[#0F172A]">{{ formatNumber(statTotalPieces) }}</div>
            <div class="text-[14px] text-[#64748B] mt-0.5">总件数</div>
          </div>
          <div>
            <div class="text-[28px] leading-tight font-bold text-blue-700">{{ formatAmount(statTotalAmount) }}</div>
            <div class="text-[14px] text-[#64748B] mt-0.5">总金额</div>
          </div>
          <div>
            <div class="text-[28px] leading-tight font-bold text-[#0F172A]">{{ formatNumber(statMonthCount) }}</div>
            <div class="text-[14px] text-[#64748B] mt-0.5">本月新增</div>
          </div>
        </div>

        <!-- 筛选栏 -->
        <div class="shrink-0 bg-white rounded-xl border border-[#E6EAF0] p-3.5 flex items-center gap-3">
          <div class="relative flex-1 min-w-0">
            <icon-search class="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" :size="20" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索 客户 / 款号 / 备注"
              class="w-full h-12 pl-12 pr-4 rounded-[10px] bg-[#F1F5F9] border border-transparent
                     text-[17px] text-[#0F172A] placeholder-[#94A3B8]
                     focus:bg-white focus:border-blue-500 outline-none transition-colors"
            />
          </div>
          <label
            class="shrink-0 flex items-center gap-1.5 h-12 pl-3.5 pr-2.5 rounded-[10px] bg-[#F1F5F9]
                   border border-transparent transition-colors
                   focus-within:bg-white focus-within:border-blue-500"
          >
            <span class="text-[15px] text-[#94A3B8] shrink-0">从</span>
            <input
              v-model="startDate"
              type="date"
              class="w-[122px] bg-transparent text-[16px] text-[#334155] outline-none"
            />
          </label>
          <label
            class="shrink-0 flex items-center gap-1.5 h-12 pl-3.5 pr-2.5 rounded-[10px] bg-[#F1F5F9]
                   border border-transparent transition-colors
                   focus-within:bg-white focus-within:border-blue-500"
          >
            <span class="text-[15px] text-[#94A3B8] shrink-0">到</span>
            <input
              v-model="endDate"
              type="date"
              class="w-[122px] bg-transparent text-[16px] text-[#334155] outline-none"
            />
          </label>
          <button
            @click="exportToExcel"
            class="shrink-0 h-12 px-6 rounded-[10px] bg-emerald-600 hover:bg-emerald-700 text-white
                   text-[17px] font-bold flex items-center gap-2 transition-colors"
          >
            <icon-download :size="19" />
            导出 Excel
          </button>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="min-h-[420px] bg-white rounded-xl border border-[#E6EAF0] flex items-center justify-center gap-3 text-[#64748B] text-[17px]">
          <icon-loader2 class="animate-spin" :size="22" /> 加载中...
        </div>

        <!-- 完全没有数据 -->
        <div v-else-if="forms.length === 0" class="min-h-[420px] bg-white rounded-xl border border-[#E6EAF0] flex flex-col items-center justify-center text-center px-6">
          <div class="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-6">
            <icon-file-text :size="40" />
          </div>
          <h2 class="text-[22px] font-bold text-[#0F172A] mb-2">暂无数据</h2>
          <p class="text-[17px] text-[#64748B]">点击右上角「新建裁床单」创建第一张单子。</p>
        </div>

        <!-- 筛选后无结果 -->
        <div v-else-if="filteredForms.length === 0" class="min-h-[420px] bg-white rounded-xl border border-[#E6EAF0] flex flex-col items-center justify-center text-center px-6">
          <div class="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center text-[#94A3B8] mb-5">
            <icon-search :size="32" />
          </div>
          <h2 class="text-[20px] font-bold text-[#0F172A] mb-2">未找到符合条件的订单</h2>
          <p class="text-[16px] text-[#64748B]">请调整搜索关键字或日期范围。</p>
        </div>

        <!-- 表格 -->
        <div v-else class="bg-white rounded-xl border border-[#E6EAF0]">
          <div>
            <div class="min-w-[1000px]">

              <!-- 表头（跟随页面滚动吸顶，贴在顶栏下方） -->
              <div
                class="sticky top-16 z-20 grid gap-4 items-center h-[52px] px-7 bg-[#F8FAFC] border-b border-[#EEF2F6] rounded-t-xl"
                :style="{ gridTemplateColumns: tableGrid }"
              >
                <div class="text-[14px] font-bold text-[#94A3B8]">序号</div>
                <div class="text-[14px] font-bold text-[#94A3B8]">款号</div>
                <div class="text-[14px] font-bold text-[#94A3B8]">床次</div>
                <div class="text-[14px] font-bold text-[#94A3B8]">客户</div>
                <div class="text-[14px] font-bold text-[#94A3B8]">数量</div>
                <div class="text-[14px] font-bold text-[#94A3B8] text-right pr-3">金额</div>
                <div class="text-[14px] font-bold text-[#94A3B8]">下单日期</div>
                <div class="text-[14px] font-bold text-[#94A3B8]">备注</div>
                <div></div>
              </div>

              <!-- 数据行 -->
              <div
                v-for="(form, index) in paginatedForms"
                :key="form.id"
                @click="$emit('edit', form)"
                class="group grid gap-4 items-center min-h-[72px] px-7 py-3 cursor-pointer
                       border-b border-[#F1F5F9] last:border-b-0 last:rounded-b-xl transition-colors
                       odd:bg-white even:bg-[#FAFBFC] hover:bg-blue-50"
                :style="{ gridTemplateColumns: tableGrid }"
              >
                <div class="text-[16px] text-[#94A3B8]">{{ (currentPage - 1) * pageSize + index + 1 }}</div>

                <div class="text-[19px] font-semibold text-[#0F172A] truncate" :title="form.styleNumber">
                  {{ form.styleNumber || '-' }}
                </div>

                <div class="text-[19px] font-semibold text-blue-600 truncate" :title="String(form.bedNumber)">
                  {{ form.bedNumber || '0' }}
                </div>

                <div class="text-[18px] text-[#334155] truncate" :title="form.customer">
                  {{ form.customer || '-' }}
                </div>

                <div class="text-[18px] font-medium text-[#334155]">{{ formatNumber(calculateTotal(form.data)) }}</div>

                <div class="text-[19px] font-bold text-[#0F172A] text-right pr-3 whitespace-nowrap">
                  {{ formatAmount(calculateOrderAmount(form)) }}
                </div>

                <div class="text-[16px] text-[#94A3B8] whitespace-nowrap">{{ formatDate(form.createdAt) }}</div>

                <div class="text-[16px] truncate" :class="form.remark ? 'text-[#64748B]' : 'text-[#CBD5E1]'" :title="form.remark">
                  {{ form.remark || '—' }}
                </div>

                <div class="flex justify-end">
                  <button
                    @click.stop="handleDelete(form.id, $event)"
                    class="w-9 h-9 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50
                           flex items-center justify-center transition-all
                           opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="删除订单"
                  >
                    <icon-trash2 :size="17" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="!loading && filteredForms.length > 0" class="shrink-0 h-[64px] bg-white rounded-xl border border-[#E6EAF0] px-7 flex items-center justify-between gap-4">
          <div class="text-[16px] text-[#64748B] whitespace-nowrap">{{ showingRange }}</div>

          <div class="flex items-center gap-2">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="h-11 px-4 rounded-[9px] text-[16px] font-medium transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed
                     bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] disabled:hover:bg-[#F1F5F9]"
            >
              上一页
            </button>

            <div class="flex items-center gap-2">
              <template v-for="page in totalPages" :key="page">
                <button
                  v-if="page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2)"
                  @click="goToPage(page)"
                  :class="[
                    'w-11 h-11 rounded-[9px] text-[17px] font-medium transition-colors',
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'
                  ]"
                >
                  {{ page }}
                </button>
                <span v-else-if="page === currentPage - 3 || page === currentPage + 3" :key="'e' + page" class="px-1 text-[#94A3B8]">…</span>
              </template>
            </div>

            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="h-11 px-4 rounded-[9px] text-[16px] font-medium transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed
                     bg-white border border-[#E2E8F0] text-blue-700 hover:bg-[#F1F5F9] disabled:hover:bg-white"
            >
              下一页
            </button>
          </div>
        </div>

      </div>

      <div v-if="deleteConfirmId" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
        <div class="w-full max-w-sm bg-white rounded-xl shadow-xl border border-[#E2E8F0] overflow-hidden">
          <div class="px-6 py-5 border-b border-[#E2E8F0]">
            <h3 class="text-[19px] font-bold text-[#0F172A]">确认删除订单</h3>
            <p class="text-[16px] text-[#64748B] mt-2">{{ deleteConfirmLabel || '这个订单' }}</p>
            <p v-if="deleteError" class="text-[15px] text-red-600 mt-3">{{ deleteError }}</p>
          </div>
          <div class="px-6 py-4 bg-[#F8FAFC] flex justify-end gap-3">
            <button @click="cancelDelete" :disabled="deleting" class="h-11 px-5 rounded-lg bg-white border border-[#E2E8F0] text-[16px] text-[#334155] hover:bg-[#F1F5F9] disabled:opacity-60">取消</button>
            <button @click="confirmDelete" :disabled="deleting" class="h-11 px-5 rounded-lg bg-red-600 text-white text-[16px] hover:bg-red-700 disabled:opacity-60">{{ deleting ? '删除中...' : '确认删除' }}</button>
          </div>
        </div>
      </div>
    </div>
  `
});
