/**
 * 二维数量表格：颜色 × 尺码。
 *
 * 功能密集，改动时请格外小心：
 * - 颜色行、尺码列的拖动排序
 * - 单元格键盘导航（方向键 / Enter / Tab），依赖 input 上的 data-row、data-col
 * - 行列新增删除、行复制 / 列复制开关
 * - 首列与表头吸顶（sticky）
 *
 * 数量以 `${row.id}_${col.id}` 为键存在 data 里，排序只调整 rows/cols 数组顺序，
 * 不动 data，因此拖动后数量仍跟随原来的颜色和尺码。
 *
 * 本组件为受控组件：不持有业务状态，所有改动以事件上抛给 FormEditor。
 * 只有 rowSmartFill / colSmartFill 两个勾选状态例外——它们以对象 prop 传入并就地修改，
 * 与原实现行为一致；如需彻底规范化，可改为独立事件。
 */
import { defineComponent } from 'vue';
import type { MatrixHeader } from '../types.ts';
import { cellKey } from '../domain/bundle.ts';
import { IconGripVertical, IconGripHorizontal } from './Icons.ts';

export default defineComponent({
  name: 'MatrixTable',
  components: { IconGripVertical, IconGripHorizontal },
  props: {
    rows: {
      type: Array as () => MatrixHeader[],
      required: true
    },
    cols: {
      type: Array as () => MatrixHeader[],
      required: true
    },
    data: {
      type: Object as () => Record<string, number>,
      required: true
    },
    rowSmartFill: {
      type: Object as () => Record<string, boolean>,
      required: true
    },
    colSmartFill: {
      type: Object as () => Record<string, boolean>,
      required: true
    },
    colorTotals: {
      type: Object as () => Record<string, number>,
      required: true
    },
    sizeTotals: {
      type: Object as () => Record<string, number>,
      required: true
    },
    totalPieces: {
      type: Number,
      required: true
    },
    isAllRowFillEnabled: {
      type: Boolean,
      required: true
    }
  },
  emits: [
    'update-row-name',
    'update-col-name',
    'delete-row',
    'delete-col',
    'update-cell',
    'cell-focus',
    'cell-keydown',
    'drag-start',
    'drag-over',
    'drop-row',
    'drop-col',
    'drag-end',
    'toggle-all-row-fill'
  ],
  methods: {
    getCellValue(rowId: string, colId: string): number {
      return Number(this.data[cellKey(rowId, colId)]) || 0;
    },
    getColTotal(colId: string): number {
      return this.sizeTotals[colId] || 0;
    },
    onCellInput(rowId: string, colId: string, event: Event) {
      const target = event.target as HTMLInputElement;
      this.$emit('update-cell', rowId, colId, target.value);
    }
  },
  template: `
    <div class="overflow-x-auto pb-2">
      <table class="min-w-full border-collapse text-gray-900">
        <thead>
          <tr class="bg-gray-50">
            <th class="sticky left-0 z-20 w-[200px] min-w-[200px] max-w-[200px] h-24 border border-gray-300 bg-gray-50 relative align-top p-0">
              <div class="absolute left-0 top-0 w-full h-full" style="background: linear-gradient(to top right, transparent 49.4%, #d1d5db 50%, transparent 50.6%);"></div>
              <span class="absolute left-4 bottom-4 text-base font-bold">颜色</span>
              <span class="absolute right-4 top-3 text-base font-bold">尺码</span>
            </th>
            <th v-for="(col, colIdx) in cols" :key="'header-' + col.id" class="w-[112px] min-w-[112px] max-w-[112px] h-24 border border-gray-300 bg-gray-50 px-3 group relative">
              <button
                type="button"
                draggable="true"
                @dragstart="$emit('drag-start', $event, colIdx, 'col')"
                @dragover.prevent="$emit('drag-over', $event, colIdx)"
                @drop="$emit('drop-col', $event, colIdx)"
                @dragend="$emit('drag-end', $event)"
                title="拖动调整尺码顺序"
                class="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-blue-100 hover:text-blue-600 active:cursor-grabbing"
              >
                <IconGripHorizontal :size="16" />
              </button>
              <input :value="col.name" @input="$emit('update-col-name', colIdx, $event)" class="w-full bg-transparent text-center text-2xl font-bold outline-none focus:text-blue-600" />
              <button @click="$emit('delete-col', colIdx)" class="absolute right-2 top-2 w-7 h-7 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition">x</button>
              <label class="absolute right-4 bottom-3 flex flex-col items-center gap-1 text-sm text-gray-600 font-medium">
                <span>列复制<input type="checkbox" v-model="colSmartFill[col.id]" class="w-5 h-5" /></span>
                
              </label>
            </th>
            <th class="min-w-[120px] h-24 border border-gray-300 bg-gray-50 text-lg font-bold">合计</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIdx) in rows" :key="'row-' + row.id" class="group">
            <th class="sticky left-0 z-10 w-[200px] min-w-[200px] max-w-[200px] h-20 border border-gray-300 bg-gray-50 px-4 relative">
              <button
                type="button"
                draggable="true"
                @dragstart="$emit('drag-start', $event, rowIdx, 'row')"
                @dragover.prevent="$emit('drag-over', $event, rowIdx)"
                @drop="$emit('drop-row', $event, rowIdx)"
                @dragend="$emit('drag-end', $event)"
                title="拖动调整颜色顺序"
                class="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-blue-100 hover:text-blue-600 active:cursor-grabbing"
              >
                <IconGripVertical :size="16" />
              </button>
              <input :value="row.name" @input="$emit('update-row-name', rowIdx, $event)" class="w-full bg-transparent text-center text-2xl font-bold outline-none focus:text-blue-600" />
              <button @click="$emit('delete-row', rowIdx)" class="absolute right-2 top-2 w-7 h-7 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition">x</button>
              <span v-if="rowSmartFill[row.id]" class="absolute left-2 top-2 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">{{ rowIdx + 1 }}</span>
            </th>
            <td v-for="col in cols" :key="'cell-' + row.id + '-' + col.id" class="w-[112px] min-w-[112px] max-w-[112px] h-20 border border-gray-300 bg-white text-center">
              <input :value="getCellValue(row.id, col.id)" @input="onCellInput(row.id, col.id, $event)" @focus="$emit('cell-focus', $event)" @keydown="$emit('cell-keydown', $event, row.id, col.id)" :data-row="row.id" :data-col="col.id" class="w-full h-full bg-transparent text-center text-2xl outline-none focus:bg-blue-50 focus:ring-2 focus:ring-blue-500" />
            </td>
            <td class="min-w-[120px] h-20 border border-gray-300 bg-gray-50 text-center text-xl font-bold">{{ colorTotals[row.id] || 0 }}</td>
          </tr>
          <tr>
            <th class="sticky left-0 z-10 w-[200px] min-w-[200px] max-w-[200px] h-16 border border-gray-300 bg-gray-50 text-base font-bold">
              <label class="inline-flex flex-col items-center gap-1 text-gray-600">
                <span>行复制<input type="checkbox" :checked="isAllRowFillEnabled" @change="$emit('toggle-all-row-fill', $event)" class="w-5 h-5" /></span>
              </label>
            </th>
            <td v-for="col in cols" :key="'total-' + col.id" class="w-[112px] min-w-[112px] max-w-[112px] h-16 border border-gray-300 bg-gray-50 text-center text-xl font-bold">{{ getColTotal(col.id) }}</td>
            <td class="min-w-[120px] h-16 border border-gray-300 bg-blue-50 text-center text-xl font-bold text-blue-700">{{ totalPieces }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `
});
