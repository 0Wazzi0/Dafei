/**
 * 颜色池 / 尺码池的一栏。
 *
 * 两栏结构完全对称（标题 + 数量 + 按钮区 + 输入区），只有数据源与动作不同，
 * 因此复用同一个组件，由 FormEditor 渲染两次。
 *
 * 根元素直接承载 pr-10 / pl-10，与拆分前的 DOM 层级一致（没有多包一层）。
 *
 * 受控组件：折叠状态、输入框内容都由父组件持有。
 */
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'PoolColumn',
  props: {
    /** 决定根元素用 pr-10 还是 pl-10 */
    side: {
      type: String as () => 'left' | 'right',
      required: true
    },
    title: {
      type: String,
      required: true
    },
    /** 匹配到的总数，显示在标题后 */
    count: {
      type: Number,
      required: true
    },
    /** 实际展示的条目 */
    items: {
      type: Array as () => string[],
      required: true
    },
    hiddenCount: {
      type: Number,
      required: true
    },
    expanded: {
      type: Boolean,
      required: true
    },
    collapsedLimit: {
      type: Number,
      required: true
    },
    input: {
      type: String,
      required: true
    },
    hint: {
      type: String,
      required: true
    },
    placeholder: {
      type: String,
      required: true
    },
    emptyHint: {
      type: String,
      required: true
    }
  },
  emits: ['pick', 'remove', 'expand', 'collapse', 'update:input', 'submit', 'clear'],
  computed: {
    wrapperClass(): string {
      return this.side === 'left' ? 'pr-10' : 'pl-10';
    }
  },
  template: `
    <div :class="wrapperClass">
      <div class="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
        <h3 class="text-xl font-bold text-gray-900">
          {{ title }}
          <span class="ml-2 text-sm font-normal text-gray-400">{{ count }} 个</span>
        </h3>
        <span class="text-sm text-gray-400">右键移除</span>
      </div>
      <div class="flex flex-wrap items-center gap-3 mb-4 min-h-[108px] content-start">
        <button v-for="item in items" :key="'pool-' + item" @click="$emit('pick', item)" @contextmenu.prevent="$emit('remove', item)" class="min-w-[62px] h-12 px-5 bg-white border border-gray-200 rounded-lg text-xl text-gray-900 hover:border-blue-300 hover:bg-blue-50 shadow-sm transition">{{ item }}</button>
        <button v-if="hiddenCount > 0" @click="$emit('expand')" class="h-12 px-4 rounded-lg border border-dashed border-gray-300 text-base text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">展开 +{{ hiddenCount }}</button>
        <button v-else-if="expanded && count > collapsedLimit && !input.trim()" @click="$emit('collapse')" class="h-12 px-4 rounded-lg border border-dashed border-gray-300 text-base text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">收起</button>
        <span v-if="input.trim() && count === 0" class="text-base text-gray-400">{{ emptyHint }}</span>
      </div>
      <div class="flex gap-3">
        <div class="relative flex-1">
          <input :value="input" @input="$emit('update:input', $event.target.value)" @keyup.enter="$emit('submit')" type="text" :title="hint" :placeholder="placeholder" class="w-full h-12 pl-4 pr-11 border border-gray-200 rounded-lg bg-white text-lg focus:border-blue-500 focus:ring-0 outline-none" />
          <button v-if="input" @click="$emit('clear')" title="清空" class="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600">×</button>
        </div>
        <button @click="$emit('submit')" class="h-12 px-6 rounded-lg bg-blue-600 text-white text-lg hover:bg-blue-700 transition">添加</button>
      </div>
    </div>
  `
});
