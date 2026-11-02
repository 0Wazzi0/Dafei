/**
 * 颜色池 / 尺码池 / 部位池的读写。
 *
 * 约束：localStorage 的键名与取值范围不可更改，用户机器上已有数据依赖这些键。
 * 重构前这些函数以模块级工具函数的形式写在 FormEditor.tsx 顶部，
 * 现抽出到 domain 层。
 */

export const DEFAULT_COLORS = ['红', '绿', '蓝', '黑', '白', '黄', '藏青', '灰'];
export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
export const DEFAULT_SECTIONS = ['袖口', '前幅', '后幅'];

/** localStorage 键名。改这里等于让老用户的池子丢失。 */
export const POOL_KEYS = {
  colors: 'pool_colors',
  sizes: 'pool_sizes',
  sections: 'pool_sections',
  sectionsVersion: 'pool_sections_v2'
} as const;

/** 部位池版本标记位，用于「一次性补齐默认部位」的迁移 */
const SECTIONS_VERSION = '1';

const safeParseArray = (raw: string | null): string[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : null;
  } catch {
    // 原实现没有 try/catch，localStorage 内容损坏会直接抛错导致组件挂载失败。
    // 这里降级为默认池，避免整个编辑页白屏。
    return null;
  }
};

/** 读取普通池（颜色 / 尺码） */
export const getStoredPool = (key: string, defaults: string[]): string[] => {
  const parsed = safeParseArray(localStorage.getItem(key));
  return parsed ?? [...defaults];
};

/**
 * 读取部位池。
 * 首次运行时把 DEFAULT_SECTIONS 合并进已有池并写回版本标记，
 * 保证老用户升级后能看到新增的默认部位。
 */
export const getStoredSectionPool = (): string[] => {
  const parsed = safeParseArray(localStorage.getItem(POOL_KEYS.sections));
  if (!parsed) return [...DEFAULT_SECTIONS];

  if (localStorage.getItem(POOL_KEYS.sectionsVersion) === SECTIONS_VERSION) return parsed;

  const migrated = [...parsed, ...DEFAULT_SECTIONS.filter((item) => !parsed.includes(item))];
  localStorage.setItem(POOL_KEYS.sections, JSON.stringify(migrated));
  localStorage.setItem(POOL_KEYS.sectionsVersion, SECTIONS_VERSION);
  return migrated;
};

/** 写回池 */
export const saveStoredPool = (key: string, pool: string[]): void => {
  localStorage.setItem(key, JSON.stringify(pool));
};
