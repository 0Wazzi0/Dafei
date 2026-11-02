/**
 * 二维表格汇总 —— 颜色/尺码小计、同名合并汇总。
 * 重构前 FormEditor 与 CuttingReport 各实现一遍，现统一。
 */
import type { MatrixHeader } from '../types.ts';
import { cellKey, cellQty } from './bundle.ts';

/** 每个颜色行的合计，键为 row.id */
export const buildColorTotals = (
  rows: MatrixHeader[] | null | undefined,
  cols: MatrixHeader[] | null | undefined,
  data: Record<string, number> | null | undefined
): Record<string, number> => {
  const totals: Record<string, number> = {};

  (rows || []).forEach((row) => {
    let sum = 0;
    (cols || []).forEach((col) => {
      sum += cellQty(data, row.id, col.id);
    });
    totals[row.id] = sum;
  });

  return totals;
};

/** 每个尺码列的合计，键为 col.id */
export const buildSizeTotals = (
  rows: MatrixHeader[] | null | undefined,
  cols: MatrixHeader[] | null | undefined,
  data: Record<string, number> | null | undefined
): Record<string, number> => {
  const totals: Record<string, number> = {};

  (cols || []).forEach((col) => {
    let sum = 0;
    (rows || []).forEach((row) => {
      sum += cellQty(data, row.id, col.id);
    });
    totals[col.id] = sum;
  });

  return totals;
};

export interface SummaryMatrix {
  colorNames: string[];
  sizeNames: string[];
  /** matrix[颜色名][尺码名] = 数量 */
  matrix: Record<string, Record<string, number>>;
}

/**
 * 按「名称」而非 id 合并的汇总矩阵。
 * 同一个颜色行被重复添加（id 不同但名称相同）时，数量会按名称累加。
 * 名称会 trim，空名称的行列被忽略。
 */
export const buildSummaryMatrix = (
  rows: MatrixHeader[] | null | undefined,
  cols: MatrixHeader[] | null | undefined,
  data: Record<string, number> | null | undefined
): SummaryMatrix => {
  const rowList = rows || [];
  const colList = cols || [];

  const colorNames = Array.from(new Set(rowList.map((r) => r.name.trim()))).filter((n) => n !== '');
  const sizeNames = Array.from(new Set(colList.map((c) => c.name.trim()))).filter((n) => n !== '');

  const matrix: Record<string, Record<string, number>> = {};
  colorNames.forEach((color) => {
    matrix[color] = {};
    sizeNames.forEach((size) => {
      matrix[color][size] = 0;
    });
  });

  rowList.forEach((row) => {
    const rowName = row.name.trim();
    if (!matrix[rowName]) return;

    colList.forEach((col) => {
      const colName = col.name.trim();
      if (!matrix[rowName][colName]) matrix[rowName][colName] = 0;

      const qty = cellQty(data, row.id, col.id);
      if (qty > 0) {
        matrix[rowName][colName] += qty;
      }
    });
  });

  return { colorNames, sizeNames, matrix };
};

/** 汇总矩阵中某一颜色名的行合计 */
export const summaryRowTotal = (summary: SummaryMatrix, colorName: string): number =>
  Object.values(summary.matrix[colorName] || {}).reduce((sum, value) => sum + value, 0);

/** 汇总矩阵中某一尺码名的列合计 */
export const summaryColTotal = (summary: SummaryMatrix, sizeName: string): number =>
  summary.colorNames.reduce((sum, color) => sum + (summary.matrix[color][sizeName] || 0), 0);

/** 供调试与测试使用：某单元格的键 */
export { cellKey };
