import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBundleList, buildBundleMap, cellKey, cellQty, countBundles } from '../src/domain/bundle.ts';

const rows = [
  { id: 'r1', name: '红' },
  { id: 'r2', name: '蓝' },
  { id: 'r3', name: '黑' }
];
const cols = [
  { id: 'c1', name: 'S' },
  { id: 'c2', name: 'M' }
];

test('cellKey 保持 `${rowId}_${colId}` 格式', () => {
  assert.equal(cellKey('r1', 'c2'), 'r1_c2');
});

test('cellQty 容错', () => {
  assert.equal(cellQty({ r1_c1: 5 }, 'r1', 'c1'), 5);
  assert.equal(cellQty({}, 'r1', 'c1'), 0);
  assert.equal(cellQty(null, 'r1', 'c1'), 0);
  assert.equal(cellQty({ r1_c1: '7' as unknown as number }, 'r1', 'c1'), 7);
});

test('扎号顺序：尺码列在外层、颜色行在内层', () => {
  const data = {
    r1_c1: 10, r2_c1: 20, r3_c1: 30,
    r1_c2: 40, r2_c2: 50, r3_c2: 60
  };
  const map = buildBundleMap(rows, cols, data);

  // 第一列（S）先按颜色顺序编号，然后才是第二列（M）
  assert.equal(map.get('r1_c1'), 1);
  assert.equal(map.get('r2_c1'), 2);
  assert.equal(map.get('r3_c1'), 3);
  assert.equal(map.get('r1_c2'), 4);
  assert.equal(map.get('r2_c2'), 5);
  assert.equal(map.get('r3_c2'), 6);
  assert.equal(map.size, 6);
});

test('数量为 0 或空白的单元格不占扎号，编号连续', () => {
  const data = { r1_c1: 0, r2_c1: 5, r3_c1: 0, r1_c2: 8 };
  const map = buildBundleMap(rows, cols, data);

  assert.equal(map.has('r1_c1'), false);
  assert.equal(map.get('r2_c1'), 1);
  assert.equal(map.has('r3_c1'), false);
  assert.equal(map.get('r1_c2'), 2);
  assert.equal(map.size, 2);
});

test('空表返回空 Map', () => {
  assert.equal(buildBundleMap([], [], {}).size, 0);
  assert.equal(buildBundleMap(null, null, null).size, 0);
  assert.equal(countBundles(rows, cols, {}), 0);
});

test('buildBundleList 按扎号升序且字段与历史一致', () => {
  const data = { r1_c1: 0, r2_c1: 5, r3_c1: 2, r1_c2: 8 };
  const list = buildBundleList(rows, cols, data);

  assert.deepEqual(list, [
    { no: 1, color: '蓝', size: 'S', qty: 5 },
    { no: 2, color: '黑', size: 'S', qty: 2 },
    { no: 3, color: '红', size: 'M', qty: 8 }
  ]);
});

test('数量占比大表：20 色 × 10 码 全部填满时扎号 = 200', () => {
  const bigRows = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, name: `色${i}` }));
  const bigCols = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `码${i}` }));
  const data: Record<string, number> = {};
  bigRows.forEach((r) => bigCols.forEach((c) => { data[`${r.id}_${c.id}`] = 1; }));

  const map = buildBundleMap(bigRows, bigCols, data);
  assert.equal(map.size, 200);
  assert.equal(map.get('r0_c0'), 1);
  assert.equal(map.get('r19_c0'), 20);
  assert.equal(map.get('r0_c1'), 21);
  assert.equal(map.get('r19_c9'), 200);
});
