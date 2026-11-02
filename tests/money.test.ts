import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnitPrice, orderAmount, orderPieces, sumPieces, totalAmountOnSave } from '../src/domain/money.ts';

/**
 * 这些用例的期望值来自重构前的三处实现。
 * 其中「老数据无单价、有直接总金额」一条是本次修复的核心：
 * 重构前 FormEditor 会算成「其他费用」，而 FormList / CuttingReport 会返回 totalAmount。
 */

test('sumPieces 累加所有单元格，容错非数字', () => {
  assert.equal(sumPieces({ a: 3, b: 5 }), 8);
  assert.equal(sumPieces({ a: 3, b: undefined as unknown as number }), 3);
  assert.equal(sumPieces({ a: 3, b: '7' as unknown as number }), 10);
  assert.equal(sumPieces({}), 0);
  assert.equal(sumPieces(null), 0);
  assert.equal(sumPieces(undefined), 0);
});

test('orderPieces 只依赖 data', () => {
  assert.equal(orderPieces({ data: { 'r1_c1': 10, 'r1_c2': 5 } }), 15);
  assert.equal(orderPieces({ data: {} }), 0);
});

test('hasUnitPrice 区分「未填」与「0」', () => {
  assert.equal(hasUnitPrice(2.5), true);
  assert.equal(hasUnitPrice('2.5'), true);
  assert.equal(hasUnitPrice(0), true); // 0 是有效单价
  assert.equal(hasUnitPrice(''), false);
  assert.equal(hasUnitPrice('   '), false);
  assert.equal(hasUnitPrice(undefined), false);
  assert.equal(hasUnitPrice(null), false);
  assert.equal(hasUnitPrice('abc'), false);
});

test('orderAmount 常规：单价 × 件数 + 其他费用', () => {
  assert.equal(orderAmount({ data: { a: 120 }, amountPerPiece: 2.5, additionalFee: 50 }), 350);
  assert.equal(orderAmount({ data: { a: 120 }, amountPerPiece: 2.5, additionalFee: 0 }), 300);
  assert.equal(orderAmount({ data: { a: 3 }, amountPerPiece: 1.15, additionalFee: 10 }), 13.45);
});

test('orderAmount 其他费用的空值处理', () => {
  const base = { data: { a: 120 }, amountPerPiece: 2.5 };
  assert.equal(orderAmount({ ...base, additionalFee: undefined }), 300);
  assert.equal(orderAmount({ ...base, additionalFee: null }), 300);
  assert.equal(orderAmount({ ...base, additionalFee: '' }), 300);
  assert.equal(orderAmount({ ...base, additionalFee: '50' }), 350);
  assert.equal(orderAmount({ ...base, additionalFee: -50 }), 250);
});

test('orderAmount 单价为 0 或未填时只看其他费用', () => {
  assert.equal(orderAmount({ data: { a: 120 }, amountPerPiece: 0, additionalFee: 50 }), 50);
  assert.equal(orderAmount({ data: { a: 120 }, amountPerPiece: undefined, additionalFee: 50 }), 50);
  assert.equal(orderAmount({ data: { a: 120 }, amountPerPiece: '', additionalFee: 50 }), 50);
});

test('orderAmount 件数为 0', () => {
  assert.equal(orderAmount({ data: {}, amountPerPiece: 2.5, additionalFee: 50 }), 50);
  assert.equal(orderAmount({ data: {}, amountPerPiece: 2.5, additionalFee: 0 }), 0);
});

test('【修复项】老数据：无单价、有 totalAmount，应返回 totalAmount', () => {
  // 重构前 FormEditor 在这里返回 50（其他费用），与列表页/报表页的 999 不一致
  const legacy = { data: { a: 120 }, additionalFee: 50, totalAmount: 999 };
  assert.equal(orderAmount(legacy), 999);
  assert.equal(orderAmount({ data: { a: 120 }, totalAmount: 1200 }), 1200);
  assert.equal(orderAmount({ data: { a: 120 }, totalAmount: '1200' as unknown as number }), 1200);
});

test('orderAmount 单价优先于 totalAmount', () => {
  assert.equal(
    orderAmount({ data: { a: 10 }, amountPerPiece: 5, additionalFee: 0, totalAmount: 999 }),
    50
  );
});

test('orderAmount 可传入已算好的件数', () => {
  assert.equal(orderAmount({ amountPerPiece: 5, additionalFee: 1 }, 10), 51);
});

test('【修复项】totalAmountOnSave 不再销毁历史金额', () => {
  // 有单价：清空冗余字段（保持原行为）
  assert.equal(totalAmountOnSave({ data: {}, amountPerPiece: 2.5, totalAmount: 999 }), undefined);
  // 无单价：必须保留
  assert.equal(totalAmountOnSave({ data: {}, totalAmount: 999 }), 999);
  assert.equal(totalAmountOnSave({ data: {}, totalAmount: '999' as unknown as number }), 999);
  // 都没有
  assert.equal(totalAmountOnSave({ data: {} }), undefined);
  // 脏数据
  assert.equal(totalAmountOnSave({ data: {}, totalAmount: 'abc' as unknown as number }), undefined);
  assert.equal(totalAmountOnSave({ data: {}, totalAmount: '' as unknown as number }), undefined);
});
