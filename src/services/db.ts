import { CuttingForm } from '../types';

const DB_NAME = 'FabricCutDB';
const STORE_NAME = 'forms';
const DB_VERSION = 1;

/**
 * 数据库连接单例。
 *
 * 重构前每次读写都新开一个连接且从不关闭。新建订单的草稿自动保存是
 * 深度 watch 触发的，连续输入时会高频调用 saveFormToDB，导致连接不断累积。
 *
 * 现在全应用共用一个连接；连接失效（被浏览器关闭、或别处触发升级）时
 * 自动丢弃缓存，下次调用重新打开。
 */
let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;

      // 有其它上下文请求升级版本时，必须让出连接，否则升级会一直阻塞
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };

      // 连接被意外关闭（例如浏览器回收）时，下次调用重新打开
      db.onclose = () => {
        dbPromise = null;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
};

export const saveFormToDB = async (form: CuttingForm): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(form);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getFormsFromDB = async (): Promise<CuttingForm[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as CuttingForm[];
      results.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getLastBedNumber = async (): Promise<number> => {
  const forms = await getFormsFromDB();
  if (forms.length === 0) return 0;
  
  // Find the highest bed number (handling both string and number types)
  const numbers = forms.map(f => parseInt(f.bedNumber || '0', 10)).filter(n => !isNaN(n));
  return numbers.length > 0 ? Math.max(...numbers) : 0;
};

export const getFormById = async (id: string): Promise<CuttingForm | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteFormFromDB = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * 获取所有唯一的客户名称（带使用次数和时间）
 */
export const getUniqueCustomers = async (): Promise<{value: string, lastUsed: number, count: number}[]> => {
  const forms = await getFormsFromDB();
  const customerMap = new Map<string, {lastUsed: number, count: number}>();
  
  forms.forEach(f => {
    if (f.customer && f.customer.trim()) {
      const existing = customerMap.get(f.customer);
      if (existing) {
        existing.count++;
        // 更新为最近的更新时间
        if (f.updatedAt > existing.lastUsed) {
          existing.lastUsed = f.updatedAt;
        }
      } else {
        customerMap.set(f.customer, {
          lastUsed: f.updatedAt,
          count: 1
        });
      }
    }
  });
  
  // 转换为数组并按最后使用时间降序排序
  return Array.from(customerMap.entries())
    .map(([value, data]) => ({ value, ...data }))
    .sort((a, b) => b.lastUsed - a.lastUsed);
};

/**
 * 获取所有唯一的款号（带使用次数和时间）
 */
export const getUniqueStyleNumbers = async (): Promise<{value: string, lastUsed: number, count: number}[]> => {
  const forms = await getFormsFromDB();
  const styleNumberMap = new Map<string, {lastUsed: number, count: number}>();
  
  forms.forEach(f => {
    if (f.styleNumber && f.styleNumber.trim()) {
      const existing = styleNumberMap.get(f.styleNumber);
      if (existing) {
        existing.count++;
        // 更新为最近的更新时间
        if (f.updatedAt > existing.lastUsed) {
          existing.lastUsed = f.updatedAt;
        }
      } else {
        styleNumberMap.set(f.styleNumber, {
          lastUsed: f.updatedAt,
          count: 1
        });
      }
    }
  });
  
  // 转换为数组并按最后使用时间降序排序
  return Array.from(styleNumberMap.entries())
    .map(([value, data]) => ({ value, ...data }))
    .sort((a, b) => b.lastUsed - a.lastUsed);
};

/**
 * 获取指定款号最近一次使用的单价
 */
export const getLatestAmountPerPieceByStyleNumber = async (styleNumber: string): Promise<number | undefined> => {
  const target = styleNumber.trim();
  if (!target) return undefined;

  const forms = await getFormsFromDB();
  const matched = forms
    .filter((form) => (
      form.styleNumber?.trim() === target &&
      form.amountPerPiece !== undefined &&
      form.amountPerPiece !== null &&
      Number.isFinite(Number(form.amountPerPiece))
    ))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return matched.length > 0 ? Number(matched[0].amountPerPiece) : undefined;
};

/**
 * 从历史记录中删除指定的客户或款号（仅标记，实际删除需要过滤表单）
 * 注意：由于数据存储在表单中，我们无法直接删除，只能在显示时过滤
 */
export const removeFromHistory = async (type: 'customer' | 'styleNumber', value: string): Promise<void> => {
  // 这是一个软删除，实际上我们不在数据库中删除，因为数据是关联到具体表单的
  // 真正的删除操作应该在 FormEditor 中通过 localStorage 实现
  const key = `hidden_${type}s`;
  const hidden = JSON.parse(localStorage.getItem(key) || '[]');
  if (!hidden.includes(value)) {
    hidden.push(value);
    localStorage.setItem(key, JSON.stringify(hidden));
  }
};

/**
 * 获取被隐藏的历史记录
 */
export const getHiddenHistory = (type: 'customer' | 'styleNumber'): string[] => {
  const key = `hidden_${type}s`;
  return JSON.parse(localStorage.getItem(key) || '[]');
};

/**
 * 导出所有数据为 JSON 文件
 */
export const exportAllData = async (): Promise<string> => {
  const forms = await getFormsFromDB();
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    database: DB_NAME,
    forms: forms
  };
  return JSON.stringify(exportData, null, 2);
};

/**
 * 从 JSON 导入数据。
 *
 * 重构前每条订单各开一个事务，导入 1000 条就是 1000 个事务。
 * 现改为单个 readwrite 事务批量写入。
 *
 * 单条记录如果在同步阶段写入失败（例如包含不可克隆的值），只跳过该条并计数，
 * 不影响整批；事务级失败才判定整体失败。
 */
export const importData = async (jsonData: string): Promise<{success: boolean, count: number, error?: string}> => {
  try {
    const payload = JSON.parse(jsonData);
    if (!payload.forms || !Array.isArray(payload.forms)) {
      return { success: false, count: 0, error: '无效的数据格式' };
    }

    const db = await openDB();

    return await new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let succeeded = 0;
      let rejected = 0;

      for (const form of payload.forms) {
        try {
          const request = store.put(form);
          request.onsuccess = () => { succeeded += 1; };
          request.onerror = (event) => {
            // 阻止单条失败冒泡导致整个事务回滚
            event.preventDefault();
            event.stopPropagation();
            rejected += 1;
            console.error('导入单条数据失败:', request.error);
          };
        } catch (err) {
          rejected += 1;
          console.error('导入单条数据失败:', err);
        }
      }

      transaction.oncomplete = () => {
        if (succeeded === 0 && rejected > 0) {
          resolve({ success: false, count: 0, error: '所有记录均导入失败' });
          return;
        }
        resolve({ success: true, count: succeeded });
      };

      transaction.onerror = () => {
        resolve({ success: false, count: 0, error: transaction.error?.message || '导入失败' });
      };

      transaction.onabort = () => {
        resolve({ success: false, count: 0, error: '导入事务被中止' });
      };
    });
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

/**
 * 清空所有数据
 */
export const clearAllData = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
