/**
 * 扎号分配与扎明细 —— 全项目唯一实现。
 *
 * 重要：遍历顺序固定为「尺码列在外层、颜色行在内层」，扎号按该顺序从 1 递增。
 * 这个顺序决定打印顺序，且已经写进了大量历史订单的打印结果里，不可调整。
 *
 * 重构前这套逻辑在三个地方各写一遍，其中 FormEditor.methods 里那份死代码
 * 的遍历顺序是反的（rows 外 cols 内）。一旦有人误用那份实现，扎号会静默
 * 错乱，而打印出来的菲票看起来完全正常 —— 所以必须收敛成一份。
 */
import type { MatrixHeader } from '../types.ts';

/** 二维数量键：`${rowId}_${colId}`。不可更改，历史数据依赖此格式。 */
export const cellKey = (rowId: string, colId: string): string => `${rowId}_${colId}`;

/** 读取单元格数量 */
export const cellQty = (
  data: Record<string, number> | null | undefined,
  rowId: string,
  colId: string
): number => {
  if (!data) return 0;
  return Number(data[cellKey(rowId, colId)]) || 0;
};

/**
 * 为每个有数量的单元格分配扎号。
 * 数量为 0 或空白的单元格不占号，因此扎号连续。
 */
export const buildBundleMap = (
  rows: MatrixHeader[] | null | undefined,
  cols: MatrixHeader[] | null | undefined,
  data: Record<string, number> | null | undefined
): Map<string, number> => {
  const map = new Map<string, number>();
  let counter = 1;

  // 顺序不可调整，见文件头注释
  (cols || []).forEach((col) => {
    (rows || []).forEach((row) => {
      const key = cellKey(row.id, col.id);
      if (cellQty(data, row.id, col.id) > 0) {
        map.set(key, counter);
        counter += 1;
      }
    });
  });

  return map;
};

/** 扎号总数 */
export const countBundles = (
  rows: MatrixHeader[] | null | undefined,
  cols: MatrixHeader[] | null | undefined,
  data: Record<string, number> | null | undefined
): number => buildBundleMap(rows, cols, data).size;

export interface BundleEntry {
  no: number | undefined;
  color: string;
  size: string;
  qty: number;
}

/** 扎明细清单（按扎号升序） */
export const buildBundleList = (
  rows: MatrixHeader[] | null | undefined,
  cols: MatrixHeader[] | null | undefined,
  data: Record<string, number> | null | undefined
): BundleEntry[] => {
  const list: BundleEntry[] = [];
  const bundleMap = buildBundleMap(rows, cols, data);

  (cols || []).forEach((col) => {
    (rows || []).forEach((row) => {
      const qty = cellQty(data, row.id, col.id);
      if (qty > 0) {
        list.push({
          no: bundleMap.get(cellKey(row.id, col.id)),
          color: row.name,
          size: col.name,
          qty
        });
      }
    });
  });

  return list.sort((a, b) => (a.no || 0) - (b.no || 0));
};
