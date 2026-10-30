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
      <div v-if="view === 'list'" class="no-print sticky top-0 z-30 bg-white border-b border-[#E6EAF0] h-16 flex items-center">
        <div class="w-full px-6 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-[10px] bg-blue-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9V2h12v7"></path>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            </div>
            <span class="text-[19px] font-bold text-[#0F172A]">Dafei 裁床单大师</span>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-[16px] font-medium text-blue-600">订单列表</span>
            <button @click="openDataManagement" class="h-10 px-4 rounded-[9px] bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-2 text-[16px] font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              </svg>
              数据管理
            </button>
          </div>
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

