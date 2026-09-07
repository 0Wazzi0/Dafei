export interface MatrixHeader {
  id: string;
  name: string;
}

export interface CuttingForm {
  id: string;
  styleNumber: string; // 订单号
  customer: string; // 客户
  bedNumber: string; // 床号
  createdAt: number;
  updatedAt: number;
  
  // The Matrix Data
  rows: MatrixHeader[]; // Colors (Vertical axis)
  cols: MatrixHeader[]; // Sizes (Horizontal axis)
  // Data stored as key: `${rowId}_${colId}` -> quantity
  data: Record<string, number>;
  amountPerPiece?: number; // 单价金额
  additionalFee?: number; // 其他费用
  remark?: string; // 订单备注
  totalAmount?: number; // 直接输入的总金额
}

export type ViewMode = 'list' | 'edit' | 'create';


