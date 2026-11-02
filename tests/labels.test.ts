import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLabels, filterLabelsByBundles } from '../src/domain/labels.ts';
import type { CuttingForm } from '../src/types.ts';

const makeForm = (override: Partial<CuttingForm> = {}): CuttingForm => ({
  id: 'f1',
  styleNumber: 'A-100',
  customer: '测试客户',
  bedNumber: '3',
  createdAt: 0,
  updatedAt: 0,
  rows: [
    { id: 'r1', name: '红' },
    { id: 'r2', name: '蓝' }
  ],
  cols: [
    { id: 'c1', name: 'S' },
    { id: 'c2', name: 'M' }
  ],
  data: { r1_c1: 10, r1_c2: 20, r2_c1: 30 },
  additionalFee: 0,
  ...override
});

test('直接打印：一张菲对应一个有数量的单元格', () => {
  const labels = buildLabels(makeForm(), { printMode: 'direct', selectedSections: [] });

  assert.equal(labels.length, 3);
  assert.deepEqual(labels.map((l) => l.bundleNo), [1, 2, 3]);
  // 遍历顺序为尺码列在外层、颜色行在内层：红S → 蓝S → 红M
  assert.deepEqual(labels.map((l) => l.color), ['红', '蓝', '红']);
  assert.deepEqual(labels.map((l) => l.size), ['S', 'S', 'M']);
  assert.deepEqual(labels.map((l) => l.qty), [10, 30, 20]);
  assert.deepEqual(labels.map((l) => l.section), ['', '', '']);
});

test('页码连续，总页数等于标签张数', () => {
  const labels = buildLabels(makeForm(), { printMode: 'direct', selectedSections: [] });

  assert.deepEqual(labels.map((l) => l.currentPage), [1, 2, 3]);
  assert.deepEqual(labels.map((l) => l.totalPage), [3, 3, 3]);
});

test('按部位打印：张数 = 单元格数 × 部位数，扎号相同', () => {
  const labels = buildLabels(makeForm(), {
    printMode: 'sectional',
    selectedSections: ['袖口', '前幅']
  });

  assert.equal(labels.length, 6);
  assert.deepEqual(labels.slice(0, 3).map((l) => l.section), ['袖口', '袖口', '袖口']);
  assert.deepEqual(labels.slice(3).map((l) => l.section), ['前幅', '前幅', '前幅']);
  // 同一单元格在不同部位下扎号一致
  assert.deepEqual(labels.map((l) => l.bundleNo), [1, 2, 3, 1, 2, 3]);
  assert.deepEqual(labels.map((l) => l.currentPage), [1, 2, 3, 4, 5, 6]);
});

test('选部位模式但一个部位都没选 → 退回单套标签', () => {
  const labels = buildLabels(makeForm(), { printMode: 'sectional', selectedSections: [] });
  assert.equal(labels.length, 3);
});

test('没有数量时不出标签', () => {
  const labels = buildLabels(makeForm({ data: {} }), { printMode: 'direct', selectedSections: [] });
  assert.equal(labels.length, 0);
});

test('标签字段容错：空值回退为 -', () => {
  const labels = buildLabels(
    makeForm({ styleNumber: '', customer: '', bedNumber: '' }),
    { printMode: 'direct', selectedSections: [] }
  );
  assert.equal(labels[0].styleNumber, '-');
  assert.equal(labels[0].customer, '-');
  assert.equal(labels[0].bedNumber, '-');
});

test('标签 id 由 key 与部位名拼成，同一单元格多部位不重复', () => {
  const labels = buildLabels(makeForm(), {
    printMode: 'sectional',
    selectedSections: ['袖口', '前幅']
  });
  const ids = labels.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[0], 'r1_c1_袖口');
});

test('按扎号筛选：未开启选择模式返回全部', () => {
  const labels = buildLabels(makeForm(), { printMode: 'direct', selectedSections: [] });
  assert.equal(filterLabelsByBundles(labels, false, [1]).length, 3);
  assert.equal(filterLabelsByBundles(labels, true, []).length, 3);
});

test('按扎号筛选：只保留勾选的扎号', () => {
  const labels = buildLabels(makeForm(), { printMode: 'direct', selectedSections: [] });
  const picked = filterLabelsByBundles(labels, true, [1, 3]);
  assert.deepEqual(picked.map((l) => l.bundleNo), [1, 3]);
});
