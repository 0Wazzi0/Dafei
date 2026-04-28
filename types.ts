export interface MatrixHeader {
  id: string;
  name: string;
}

export interface CuttingForm {
  id: string;
  styleNumber: string; // 款号
  customer: string; // 客户
  bedNumber: string; // 床号
  createdAt: number;
  updatedAt: number;
  
  // The Matrix Data
  rows: MatrixHeader[]; // Colors (Vertical axis)
  cols: MatrixHeader[]; // Sizes (Horizontal axis)
  // Data stored as key: `${rowId}_${colId}` -> quantity
  data: Record<string, number>;
}

export type ViewMode = 'list' | 'edit' | 'create';