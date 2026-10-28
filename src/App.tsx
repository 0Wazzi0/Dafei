import { defineComponent } from 'vue';
import FormList from './components/FormList.tsx';
import FormEditor from './components/FormEditor.tsx';
import CuttingReport from './components/CuttingReport.tsx';
import DataManager from './components/DataManager.tsx';
import { getFormById } from './services/db.ts';

type AppView = 'list' | 'create' | 'edit' | 'report';

export default defineComponent({
  name: 'App',
  components: { FormList, FormEditor, CuttingReport, DataManager },
  data() {
    return {
      view: 'list' as AppView,
      selectedForm: undefined as any,
      showDataManagement: false,
      listRefreshKey: 0,
      navigationSeq: 0
    };
  },
  mounted() {
    this.restoreFromHash();
    window.addEventListener('popstate', this.handlePopState);
  },
  beforeDestroy() {
    window.removeEventListener('popstate', this.handlePopState);
  },
  methods: {
    handlePopState() {
      this.restoreFromHash();
    },

    setHash(path: string, replace = false) {
      const hash = '#' + path;
      if (window.location.hash === hash) return;
      const state = { path };
      if (replace) {
        history.replaceState(state, '', hash);
      } else {
        history.pushState(state, '', hash);
      }
    },

    showList(replaceHash = true) {
      this.navigationSeq++;
      this.selectedForm = undefined;
      this.view = 'list';
      this.listRefreshKey++;
      if (replaceHash) this.setHash('/list', true);
    },

    showCreate() {
      this.navigationSeq++;
      this.selectedForm = undefined;
      this.view = 'create';
      this.setHash('/create');
    },

    showEdit(form: any, pushHash = true) {
      this.navigationSeq++;
      this.selectedForm = form;
      this.view = 'edit';
      if (pushHash && form && form.id) this.setHash('/edit/' + form.id);
    },

    showReport(form: any, pushHash = true) {
      this.navigationSeq++;
      this.selectedForm = form;
      this.view = 'report';
      if (pushHash && form && form.id) this.setHash('/report/' + form.id);
    },

    async restoreFromHash() {
      const seq = ++this.navigationSeq;
      const path = window.location.hash.substring(1) || '/list';

      if (path === '/list' || path === '/') {
        this.selectedForm = undefined;
        this.view = 'list';
        this.listRefreshKey++;
        return;
      }

      if (path === '/create') {
        this.selectedForm = undefined;
        this.view = 'create';
        return;
      }

      if (path.startsWith('/edit/') || path.startsWith('/report/')) {
        const id = path.split('/')[2];
        const targetView = path.startsWith('/edit/') ? 'edit' : 'report';
        const form = id ? await getFormById(id) : undefined;
        if (seq !== this.navigationSeq) return;
        if (!form) {
          this.showList(true);
          return;
        }
        this.selectedForm = form;
        this.view = targetView as AppView;
        return;
      }

      this.showList(true);
    },

    handleCreate() { this.showCreate(); },
    handleEdit(form: any) { this.showEdit(form); },
    handleReport(form: any) { this.showReport(form); },
    handleBack() { this.showList(true); },

    handleBackToEdit() {
      if (this.selectedForm) {
        this.showEdit(this.selectedForm);
      } else {
        this.showList(true);
      }
    },

    handleSaveSuccess(updatedForm: any) {
      this.selectedForm = updatedForm;
      if (this.view === 'create') {
        this.showEdit(updatedForm, true);
      }
    },

    handleSaveAsNewSuccess(newForm: any) {
      this.showEdit(newForm, true);
    },

    openDataManagement() { this.showDataManagement = true; }
  },
  template: `
    <div class="antialiased text-gray-900">
      <div v-if="view === 'list'" class="no-print bg-white shadow-sm border-b">
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

      <form-list
        v-if="view === 'list'"
        :key="'list-' + listRefreshKey"
        @create="handleCreate"
        @edit="handleEdit"
        @report="handleReport"
      />

      <form-editor
        v-else-if="view === 'create' || view === 'edit'"
        :key="view + '-' + (selectedForm ? selectedForm.id : 'new')"
        :initial-data="selectedForm"
        @back="handleBack"
        @save="handleSaveSuccess"
        @save-as-new="handleSaveAsNewSuccess"
        @report="handleReport"
      />

      <cutting-report
        v-else-if="view === 'report'"
        :key="'report-' + (selectedForm ? selectedForm.id : 'none')"
        :form="selectedForm"
        @back="handleBackToEdit"
      />

      <data-manager v-model:show="showDataManagement" ref="dataManager" />
    </div>
  `
});

