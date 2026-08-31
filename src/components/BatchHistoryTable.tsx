import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  FileText,
  Printer, 
  Trash2, 
  Edit3, 
  Search, 
  TableProperties
} from 'lucide-react';
import { BatchRecord, Recipe } from '../types';

interface BatchHistoryTableProps {
  batches: BatchRecord[];
  recipe: Recipe;
  onEditBatch: (batchNumber: number) => void;
  onDeleteBatch: (batchId: string) => void;
  onFinishShift: () => void;
  onExportExcel: () => void;
  onExportPdf?: () => void;
  onPrintReport: () => void;
}

export const BatchHistoryTable: React.FC<BatchHistoryTableProps> = ({
  batches,
  recipe,
  onEditBatch,
  onDeleteBatch,
  onFinishShift,
  onExportExcel,
  onExportPdf,
  onPrintReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBatches = batches.filter((b) => {
    const term = searchTerm.toLowerCase();
    return (
      b.batchNumber.toString().includes(term) ||
      b.recipeCode.toLowerCase().includes(term) ||
      (b.notes && b.notes.toLowerCase().includes(term))
    );
  });

  const totalActualSum = batches.reduce((sum, b) => sum + b.totalActualKg, 0);
  const totalTargetSum = batches.reduce((sum, b) => sum + b.totalTargetKg, 0);
  const totalDevSum = Number((totalActualSum - totalTargetSum).toFixed(2));

  return (
    <div className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-2xl p-4 sm:p-6 shadow-sm transition-colors space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#EBEBE6] dark:border-[#26282E] pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#F4F4F0] dark:bg-[#202229] border border-[#E0E0D9] dark:border-[#2C2F38] text-[#111215] dark:text-white flex items-center justify-center font-bold">
            <TableProperties className="w-5 h-5 text-[#E63B00]" />
          </div>
          <div>
            <h3 className="font-black text-[#111215] dark:text-white text-lg">
              Журнал замесов смены
            </h3>
            <p className="text-xs sm:text-sm text-[#717684] dark:text-[#8E95A5] font-mono">
              Всего замесов: <strong className="text-[#111215] dark:text-white">{batches.length}</strong> • Тоннаж: <strong className="text-[#111215] dark:text-white">{(totalActualSum / 1000).toFixed(3)} т</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-center">
          {batches.length > 0 && (
            <>
              {onExportPdf && (
                <button
                  onClick={onExportPdf}
                  id="btn-export-pdf-table"
                  className="px-3.5 py-2 rounded-xl bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs sm:text-sm font-bold flex items-center gap-2 transition"
                  title="Скачать официальный сменный акт в PDF"
                >
                  <FileText className="w-4 h-4 text-[#E63B00]" />
                  <span>PDF Акт</span>
                </button>
              )}

              <button
                onClick={onExportExcel}
                id="btn-export-excel-table"
                className="px-3.5 py-2 rounded-xl bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs sm:text-sm font-bold flex items-center gap-2 transition"
                title="Экспорт в Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Excel</span>
              </button>

              <button
                onClick={onPrintReport}
                id="btn-print-report-table"
                className="px-3.5 py-2 rounded-xl bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs sm:text-sm font-bold flex items-center gap-2 transition"
                title="Печать акта смены"
              >
                <Printer className="w-4 h-4" />
                <span>Печать</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Filter */}
      {batches.length > 5 && (
        <div className="relative">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по номеру замеса..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#F9F9F7] dark:bg-[#181A20] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl text-sm text-[#111215] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#E63B00]"
          />
        </div>
      )}

      {/* Main Table */}
      {batches.length === 0 ? (
        <div className="py-12 text-center text-[#717684] space-y-2">
          <TableProperties className="w-10 h-10 mx-auto opacity-30 text-[#E63B00]" />
          <p className="font-black text-base text-[#111215] dark:text-white">В текущей смене пока нет внесённых замесов</p>
          <p className="text-sm text-[#717684] dark:text-[#8E95A5]">
            Введите фактический вес компонентов на пульте и нажмите «Зафиксировать замес» (Enter)
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
          <table className="w-full text-left text-sm font-mono border-collapse">
            <thead>
              <tr className="bg-[#F9F9F7] dark:bg-[#181A20] text-[#717684] dark:text-[#8E95A5] uppercase text-xs tracking-wider border-b border-[#EBEBE6] dark:border-[#26282E]">
                <th className="py-3 px-3.5 font-black">№</th>
                <th className="py-3 px-3.5 font-black">Время</th>
                {recipe.components.map((comp) => (
                  <th key={comp.id} className="py-3 px-2.5 text-right">
                    <span className="text-[#111215] dark:text-white block font-black text-xs sm:text-sm">{comp.name.slice(0, 14)}</span>
                    <span className="text-xs text-[#717684] dark:text-[#8E95A5] block font-normal">{comp.targetWeightKg} кг</span>
                  </th>
                ))}
                <th className="py-3 px-3.5 text-right font-black">Факт (кг)</th>
                <th className="py-3 px-3.5 text-right font-black">Откл.</th>
                <th className="py-3 px-2.5 text-center font-black">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBEBE6] dark:divide-[#22242B] bg-white dark:bg-[#15171C]">
              {filteredBatches.map((b) => {
                const isOver = b.totalDeviationKg > 0;
                const isUnder = b.totalDeviationKg < 0;
                const timeStr = new Date(b.timestamp).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr
                    key={b.id}
                    id={`batch-row-${b.batchNumber}`}
                    className="hover:bg-[#F9F9F7] dark:hover:bg-[#191B21] transition group"
                  >
                    <td className="py-3 px-3.5 font-black text-[#111215] dark:text-white tabular-nums text-base">
                      №{b.batchNumber}
                    </td>
                    <td className="py-3 px-3.5 text-[#717684] dark:text-[#8E95A5] tabular-nums font-medium text-xs sm:text-sm">{timeStr}</td>

                    {/* Component actual values */}
                    {recipe.components.map((comp) => {
                      const item = b.items.find((i) => i.componentId === comp.id);
                      const actualKg = item ? item.actualKg : 0;
                      const dev = item ? item.deviationKg : 0;

                      return (
                        <td key={comp.id} className="py-3 px-2.5 text-right tabular-nums">
                          <span className="text-[#111215] dark:text-white font-bold text-sm sm:text-base">{actualKg}</span>
                          {dev !== 0 && (
                            <span
                              className={`text-xs ml-1.5 font-bold ${
                                dev > 0 ? 'text-[#E63B00]' : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {dev > 0 ? `+${dev}` : dev}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    <td className="py-3 px-3.5 text-right font-black text-[#111215] dark:text-white text-base sm:text-lg tabular-nums">
                      {b.totalActualKg}
                    </td>

                    <td className="py-3 px-3.5 text-right tabular-nums">
                      <span
                        className={`font-black text-sm sm:text-base ${
                          isOver ? 'text-[#E63B00]' : isUnder ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {b.totalDeviationKg > 0 ? `+${b.totalDeviationKg}` : b.totalDeviationKg}
                      </span>
                    </td>

                    <td className="py-3 px-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 opacity-70 group-hover:opacity-100">
                        <button
                          onClick={() => onEditBatch(b.batchNumber)}
                          className="p-1.5 rounded-lg hover:bg-[#F0F0EB] dark:hover:bg-[#252830] text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white transition"
                          title={`Редактировать замес №${b.batchNumber}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Удалить замес №${b.batchNumber}?`)) {
                              onDeleteBatch(b.id);
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-[#9CA3AF] hover:text-rose-600 transition"
                          title={`Удалить замес №${b.batchNumber}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer with Totals */}
            <tfoot>
              <tr className="bg-[#F9F9F7] dark:bg-[#181A20] font-black border-t border-[#E0E0D9] dark:border-[#2D3039] text-[#111215] dark:text-white">
                <td colSpan={2} className="py-3.5 px-3.5 uppercase text-xs sm:text-sm">
                  ИТОГО ({batches.length} замесов):
                </td>
                {recipe.components.map((comp) => {
                  const compTotal = batches.reduce((acc, b) => {
                    const item = b.items.find((i) => i.componentId === comp.id);
                    return acc + (item ? item.actualKg : 0);
                  }, 0);

                  return (
                    <td key={comp.id} className="py-3.5 px-2.5 text-right text-[#111215] dark:text-white font-bold text-sm sm:text-base tabular-nums">
                      {compTotal.toFixed(1)}
                    </td>
                  );
                })}
                <td className="py-3.5 px-3.5 text-right text-[#111215] dark:text-white font-black text-base sm:text-lg tabular-nums">
                  {totalActualSum.toFixed(1)}
                </td>
                <td
                  className={`py-3.5 px-3.5 text-right font-black text-sm sm:text-base tabular-nums ${
                    totalDevSum > 0 ? 'text-[#E63B00]' : totalDevSum < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {totalDevSum > 0 ? `+${totalDevSum}` : totalDevSum} кг
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
