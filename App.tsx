import { defineComponent } from 'vue';
import FormList from './components/FormList.tsx';
import FormEditor from './components/FormEditor.tsx';
import CuttingReport from './components/CuttingReport.tsx';
import DataManager from './components/DataManager.tsx';
import { getFormById } from './services/db.ts';

export default defineComponent({
  name: 'App',
  components: { FormList, FormEditor, CuttingReport, DataManager },
  data() {
    return {
      view: 'list',
      selectedForm: undefined as any,
      showDataManagement: false,
      listRefreshKey: 0
    };
  },
  mounted() {
    this.updateViewFromUrl();
    window.addEventListener('popstate', this.handlePopState);
    window.addEventListener('hashchange', this.handleHashChange);
  },
  beforeDestroy() {
    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('hashchange', this.handleHashChange);
  },
  methods: {
    handlePopState() { this.updateViewFromUrl(); },
    handleHashChange() { this.updateViewFromUrl(); },

    async updateViewFromUrl() {
      try {
        const path = window.location.hash.substring(1) || '/list';
        if (path.startsWith('/create')) {
          this.view = 'create';
          this.selectedForm = undefined;
          return;
        }
        if (path.startsWith('/edit/')) {
          const id = path.split('/')[2];
          const form = id ? await getFormById(id) : undefined;
          if (form) {
            this.selectedForm = form;
            this.view = 'edit';
          } else {
            this.goToList(true);
          }
          return;
        }
        if (path.startsWith('/report/')) {
          const id = path.split('/')[2];
          const form = id ? await getFormById(id) : undefined;
          if (form) {
            this.selectedForm = form;
            this.view = 'report';
          } else {
            this.goToList(true);
          }
          return;
        }
        this.goToList(false);
      } catch (error) {
        console.error('Error parsing URL:', error);
        this.goToList(true);
      }
    },

    updateUrl(view: string, formId?: string) {
      let path = '/list';
      if (view === 'create') path = '/create';
      if (view === 'edit' && formId) path = '/edit/' + formId;
      if (view === 'report' && formId) path = '/report/' + formId;
      if (window.location.hash !== '#' + path) {
        history.pushState({ view, formId }, '', '#' + path);
      }
    },

    goToList(updateHash: boolean) {
      this.view = 'list';
      this.selectedForm = undefined;
      if (updateHash && window.location.hash !== '#/list') {
        history.replaceState({ view: 'list' }, '', '#/list');
      }
      this.$nextTick(() => {
        this.listRefreshKey++;
      });
    },

    handleCreate() { this.selectedForm = undefined; this.view = 'create'; this.updateUrl('create'); },
    handleEdit(form: any) { this.selectedForm = form; this.view = 'edit'; this.updateUrl('edit', form.id); },
    handleReport(form: any) { this.selectedForm = form; this.view = 'report'; this.updateUrl('report', form.id); },
    handleBack() {
      this.goToList(true);
    },

    handleBackToEdit() {
      if (this.selectedForm) {
        this.view = 'edit';
        this.updateUrl('edit', this.selectedForm.id);
      } else {
        this.goToList(true);
      }
    },

    handleSaveSuccess(updatedForm: any) {
      this.selectedForm = updatedForm;
      if (this.view === 'create') {
        this.view = 'edit';
        this.updateUrl('edit', updatedForm.id);
      }
    },

    openDataManagement() { this.showDataManagement = true; }
  },
  template: `
    <div class="antialiased text-gray-900">
      <div class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 class="text-xl font-bold text-gray-800">Dafei 裁床单大师</h1>
          <button @click="openDataManagement" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            数据管理
          </button>
        </div>
      </div>

      <transition name="fade" mode="out-in">
        <form-list v-if="view === 'list'" :key="'list-' + listRefreshKey" @create="handleCreate" @edit="handleEdit" @report="handleReport" />
        <form-editor v-else-if="view === 'create' || view === 'edit'" :initial-data="selectedForm" @back="handleBack" @save="handleSaveSuccess" @report="handleReport" />
        <cutting-report v-else-if="view === 'report'" :form="selectedForm" @back="handleBackToEdit" />
      </transition>

      <data-manager v-model:show="showDataManagement" ref="dataManager" />
    </div>
  `
});
