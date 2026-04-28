import { defineComponent } from 'vue';
import FormList from './components/FormList.tsx';
import FormEditor from './components/FormEditor.tsx';
import CuttingReport from './components/CuttingReport.tsx';
import DataManager from './components/DataManager.tsx';

export default defineComponent({
  name: 'App',
  components: {
    FormList,
    FormEditor,
    CuttingReport,
    DataManager
  },
  data() {
    return {
      view: 'list', // 'list' | 'create' | 'edit' | 'report'
      selectedForm: undefined as any,
      showDataManagement: false
    };
  },
  mounted() {
    console.log("App mounted, current URL hash:", window.location.hash);
    // 初始化时根据URL路径恢复对应的视图状态
    this.updateViewFromUrl();
    
    // 监听浏览器前进/后退按钮事件
    window.addEventListener('popstate', this.handlePopState);
    
    // 监听 hashchange 事件，以便处理 hash 变化
    window.addEventListener('hashchange', this.updateViewFromUrl);
  },
  beforeDestroy() {
    // 清理事件监听器
    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('hashchange', this.updateViewFromUrl);
  },
  methods: {
    // 处理浏览器前进/后退事件
    handlePopState(event: PopStateEvent) {
      this.updateViewFromUrl();
    },
    
    // 根据URL更新视图状态
    updateViewFromUrl() {
      // 使用 try-catch 来捕获可能的错误，确保应用不会崩溃
      try {
        const path = window.location.hash.substring(1) || '/list';
        console.log("Parsing URL path:", path);
        
        if (path.startsWith('/create')) {
          this.view = 'create';
          this.selectedForm = undefined;
        } else if (path.startsWith('/edit/')) {
          const id = path.split('/')[2];
          // 在这里我们需要获取具体的表单数据，暂时只设置视图
          this.view = 'edit';
          // 注意：这里需要从数据库获取具体表单数据
        } else if (path.startsWith('/report/')) {
          const id = path.split('/')[2];
          this.view = 'report';
        } else {
          this.view = 'list';
          this.selectedForm = undefined;
        }
        console.log("Updated view to:", this.view);
      } catch (error) {
        console.error("Error parsing URL:", error);
        // 发生错误时，重置为列表视图
        this.view = 'list';
        this.selectedForm = undefined;
      }
    },
    
    // 更新URL路径
    updateUrl(view: string, formId?: string) {
      let path = '';
      switch (view) {
        case 'create':
          path = '/create';
          break;
        case 'edit':
          path = formId ? `/edit/${formId}` : '/list';
          break;
        case 'report':
          path = formId ? `/report/${formId}` : '/list';
          break;
        case 'list':
        default:
          path = '/list';
          break;
      }
      
      if (path !== '/list') {
        history.pushState({ view, formId }, '', `#${path}`);
      } else {
        history.replaceState({ view }, '', '#/list');
      }
    },
    
    handleCreate() {
      this.selectedForm = undefined;
      this.view = 'create';
      this.updateUrl('create');
    },
    handleEdit(form: any) {
      this.selectedForm = form;
      this.view = 'edit';
      this.updateUrl('edit', form.id);
    },
    handleReport(form: any) {
      this.selectedForm = form;
      this.view = 'report';
      this.updateUrl('report', form.id);
    },
    handleBack() {
      this.view = 'list';
      this.selectedForm = undefined;
      this.updateUrl('list');
    },
    // 从报表返回时，恢复到编辑视图
    handleBackToEdit() {
      if (this.selectedForm) {
        this.view = 'edit';
        this.updateUrl('edit', this.selectedForm.id);
      } else {
        this.view = 'list';
        this.updateUrl('list');
      }
    },
    // 保存后不再强行退回列表
    handleSaveSuccess(updatedForm: any) {
      this.selectedForm = updatedForm;
      // 如果是新建，保存后转为编辑模式
      if (this.view === 'create') {
        this.view = 'edit';
        this.updateUrl('edit', updatedForm.id);
      }
    },
    openDataManagement() {
      this.showDataManagement = true;
    }
  },
  template: `
    <div class="antialiased text-gray-900">
      <!-- Header with Data Management Button -->
      <div class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 class="text-xl font-bold text-gray-800">Dafei 裁床单大师</h1>
          <button 
            @click="openDataManagement"
            class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            数据管理
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <transition name="fade" mode="out-in">
        <form-list 
          v-if="view === 'list'"
          @create="handleCreate"
          @edit="handleEdit"
          @report="handleReport"
        />
        
        <form-editor 
          v-else-if="view === 'create' || view === 'edit'"
          :initial-data="selectedForm"
          @back="handleBack"
          @save="handleSaveSuccess"
          @report="handleReport"
        />

        <cutting-report
          v-else-if="view === 'report'"
          :form="selectedForm"
          @back="handleBackToEdit"
        />
      </transition>

      <!-- Data Management Dialog -->
      <data-manager 
        v-model:show="showDataManagement"
        ref="dataManager"
      />
    </div>
  `
});