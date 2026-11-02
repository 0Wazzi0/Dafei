/**
 * 打印预览层（全屏）。
 *
 * 包含三部分：
 * 1. .thermal-print-root —— 真正送去打印机的输出，屏幕上隐藏（hidden print:block）；
 * 2. 扎号选择面板 —— 按扎筛选要打印的标签；
 * 3. .label-preview-container —— 屏幕预览。
 *
 * 组件为受控形态：所有状态由 FormEditor 持有，这里只负责渲染与转发事件。
 * 这样预览层的开关、扎号勾选、纸张参数仍然只有一处真相。
 *
 * 注意：.print-preview-shell 与 .thermal-print-root 在 index.html 的
 * @media print 中有专门样式，必须保持在相同的 DOM 层级上。
 */
import { defineComponent } from 'vue';
import type { LabelData } from '../domain/labels.ts';
import LabelCard from './LabelCard.tsx';
import { IconPrinter } from './Icons.ts';

export default defineComponent({
  name: 'PrintPreview',
  components: { LabelCard, IconPrinter },
  props: {
    /** 已按扎号筛选过的标签 */
    labels: {
      type: Array as () => LabelData[],
      required: true
    },
    /** 全量标签，用于扎号选择面板 */
    allLabels: {
      type: Array as () => LabelData[],
      required: true
    },
    selectMode: {
      type: Boolean,
      required: true
    },
    selectedBundles: {
      type: Array as () => number[],
      required: true
    },
    /** 打印样式 CSS 变量，见 FormEditor.printStyleVars */
    styleVars: {
      type: Object as () => Record<string, string>,
      required: true
    }
  },
  emits: ['exit', 'print', 'toggle-select-mode', 'select-all', 'clear-selection', 'reset-style', 'toggle-bundle'],
  template: `
    <div class="print-preview-shell fixed inset-0 bg-white z-50 overflow-auto p-6 print:bg-transparent print:p-0 print:z-0">
      <!-- Actual Thermal Label Print Output -->
      <div class="thermal-print-root hidden print:block" :style="styleVars">
        <label-card v-for="label in labels" :key="'print-'+label.id" :label="label" />
      </div>

      <div class="no-print max-w-6xl mx-auto">
        <div class="flex items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-5">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">打印预览</h2>
            <p class="text-gray-500 mt-1">{{ selectMode ? '已选择 ' + selectedBundles.length + ' 扎' : '当前打印全部扎号' }}，共 {{ labels.length }} 张标签</p>
          </div>
          <div class="flex items-center gap-3">
            <button @click="$emit('exit')" class="h-11 px-5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">返回编辑</button>
            <button @click="$emit('print')" class="h-11 px-5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center gap-2">
              <icon-printer :size="18" />
              开始打印
            </button>
          </div>
        </div>

        <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <button @click="$emit('toggle-select-mode')" :class="selectMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'" class="h-10 px-4 rounded-lg font-medium transition">
              {{ selectMode ? '按扎选择：开' : '按扎选择：关' }}
            </button>
            <button v-if="selectMode" @click="$emit('select-all')" class="h-10 px-4 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">全选</button>
            <button v-if="selectMode" @click="$emit('clear-selection')" class="h-10 px-4 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">清空</button>
            <button @click="$emit('reset-style')" class="h-10 px-4 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">默认纸张</button>
          </div>

          <div v-if="selectMode" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <button
              v-for="label in allLabels"
              :key="'bundle-pick-' + label.id"
              @click="$emit('toggle-bundle', label.bundleNo)"
              :class="selectedBundles.includes(label.bundleNo) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'"
              class="border rounded-lg p-3 text-left hover:border-blue-300 transition"
            >
              <div class="font-bold">扎 {{ label.bundleNo }}</div>
              <div class="text-sm mt-1">{{ label.color }} / {{ label.size }}</div>
              <div class="text-xs text-gray-500 mt-1">{{ label.qty }} 件</div>
            </button>
          </div>
        </div>

        <div v-if="labels.length === 0" class="text-center py-20 text-gray-500 bg-gray-50 border border-gray-200 rounded-xl">
          没有可打印的标签，请选择扎号或返回编辑检查数量。
        </div>
        <div v-else class="label-preview-container" :style="styleVars">
          <label-card v-for="label in labels" :key="'preview-'+label.id" :label="label" />
        </div>
      </div>
    </div>
  `
});
