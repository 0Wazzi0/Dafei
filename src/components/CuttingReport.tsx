
import { defineComponent } from 'vue';
import { CuttingForm } from '../types.ts';
import { orderAmount, orderPieces } from '../domain/money.ts';
import { buildBundleList, buildBundleMap } from '../domain/bundle.ts';
import { buildColorTotals, buildSizeTotals, buildSummaryMatrix } from '../domain/matrix.ts';
import { IconArrowLeft, IconPrinter } from './Icons.ts';

export default defineComponent({
  name: 'CuttingReport',
  props: {
    form: {
      type: Object as () => CuttingForm,
      required: true
    }
  },
  computed: {
    totalPieces(): number {
      return orderPieces(this.form);
    },
    
    // 总金额：唯一实现见 domain/money.ts
    totalAmount(): number {
      return orderAmount(this.form, this.totalPieces);
    },
    
    
    // 同名合并汇总：唯一实现见 domain/matrix.ts
    summaryMatrix() {
      return buildSummaryMatrix(this.form.rows, this.form.cols, this.form.data);
    },
    // 颜色小计：唯一实现见 domain/matrix.ts
    colorTotals(): Record<string, number> {
      return buildColorTotals(this.form.rows, this.form.cols, this.form.data);
    },
    // 尺码小计：唯一实现见 domain/matrix.ts
    sizeTotals(): Record<string, number> {
      return buildSizeTotals(this.form.rows, this.form.cols, this.form.data);
    },
    // 扎号分配：唯一实现见 domain/bundle.ts，顺序固定「尺码列外层、颜色行内层」
    bundleMap(): Map<string, number> {
      return buildBundleMap(this.form.rows, this.form.cols, this.form.data);
    },
    // 扎明细：唯一实现见 domain/bundle.ts
    bundleList() {
      return buildBundleList(this.form.rows, this.form.cols, this.form.data);
    }
  },
  methods: {
    getCellValue(rowId: string, colId: string) {
      return this.form.data[`${rowId}_${colId}`] || 0;
    },
    getBundleNo(rowId: string, colId: string) {
      return this.bundleMap.get(`${rowId}_${colId}`) || '';
    },
    getSummaryRowTotal(colorName: string) {
      return Object.values(this.summaryMatrix.matrix[colorName] || {}).reduce((a: number, b: number) => a + b, 0);
    },
    getSummaryColTotal(sizeName: string) {
      // Fix: summaryMatrix is now correctly typed as string[]
      return this.summaryMatrix.colorNames.reduce((sum: number, color: string) => {
        return sum + (this.summaryMatrix.matrix[color][sizeName] || 0);
      }, 0);
    },
    print() {
      window.print();
    }
  },
  template: `
    <div class="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white">
      <div class="max-w-5xl mx-auto mb-6 flex justify-between items-center no-print">
        <button @click="$emit('back')" class="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium transition-colors">
          <icon-arrow-left :size="20" /> 返回编辑
        </button>
        <button @click="print" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95">
          <icon-printer :size="20" /> 立即打印报表
        </button>
      </div>

      <div class="max-w-5xl mx-auto bg-white shadow-2xl p-10 print:shadow-none print:p-2 font-sans text-black">
        <h1 class="text-3xl font-black text-center border-b-4 border-black pb-4 mb-6 uppercase tracking-widest">裁床单</h1>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm bg-gray-50 p-4 border border-black print:bg-white">
          <div><span class="font-bold">款号 ：</span>{{ form.styleNumber || '-' }}</div>
          <div><span class="font-bold">客户 ：</span>{{ form.customer || '-' }}</div>
          <div><span class="font-bold">总数 ：</span>{{ totalPieces }}</div>
          <div><span class="font-bold">床号 ：</span>{{ form.bedNumber || '-' }}</div>
          <div class="col-span-2"><span class="font-bold">下单日期 ：</span>{{ new Date(form.createdAt).toLocaleString() }}</div>
          <div class="col-span-2"><span class="font-bold">备注 ：</span>{{ form.remark || '' }}</div>
        </div>

        <!-- 琛ㄦ牸涓€锛氭墡鍙峰強数量鍒嗗竷鐭╅樀 -->
        <div class="mb-10">
          <h2 class="text-lg font-bold mb-3 flex items-center gap-2">
            <span class="w-1.5 h-6 bg-blue-600"></span>
            表格一：扎号及数量分布 
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse border-2 border-black text-center">
              <thead>
                <tr class="bg-gray-100 print:bg-white">
                  <th class="border border-black p-2 font-bold w-28 text-xs">颜色 \\ 尺码</th>
                  <th v-for="col in form.cols" :key="col.id" class="border border-black p-2 font-bold text-xs">{{ col.name }}</th>
                  <th class="border border-black p-2 font-bold bg-yellow-50 print:bg-white">小计</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in form.rows" :key="row.id">
                  <td class="border border-black p-2 font-bold bg-gray-50 print:bg-white text-xs">{{ row.name }}</td>
                  <td v-for="col in form.cols" :key="col.id" class="border border-black p-0 h-10">
                    <div v-if="getBundleNo(row.id, col.id)" class="flex h-full items-stretch">
                      <!-- 宸︿晶锛氭墡鍙?灞呬腑 -->
                      <div class="flex-1 flex items-center justify-center border-r border-black bg-blue-50/30 print:bg-white text-[10px] font-bold text-blue-700">
                        {{ getBundleNo(row.id, col.id) }}
                      </div>
                      <!-- 鍙充晶锛氭暟閲?灞呬腑 -->
                      <div class="flex-1 flex items-center justify-center font-black text-sm">
                        {{ getCellValue(row.id, col.id) }}
                      </div>
                    </div>
                    <span v-else class="text-gray-100">-</span>
                  </td>
                  <td class="border border-black p-2 font-bold bg-yellow-50 print:bg-white text-blue-700">
                    {{ colorTotals[row.id] || 0 }}
                  </td>
                </tr>
                <tr class="bg-yellow-100/50 font-bold print:bg-white">
                  <td class="border border-black p-2">小计</td>
                  <td v-for="col in form.cols" :key="col.id" class="border border-black p-2">{{ sizeTotals[col.id] || 0 }}</td>
                  <td class="border border-black p-2 text-lg text-blue-700 underline font-black">{{ totalPieces }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-[9px] text-gray-400 mt-1 italic">* 单元格布局：左侧为扎号，右侧为该扎件数。</p>
        </div>

        <!-- 琛ㄦ牸浜岋細颜色鍙婂昂鐮佹眹鎬荤煩闃?(鍚屽悕鍚堝苟閫昏緫) -->
        <div class="mb-10">
          <h2 class="text-lg font-bold mb-3 flex items-center gap-2">
            <span class="w-1.5 h-6 bg-emerald-600"></span>
            表格二：同颜色同尺码汇总
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse border-2 border-black text-center text-sm">
              <thead>
                <tr class="bg-gray-100 print:bg-white">
                  <th class="border border-black p-2 font-bold w-28">颜色 </th>
                  <th v-for="name in summaryMatrix.sizeNames" :key="'sum-col-'+name" class="border border-black p-2 font-bold">{{ name }}</th>
                  <th class="border border-black p-2 font-bold bg-yellow-50 print:bg-white">行汇总</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="cName in summaryMatrix.colorNames" :key="'sum-row-'+cName">
                  <td class="border border-black p-2 font-bold bg-gray-50 print:bg-white">{{ cName }}</td>
                  <td v-for="sName in summaryMatrix.sizeNames" :key="'sum-cell-'+cName+'-'+sName" class="border border-black p-2">
                    {{ summaryMatrix.matrix[cName][sName] || '' }}
                  </td>
                  <td class="border border-black p-2 font-bold bg-yellow-50 print:bg-white text-blue-700">{{ getSummaryRowTotal(cName) }}</td>
                </tr>
                <tr class="bg-yellow-100/50 font-bold print:bg-white">
                  <td class="border border-black p-2">列汇总</td>
                  <td v-for="sName in summaryMatrix.sizeNames" :key="'sum-footer-'+sName" class="border border-black p-2">{{ getSummaryColTotal(sName) }}</td>
                  <td class="border border-black p-2 text-lg text-blue-700 underline font-black">{{ totalPieces }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-[9px] text-gray-400 mt-1 italic">* 此表已按名称自动合并重复的颜色或尺码行/列并计算总和。</p>
        </div>

        <!-- 琛ㄦ牸涓夛細鏄庣粏 -->
        <div>
          <h2 class="text-lg font-bold mb-3 flex items-center gap-2">
            <span class="w-1.5 h-6 bg-purple-600"></span>
            表格三：扎明细清单
          </h2>
          <div class="grid grid-cols-2 gap-x-6">
             <table v-for="(chunk, idx) in [bundleList.slice(0, Math.ceil(bundleList.length / 2)), bundleList.slice(Math.ceil(bundleList.length / 2))]" :key="'chunk-'+idx" class="w-full border-collapse border border-black text-[11px]">
                <thead>
                  <tr class="bg-gray-100 print:bg-white">
                    <th class="border border-black p-1 w-12">扎号</th>
                    <th class="border border-black p-1">颜色</th>
                    <th class="border border-black p-1 w-16">尺码</th>
                    <th class="border border-black p-1 w-12">数量</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in chunk" :key="item.no">
                    <td class="border border-black p-1 text-center font-bold">{{ item.no }}</td>
                    <td class="border border-black p-1 text-center">{{ item.color }}</td>
                    <td class="border border-black p-1 text-center font-medium">{{ item.size }}</td>
                    <td class="border border-black p-1 text-center font-black text-blue-700">{{ item.qty }}</td>
                  </tr>
                </tbody>
             </table>
          </div>
        </div>

        <div class="mt-12 pt-6 border-t-2 border-black flex justify-between text-[10px] font-bold uppercase tracking-widest">
           <span>制单：_______________</span>
           <span>审核：_______________</span>
           <span>裁剪：_______________</span>
           <span>打印日期：{{ new Date().toLocaleString() }}</span>
        </div>
      </div>
    </div>
  `
});








