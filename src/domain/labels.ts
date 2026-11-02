/**
 * 热敏标签数据生成 —— 全项目唯一实现。
 *
 * 一张标签对应「一个颜色 × 一个尺码 × 一个部位」。
 * 部位模式（sectional）下同一个单元格会按所选部位各生成一张，
 * 这些标签共享同一个扎号，页码按总张数连续编号。
 *
 * 打印样式（字号、纸张尺寸）不在这里，见 index.html 的 @media print
 * 与 FormEditor 的 printStyleVars。
 */
import type { CuttingForm, MatrixHeader } from '../types.ts';
import { buildBundleMap, cellKey, cellQty } from './bundle.ts';

export type PrintMode = 'direct' | 'sectional';

export interface LabelData {
  /** key + 部位名，用于 v-for :key */
  id: string;
  styleNumber: string;
  customer: string;
  bedNumber: string;
  color: string;
  size: string;
  bundleNo: number | undefined;
  qty: number;
  /** 部位名，直接打印时为 '' */
  section: string;
  currentPage: number;
  totalPage: number;
}

export interface LabelOptions {
  printMode: PrintMode;
  selectedSections: string[];
}

/**
 * 生成待打印标签。
 *
 * 遍历顺序与扎号分配完全一致（cols 外层、rows 内层），
 * 因此标签顺序即扎号顺序。数量为 0 的单元格不生成标签。
 */
export const buildLabels = (form: CuttingForm, options: LabelOptions): LabelData[] => {
  const rows: MatrixHeader[] = form.rows || [];
  const cols: MatrixHeader[] = form.cols || [];
  const bundleMap = buildBundleMap(rows, cols, form.data);

  // 仅当「按部位打印」且确实选了部位时才按部位展开，否则只出一套（部位为空串）
  const sectionsToPrint =
    options.printMode === 'sectional' && options.selectedSections.length > 0
      ? options.selectedSections
      : [''];

  const list: Omit<LabelData, 'currentPage' | 'totalPage'>[] = [];

  sectionsToPrint.forEach((sectionName) => {
    cols.forEach((col) => {
      rows.forEach((row) => {
        const qty = cellQty(form.data, row.id, col.id);
        if (qty <= 0) return;

        const key = cellKey(row.id, col.id);
        list.push({
          id: `${key}_${sectionName}`,
          styleNumber: form.styleNumber || '-',
          customer: form.customer || '-',
          bedNumber: form.bedNumber || '-',
          color: row.name,
          size: col.name,
          bundleNo: bundleMap.get(key),
          qty,
          section: sectionName
        });
      });
    });
  });

  const totalPage = list.length;
  return list.map((item, index) => ({ ...item, currentPage: index + 1, totalPage }));
};

/**
 * 按勾选的扎号过滤标签。
 * 未开启选择模式、或一个扎号都没选时，返回全部（与原有交互一致）。
 */
export const filterLabelsByBundles = (
  labels: LabelData[],
  selectMode: boolean,
  selectedBundles: number[]
): LabelData[] => {
  if (!selectMode || selectedBundles.length === 0) return labels;
  return labels.filter((label) => selectedBundles.includes(label.bundleNo as number));
};
