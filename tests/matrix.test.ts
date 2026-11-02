import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildColorTotals,
  buildSizeTotals,
  buildSummaryMatrix,
  summaryColTotal,
  summaryRowTotal
} from '../src/domain/matrix.ts';

const rows = [
  { id: 'r1', name: '红' },
  { id: 'r2', name: '蓝' }
];
const cols = [
  { id: 'c1', name: 'S' },
  { id: 'c2', name: 'M' }
];

test('颜色合计按 row.id 聚合', () => {
  const data = { r1_c1: 3, r1_c2: 7, r2_c1: 5 };
  assert.deepEqual(buildColorTotals(rows, cols, data), { r1: 10, r2: 5 });
});

test('尺码合计按 col.id 聚合', () => {
  const data = { r1_c1: 3, r1_c2: 7, r2_c1: 5 };
  assert.deepEqual(buildSizeTotals(rows, cols, data), { c1: 8, c2: 7 });
});

test('没有数据的行列小计为 0 而不是缺键', () => {
  assert.deepEqual(buildColorTotals(rows, cols, {}), { r1: 0, r2: 0 });
  assert.deepEqual(buildSizeTotals(rows, cols, {}), { c1: 0, c2: 0 });
});

test('汇总矩阵按名称合并重复颜色/尺码', () => {
  const dupRows = [
    { id: 'r1', name: '红' },
    { id: 'r2', name: '红' }, // 同名不同 id
    { id: 'r3', name: '蓝' }
  ];
  const dupCols = [
    { id: 'c1', name: 'S' },
    { id: 'c2', name: 'S' } // 同名不同 id
  ];
  const data = { r1_c1: 1, r2_c2: 2, r3_c1: 3 };

  const summary = buildSummaryMatrix(dupRows, dupCols, data);

  assert.deepEqual(summary.colorNames, ['红', '蓝']);
  assert.deepEqual(summary.sizeNames, ['S']);
  // 红 + S：r1_c1(1) + r2_c2(2) 合并
  assert.equal(summary.matrix['红']['S'], 3);
  assert.equal(summary.matrix['蓝']['S'], 3);
  assert.equal(summaryRowTotal(summary, '红'), 3);
  assert.equal(summaryColTotal(summary, 'S'), 6);
});

test('汇总矩阵忽略空名称', () => {
  const dirtyRows = [
    { id: 'r1', name: '  ' },
    { id: 'r2', name: ' 红 ' } // 前后空格应被 trim
  ];
  const summary = buildSummaryMatrix(dirtyRows, cols, { r1_c1: 9, r2_c1: 4 });

  assert.deepEqual(summary.colorNames, ['红']);
  assert.equal(summary.matrix['红']['S'], 4); // 空名称行的 9 不计入
});

test('空表汇总不报错', () => {
  const summary = buildSummaryMatrix([], [], {});
  assert.deepEqual(summary.colorNames, []);
  assert.deepEqual(summary.sizeNames, []);
  assert.deepEqual(summary.matrix, {});
  assert.equal(summaryColTotal(summary, 'S'), 0);
  assert.equal(summaryRowTotal(summary, '红'), 0);
});
