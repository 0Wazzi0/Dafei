/**
 * 单张热敏标签。
 *
 * 打印输出（.thermal-print-root 内）与屏幕预览（.label-preview-container 内）
 * 共用这一个组件，确保两处排版永远不会分叉。
 *
 * 重构前这段结构在 FormEditor 的模板里写了两遍，只有 v-for 的 key 前缀不同。
 *
 * 注意：不要把 class 名改掉。.print-label / .label-content / .label-header /
 * .label-row / .label-footer 这几个类在 index.html 的 @media print 中有对应样式，
 * 并已针对 40mm × 80mm 纸张反复校准。
 */
import { defineComponent } from 'vue';
import type { LabelData } from '../domain/labels.ts';

/** 标签抬头。改这里即同时改掉打印与预览的抬头。 */
const STUDIO_NAME = '青蓝服装裁剪工作室';

export default defineComponent({
  name: 'LabelCard',
  props: {
    label: {
      type: Object as () => LabelData,
      required: true
    }
  },
  data() {
    return { studioName: STUDIO_NAME };
  },
  template: `
    <div class="print-label">
      <div class="label-content">
        <div class="label-header">{{ studioName }}</div>
        <div class="label-row"><b>款号</b><span>{{ label.styleNumber }}</span></div>
        <div class="label-row"><b>床号</b><span>{{ label.bedNumber }}</span></div>
        <div class="label-row"><b>颜色</b><span>{{ label.color }}</span></div>
        <div class="label-row"><b>尺码</b><span>{{ label.size }}</span></div>
        <div class="label-row"><b>扎号</b><span>{{ label.bundleNo }}</span></div>
        <div class="label-row"><b>件数</b><span>{{ label.qty }}</span></div>
        <div v-if="label.section" class="flex mt-auto text-[12px] font-black py-0.5 justify-start">
          {{ label.section }}
        </div>
        <div class="label-footer">
          <span>第 {{ label.currentPage }} 张</span>
          <span>共 {{ label.totalPage }} 张</span>
        </div>
      </div>
    </div>
  `
});
