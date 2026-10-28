import { pinyin } from 'pinyin-pro';

/**
 * 颜色池 / 尺码池的模糊匹配。
 *
 * 支持三种匹配方式（任意一种命中即显示）：
 * 1. 文字：输入「黑」命中「黑色」，输入「XL」命中「XL」
 * 2. 全拼：输入「heise」命中「黑色」，输入「molv」命中「墨绿」
 * 3. 首字母：输入「hs」命中「黑色」，输入「bsl」命中「宝石蓝」
 *
 * 拼音按「前缀 + 字词边界」匹配，不做任意子串匹配：
 * 输入 h 只命中拼音以 h 开头的（红/黑/黄/灰），
 * 输入 se 能命中「黑色」（从第二个字开始匹配），但不会命中「宝石蓝」。
 *
 * 另外支持混输，例如「hei色」「b石蓝」也能命中。
 */

interface Segment {
  raw: string;
  py: string;
  ini: string;
}

interface PoolIndex {
  /** 原文字符串，小写去空格 */
  text: string;
  /** 全拼候选：ü 分别按 v / u 两种输入习惯各存一份 */
  fulls: string[];
  /** 首字母，如 hs */
  initials: string;
  /** 分段候选：基础读音、ü 的 u 写法、多音字修正读音 */
  segmentVariants: Segment[][];
}

/**
 * 多音字修正（按词，逐字给出正确读音）。
 * pinyin-pro 把「藏青」拆成 zang qing，服装语境应为 cang qing。
 * 修正后原读音仍然可用，只是多一条命中路径。
 * 遇到新词直接往这里加：词 -> 逐字拼音数组。
 */
const POLYPHONE_ALIASES: Record<string, string[]> = {
  藏青: ['cang', 'qing'],
  藏蓝: ['cang', 'lan'],
};

const cache = new Map<string, PoolIndex>();

const normalize = (value: string): string => value.toLowerCase().replace(/[\s\u3000]/g, '');

/** ü 统一按输入习惯转成 v（lv / lvse） */
const toV = (value: string): string => value.replace(/ü/g, 'v');
/** 同时保留 u 写法（lu / luse） */
const toU = (value: string): string => value.replace(/ü/g, 'u');

const buildSegments = (chars: string[], pyArr: string[], converter: (v: string) => string): Segment[] =>
  chars.map((char, i) => {
    const py = converter(pyArr[i].toLowerCase());
    return { raw: char, py, ini: py.charAt(0) };
  });

const buildIndex = (name: string): PoolIndex => {
  const pyArr = pinyin(name, { toneType: 'none', type: 'array' }) as string[];
  const chars = Array.from(normalize(name));

  const fullRaw = normalize(pyArr.join(''));
  const fulls = Array.from(new Set([toV(fullRaw), toU(fullRaw)]));
  const initials = toV(normalize(pyArr.map((item) => item.charAt(0)).join('')));

  const segmentVariants: Segment[][] = [];
  const baseSegments = chars.length === pyArr.length ? buildSegments(chars, pyArr, toV) : null;

  if (baseSegments) {
    segmentVariants.push(baseSegments);
    if (fullRaw.includes('ü')) {
      segmentVariants.push(buildSegments(chars, pyArr, toU));
    }

    // 多音字：名称以词开头时，按正确读音替换对应字的分段
    Object.keys(POLYPHONE_ALIASES).forEach((word) => {
      if (!name.startsWith(word)) return;
      const readings = POLYPHONE_ALIASES[word];
      const patched = baseSegments.map((segment) => ({ ...segment }));
      let valid = true;
      readings.forEach((py, i) => {
        if (!patched[i]) {
          valid = false;
          return;
        }
        patched[i].py = py;
        patched[i].ini = py.charAt(0);
      });
      if (valid) segmentVariants.push(patched);
    });
  }

  return { text: normalize(name), fulls, initials, segmentVariants };
};

const getIndex = (name: string): PoolIndex => {
  const cached = cache.get(name);
  if (cached) return cached;
  const built = buildIndex(name);
  cache.set(name, built);
  return built;
};

/**
 * 从任意字词边界开始，按顺序消费整个查询串。
 * 允许拼音与文字混输：hei色 -> hei + 色
 */
const matchFromAnyBoundary = (segments: Segment[], query: string): boolean => {
  // 单字查询只允许从第一个字开始，避免输入 h 命中「玫红」（第二个字是 hong）
  const startLimit = query.length > 1 ? segments.length : 1;
  for (let start = 0; start < startLimit; start += 1) {
    let consumed = 0;
    for (let i = start; i < segments.length && consumed < query.length; i += 1) {
      const rest = query.slice(consumed);
      const segment = segments[i];

      if (rest.startsWith(segment.raw)) {
        consumed += segment.raw.length;
        continue;
      }
      if (segment.py && rest.startsWith(segment.py)) {
        consumed += segment.py.length;
        continue;
      }
      if (segment.ini && rest.startsWith(segment.ini)) {
        consumed += segment.ini.length;
        continue;
      }
      break;
    }
    if (consumed === query.length) return true;
  }
  return false;
};

/**
 * @param name 池子里的名称，例如「黑色」「XL」
 * @param rawQuery 输入框内容
 * @returns 是否应该显示该名称；输入为空时全部显示
 */
export const matchPoolItem = (name: string, rawQuery: string): boolean => {
  const query = normalize(rawQuery);
  if (!query) return true;

  const index = getIndex(name);
  if (!index.text) return true;

  const queryV = toV(query);

  // 1. 文字匹配
  if (index.text.includes(query)) return true;

  // 2. 全拼前缀
  if (index.fulls.some((full) => full.startsWith(queryV))) return true;

  // 3. 首字母前缀
  if (index.initials.startsWith(queryV)) return true;

  // 4. 字词边界匹配（含混输与多音字）
  if (index.segmentVariants.some((segments) => matchFromAnyBoundary(segments, queryV))) return true;

  return false;
};

/** 提供给界面用的匹配说明 */
export const POOL_MATCH_HINT = '支持文字 / 全拼 / 首字母，如“黑”“heise”“hs”';
