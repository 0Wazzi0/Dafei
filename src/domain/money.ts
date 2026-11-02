/**
 * 订单金额与件数计算 —— 全项目唯一实现。
 *
 * 重构前这套规则散落在三处（FormEditor.calculatedTotalAmount、
 * FormList.calculateOrderAmount、CuttingReport.totalAmount），
 * 其中 FormEditor 那份不认 totalAmount，导致只有"直接输入总金额"的
 * 历史订单在编辑页显示 0.00，而列表和报表显示正确金额。
 * 现统一到本文件，任何地方算金额都必须经过 orderAmount。
 */

/** 金额计算所需的字段子集。历史数据里数值字段可能是字符串，因此放宽类型。 */
export interface MoneyFields {
  data?: Record<string, number> | null;
  amountPerPiece?: number | string | null;
  additionalFee?: number | string | null;
  totalAmount?: number | string | null;
}

/**
 * 单价是否为有效数字。
 * 空字符串、null、undefined 都视为"未填单价"，而不是 0。
 * 这个区分很关键：未填单价要回退到 totalAmount。
 */
export const hasUnitPrice = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return Number.isFinite(Number(value));
};

/** 二维表格里所有数量之和 */
export const sumPieces = (data: Record<string, number> | null | undefined): number => {
  if (!data) return 0;
  let total = 0;
  for (const value of Object.values(data)) {
    total += Number(value) || 0;
  }
  return total;
};

/** 订单总件数 */
export const orderPieces = (form: Pick<MoneyFields, 'data'>): number => sumPieces(form.data);

/**
 * 订单总金额。
 *
 * 规则（按优先级）：
 * 1. 有有效单价 → 单价 × 件数 + 其他费用
 * 2. 无有效单价、但有 totalAmount → 直接使用 totalAmount
 *    （旧版"直接输入总金额"模式留下的数据，必须继续可读）
 * 3. 都没有 → 仅其他费用
 *
 * @param pieces 可选。调用方已算过件数时传入，避免重复遍历。
 */
export const orderAmount = (form: MoneyFields, pieces?: number): number => {
  const totalPieces = pieces ?? sumPieces(form.data);
  const fee = Number(form.additionalFee) || 0;

  if (hasUnitPrice(form.amountPerPiece)) {
    return Number(form.amountPerPiece) * totalPieces + fee;
  }

  if (form.totalAmount !== undefined && form.totalAmount !== null && form.totalAmount !== '') {
    return Number(form.totalAmount) || 0;
  }

  return fee;
};

/**
 * 保存订单时 totalAmount 字段的去留。
 *
 * - 有有效单价：返回 undefined（金额可由单价推导，保持原有行为，不写入冗余字段）
 * - 无有效单价：原样保留 totalAmount
 *
 * 第二分支修复了一个正在销毁数据的问题：重构前 saveForm 无条件把
 * totalAmount 置为 undefined，用户只要打开一张旧订单点一次保存，
 * 那张单的总金额就永久丢失了。
 */
export const totalAmountOnSave = (form: MoneyFields): number | undefined => {
  if (hasUnitPrice(form.amountPerPiece)) return undefined;

  const value = form.totalAmount;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};
