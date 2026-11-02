/**
 * 打印详情对话框：选择打印模式与要打印的部位。
 *
 * 受控组件。打印模式与部位输入框通过 v-model 与父组件双向绑定，
 * 其余操作以事件上抛，业务校验（如「部位模式下至少要选一个部位」）
 * 仍留在 FormEditor.confirmPrint 中。
 */
import { defineComponent } from 'vue';
import { IconPrinter } from './Icons.ts';

export default defineComponent({
  name: 'PrintDialog',
  components: { IconPrinter },
  props: {
    printMode: {
      type: String as () => 'direct' | 'sectional',
      required: true
    },
    selectedSections: {
      type: Array as () => string[],
      required: true
    },
    commonSections: {
      type: Array as () => string[],
      required: true
    },
    newSectionInput: {
      type: String,
      required: true
    }
  },
  emits: [
    'update:printMode',
    'update:newSectionInput',
    'close',
    'toggle-section',
    'remove-section',
    'add-section',
    'confirm'
  ],
  template: `
    <div class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-4 no-print">
      <div class="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 class="text-xl font-bold text-gray-900">打印详情</h3>
            <p class="text-sm text-gray-500 mt-1">选择打印模式和需要打印的部位</p>
          </div>
          <button @click="$emit('close')" class="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-xl leading-none">x</button>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              @click="$emit('update:printMode', 'direct')"
              :class="printMode === 'direct' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'"
              class="h-14 rounded-lg border text-lg font-bold hover:border-blue-300 transition"
            >
              默认模式
            </button>
            <button
              type="button"
              @click="$emit('update:printMode', 'sectional')"
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
                @click="$emit('toggle-section', section)"
                @contextmenu.prevent="$emit('remove-section', section)"
                :class="selectedSections.includes(section) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-900'"
                class="min-w-[74px] h-12 px-5 border rounded-lg text-lg font-bold hover:border-blue-300 shadow-sm transition"
              >
                {{ section }}
              </button>
            </div>

            <div class="flex gap-3">
              <input :value="newSectionInput" @input="$emit('update:newSectionInput', $event.target.value)" @keyup.enter="$emit('add-section')" type="text" placeholder="添加新部位..." class="flex-1 h-12 px-4 border border-gray-200 rounded-lg bg-white text-lg focus:border-blue-500 focus:ring-0 outline-none" />
              <button @click="$emit('add-section')" class="h-12 px-6 rounded-lg bg-blue-600 text-white text-lg hover:bg-blue-700 transition">添加</button>
            </div>
          </div>
        </div>

        <div class="px-6 py-5 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="$emit('close')" class="h-11 px-5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium">取消</button>
          <button @click="$emit('confirm')" class="h-11 px-6 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center gap-2">
            <icon-printer :size="18" />
            打印预览
          </button>
        </div>
      </div>
    </div>
  `
});
