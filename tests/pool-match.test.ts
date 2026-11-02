import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPoolItem } from '../src/services/poolMatch.ts';

/**
 * 迁移自 assistantScript/test-pool-match.ts（原脚本被 .gitignore 忽略，不在版本库里）。
 * 用例本身未改动，只是把 console 输出改成断言。
 */

const COLORS = ['红', '绿', '蓝', '黑', '白', '黄', '藏青', '灰', '黑色', '藏青色', '藏蓝', '宝石蓝', '墨绿', '玫红', '雾霾蓝', '驼色', '卡其', '银灰'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '大码', '中码'];

const hit = (pool: string[], query: string): string[] => pool.filter((name) => matchPoolItem(name, query));

test('颜色池：文字匹配', () => {
  assert.deepEqual(hit(COLORS, '黑'), ['黑', '黑色']);
  assert.deepEqual(hit(COLORS, '藏'), ['藏青', '藏青色', '藏蓝']);
});

test('颜色池：全拼', () => {
  assert.deepEqual(hit(COLORS, 'heise'), ['黑色']);
  assert.deepEqual(hit(COLORS, 'hei'), ['黑', '黑色']);
  assert.deepEqual(hit(COLORS, 'baoshilan'), ['宝石蓝']);
});

test('颜色池：多音字「藏」按 cang 和 zang 都能命中', () => {
  assert.deepEqual(hit(COLORS, 'cangqing'), ['藏青', '藏青色']);
  assert.deepEqual(hit(COLORS, 'zangqing'), ['藏青', '藏青色']);
});

test('颜色池：ü 输入成 v 或 u 都能命中', () => {
  assert.deepEqual(hit(COLORS, 'molv'), ['墨绿']);
  assert.deepEqual(hit(COLORS, 'molu'), ['墨绿']);
});

test('颜色池：首字母', () => {
  assert.deepEqual(hit(COLORS, 'hs'), ['黑色']);
  assert.deepEqual(hit(COLORS, 'h'), ['红', '黑', '黄', '灰', '黑色']);
  assert.deepEqual(hit(COLORS, 'bsl'), ['宝石蓝']);
  assert.deepEqual(hit(COLORS, 'cq'), ['藏青', '藏青色']);
});

test('颜色池：拼音与汉字混输', () => {
  assert.deepEqual(hit(COLORS, 'hei色'), ['黑色']);
  assert.deepEqual(hit(COLORS, 'b石蓝'), ['宝石蓝']);
});

test('颜色池：空输入返回全部，无匹配返回空', () => {
  assert.deepEqual(hit(COLORS, ''), COLORS);
  assert.deepEqual(hit(COLORS, 'zzzz'), []);
});

test('尺码池：字母精确与子串', () => {
  assert.deepEqual(hit(SIZES, 'xl'), ['XL', '2XL', '3XL']);
  assert.deepEqual(hit(SIZES, '2xl'), ['2XL']);
  assert.deepEqual(hit(SIZES, '3xl'), ['3XL']);
});

test('尺码池：中文尺码', () => {
  assert.deepEqual(hit(SIZES, '大码'), ['大码']);
  assert.deepEqual(hit(SIZES, 'dama'), ['大码']);
  assert.deepEqual(hit(SIZES, 'dm'), ['大码']);
});

test('尺码池：单字母只命中单字，不误命中中间字', () => {
  assert.deepEqual(hit(SIZES, 'm'), ['M']);
  assert.deepEqual(hit(SIZES, 'zm'), ['中码']);
});

test('尺码池：空输入', () => {
  assert.deepEqual(hit(SIZES, ''), SIZES);
});
