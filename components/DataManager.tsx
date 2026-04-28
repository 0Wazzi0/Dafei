import { defineComponent } from 'vue';
import { exportAllData, importData, clearAllData, getFormsFromDB } from '../services/db.ts';
import { IconDownload, IconUpload, IconTrash2, IconX, IconCheck, IconDatabase } from './Icons.ts';

export default defineComponent({
  name: 'DataManager',
  components: {
    IconDownload, IconUpload, IconTrash2, IconX, IconCheck, IconDatabase
  },
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:show'],
  data() {
    return {
      exporting: false,
      importing: false,
      clearing: false,
      importFile: null as File | null,
      message: '' as { type: 'success' | 'error' | 'info', text: string } | null,
      stats: {
        totalForms: 0,
        lastExport: '',
        lastImport: ''
      }
    };
  },
  async mounted() {
    await this.loadStats();
  },
  methods: {
    async loadStats() {
      try {
        const forms = await getFormsFromDB();
        this.stats.totalForms = forms.length;
        
        // 读取本地存储的最后操作时间
        const lastExport = localStorage.getItem('lastExport') || '未导出';
        const lastImport = localStorage.getItem('lastImport') || '未导入';
        this.stats.lastExport = lastExport;
        this.stats.lastImport = lastImport;
      } catch (err) {
        console.error('加载统计失败:', err);
      }
    },

    openDialog() {
      this.show = true;
      this.loadStats();
    },

    closeDialog() {
      this.$emit('update:show', false);
      this.message = null;
      this.importFile = null;
    },

    showMessage(type: 'success' | 'error' | 'info', text: string) {
      this.message = { type, text };
      setTimeout(() => {
        this.message = null;
      }, 5000);
    },

    async handleExport() {
      this.exporting = true;
      try {
        const jsonData = await exportAllData();
        
        // 创建下载
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        a.download = `dafei_data_backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // 保存导出时间
        localStorage.setItem('lastExport', new Date().toLocaleString('zh-CN'));
        
        this.showMessage('success', '数据导出成功！');
        await this.loadStats();
      } catch (err: any) {
        this.showMessage('error', '导出失败：' + err.message);
      } finally {
        this.exporting = false;
      }
    },

    handleFileSelect(event: Event) {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        this.importFile = target.files[0];
      }
    },

    async handleImport() {
      if (!this.importFile) {
        this.showMessage('error', '请选择要导入的文件');
        return;
      }

      this.importing = true;
      try {
        const text = await this.importFile.text();
        const result = await importData(text);
        
        if (result.success) {
          // 保存导入时间
          localStorage.setItem('lastImport', new Date().toLocaleString('zh-CN'));
          
          this.showMessage('success', `成功导入 ${result.count} 条数据`);
          await this.loadStats();
          this.importFile = null;
          (document.getElementById('importFile') as HTMLInputElement).value = '';
        } else {
          this.showMessage('error', result.error || '导入失败');
        }
      } catch (err: any) {
        this.showMessage('error', '导入失败：' + err.message);
      } finally {
        this.importing = false;
      }
    },

    async handleClear() {
      if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) {
        return;
      }

      this.clearing = true;
      try {
        await clearAllData();
        this.showMessage('success', '所有数据已清空');
        await this.loadStats();
      } catch (err: any) {
        this.showMessage('error', '清空失败：' + err.message);
      } finally {
        this.clearing = false;
      }
    }
  },
  template: `
    <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b">
          <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <icon-database :size="28" class="text-blue-600" />
            数据管理
          </h2>
          <button @click="closeDialog" class="text-gray-400 hover:text-gray-600">
            <icon-x :size="24" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          <!-- Message -->
          <div v-if="message" 
               :class="[
                 'p-4 rounded-lg flex items-center gap-3',
                 message.type === 'success' ? 'bg-green-50 text-green-700' : '',
                 message.type === 'error' ? 'bg-red-50 text-red-700' : '',
                 message.type === 'info' ? 'bg-blue-50 text-blue-700' : ''
               ]">
            <icon-check v-if="message.type === 'success'" :size="20" />
            <span>{{ message.text }}</span>
          </div>

          <!-- Stats -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="font-semibold text-gray-700 mb-3">当前数据统计</h3>
            <div class="grid grid-cols-3 gap-4">
              <div class="text-center">
                <div class="text-2xl font-bold text-blue-600">{{ stats.totalForms }}</div>
                <div class="text-sm text-gray-600 mt-1">订单数量</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-medium text-gray-700">{{ stats.lastExport }}</div>
                <div class="text-sm text-gray-600 mt-1">最后导出</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-medium text-gray-700">{{ stats.lastImport }}</div>
                <div class="text-sm text-gray-600 mt-1">最后导入</div>
              </div>
            </div>
          </div>

          <!-- Export Section -->
          <div class="border rounded-lg p-4">
            <h3 class="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <icon-download :size="20" />
              导出数据
            </h3>
            <p class="text-sm text-gray-600 mb-4">
              将所有订单数据导出为 JSON 文件，用于版本升级备份或数据迁移。
            </p>
            <button 
              @click="handleExport" 
              :disabled="exporting"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              <icon-download :size="20" />
              {{ exporting ? '导出中...' : '导出数据' }}
            </button>
          </div>

          <!-- Import Section -->
          <div class="border rounded-lg p-4">
            <h3 class="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <icon-upload :size="20" />
              导入数据
            </h3>
            <p class="text-sm text-gray-600 mb-4">
              从备份文件恢复数据。导入的数据将合并到现有数据中。
            </p>
            <div class="space-y-3">
              <input 
                type="file" 
                id="importFile"
                @change="handleFileSelect"
                accept=".json"
                class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
              <button 
                @click="handleImport" 
                :disabled="importing || !importFile"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                <icon-upload :size="20" />
                {{ importing ? '导入中...' : '导入数据' }}
              </button>
            </div>
          </div>

          <!-- Clear Section -->
          <div class="border border-red-200 rounded-lg p-4 bg-red-50">
            <h3 class="font-semibold text-red-700 mb-2 flex items-center gap-2">
              <icon-trash2 :size="20" />
              清空数据
            </h3>
            <p class="text-sm text-red-600 mb-4">
              ⚠️ 警告：此操作将永久删除所有订单数据，且无法恢复！
            </p>
            <button 
              @click="handleClear" 
              :disabled="clearing"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              <icon-trash2 :size="20" />
              {{ clearing ? '清空中...' : '确认清空所有数据' }}
            </button>
          </div>

          <!-- Help Section -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="font-semibold text-blue-800 mb-2">💡 版本升级数据迁移指南</h3>
            <ol class="text-sm text-blue-700 space-y-2 list-decimal list-inside">
              <li><strong>升级前</strong>：点击"导出数据"备份当前所有数据</li>
              <li><strong>升级时</strong>：安装新版本应用</li>
              <li><strong>升级后</strong>：打开新版本，点击"导入数据"选择备份文件</li>
              <li><strong>完成</strong>：数据已恢复，可继续使用</li>
            </ol>
            <p class="text-xs text-blue-600 mt-3">
              💾 建议定期导出备份，防止数据丢失
            </p>
          </div>
        </div>
      </div>
    </div>
  `
});