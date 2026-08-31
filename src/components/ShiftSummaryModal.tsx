import React, { useState } from 'react';
import { 
  CheckCircle2, 
  FileSpreadsheet, 
  FileText,
  Printer, 
  RotateCcw, 
  X, 
  ArrowUpRight
} from 'lucide-react';
import { ShiftSummary, Recipe } from '../types';
import { exportShiftToExcel } from '../lib/exportExcel';
import { exportShiftToPdf } from '../lib/exportPdf';

interface ShiftSummaryModalProps {
  shift: ShiftSummary;
  recipe?: Recipe;
  onClose: () => void;
  onPrint: () => void;
  onStartNewShift: () => void;
}

export const ShiftSummaryModal: React.FC<ShiftSummaryModalProps> = ({
  shift,
  recipe,
  onClose,
  onPrint,
  onStartNewShift,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const isOver = shift.totalDeviationKg > 0;
  const isUnder = shift.totalDeviationKg < 0;

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportShiftToPdf(shift, recipe);
    } catch (e) {
      console.error('PDF export failed', e);
      alert('Ошибка при генерации PDF. Попробуйте распечатать через диалог печати.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div 
        id="shift-summary-modal"
        className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#111215] dark:text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EBEBE6] dark:border-[#26282E] flex items-center justify-between sticky top-0 bg-white dark:bg-[#15171C] z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-black">
              <CheckCircle2 className="w-4 h-4 text-[#E63B00]" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#111215] dark:text-white">
                Сменный рапорт: {shift.recipeCode} ({shift.shiftDate})
              </h2>
              <p className="text-xs text-[#717684] dark:text-[#8E95A5] font-mono">
                Смена №{shift.shiftNumber} • Оператор: {shift.operatorName} • {shift.startTime} – {shift.endTime}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="btn-close-summary-modal"
            className="p-1.5 rounded-lg hover:bg-[#F0F0EB] dark:hover:bg-[#202229] text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* KPI Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-3.5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
              <span className="text-[10px] uppercase font-bold text-[#717684] dark:text-[#8E95A5] block">Замесов</span>
              <span className="text-2xl font-black font-mono text-[#111215] dark:text-white mt-1 block tabular-nums">
                {shift.batchesCount} <span className="text-xs font-normal text-[#717684]">шт</span>
              </span>
            </div>

            <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-3.5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
              <span className="text-[10px] uppercase font-bold text-[#717684] dark:text-[#8E95A5] block">План (Норма)</span>
              <span className="text-2xl font-black font-mono text-[#5E6472] dark:text-[#A0A6B5] mt-1 block tabular-nums">
                {(shift.totalTargetWeightKg / 1000).toFixed(3)} <span className="text-xs font-normal">т</span>
              </span>
            </div>

            <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-3.5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
              <span className="text-[10px] uppercase font-bold text-[#717684] dark:text-[#8E95A5] block">Факт (Вес)</span>
              <span className="text-2xl font-black font-mono text-[#111215] dark:text-white mt-1 block tabular-nums">
                {(shift.totalActualWeightKg / 1000).toFixed(3)} <span className="text-xs font-normal">т</span>
              </span>
            </div>

            <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-3.5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
              <span className="text-[10px] uppercase font-bold text-[#717684] dark:text-[#8E95A5] block">Отклонение</span>
              <span
                className={`text-2xl font-black font-mono mt-1 block tabular-nums ${
                  isOver ? 'text-[#E63B00]' : isUnder ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {shift.totalDeviationKg > 0 ? `+${shift.totalDeviationKg}` : shift.totalDeviationKg}{' '}
                <span className="text-xs font-normal">кг</span>
              </span>
            </div>
          </div>

          {/* Component Consumption Table */}
          <div className="space-y-2">
            <h3 className="text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] font-mono tracking-wider">
              Расход сырья по компонентам смеси:
            </h3>

            <div className="overflow-x-auto rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-[#F8F8F5] dark:bg-[#1A1C22] text-[#717684] dark:text-[#8E95A5] text-[10px] uppercase tracking-wider border-b border-[#EBEBE6] dark:border-[#26282E]">
                    <th className="py-2.5 px-3 font-sans font-bold text-[#111215] dark:text-white">Компонент</th>
                    <th className="py-2.5 px-2">Фракция</th>
                    <th className="py-2.5 px-3 text-right">Норма (кг)</th>
                    <th className="py-2.5 px-3 text-right">Факт (кг)</th>
                    <th className="py-2.5 px-3 text-right">Разница (кг)</th>
                    <th className="py-2.5 px-3 text-right">Откл. (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBEBE6] dark:divide-[#22242B] bg-white dark:bg-[#15171C]">
                  {shift.componentTotals.map((c) => {
                    const compOver = c.totalDeviationKg > 0;
                    const compUnder = c.totalDeviationKg < 0;

                    return (
                      <tr key={c.id} className="hover:bg-[#F9F9F7] dark:hover:bg-[#191B21]">
                        <td className="py-2.5 px-3 font-bold text-[#111215] dark:text-white font-sans">{c.name}</td>
                        <td className="py-2.5 px-2 text-[#717684] dark:text-[#8E95A5]">{c.fraction || '—'}</td>
                        <td className="py-2.5 px-3 text-right text-[#5E6472] dark:text-[#A0A6B5] tabular-nums">
                          {c.totalTargetKg}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#111215] dark:text-white tabular-nums">
                          {c.totalActualKg}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <span
                            className={`font-bold ${
                              compOver ? 'text-[#E63B00]' : compUnder ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {c.totalDeviationKg > 0 ? `+${c.totalDeviationKg}` : c.totalDeviationKg}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <span
                            className={
                              compOver ? 'text-[#E63B00]' : compUnder ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {c.deviationPercent > 0 ? `+${c.deviationPercent}` : c.deviationPercent}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F8F8F5] dark:bg-[#1A1C22] font-bold border-t border-[#E0E0D9] dark:border-[#2D3039] text-[#111215] dark:text-white">
                    <td colSpan={2} className="py-3 px-3 uppercase text-xs font-sans">
                      ИТОГО СМЕСИ:
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{shift.totalTargetWeightKg}</td>
                    <td className="py-3 px-3 text-right font-black text-sm tabular-nums">
                      {shift.totalActualWeightKg}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-black tabular-nums ${
                        isOver ? 'text-[#E63B00]' : isUnder ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {shift.totalDeviationKg > 0 ? `+${shift.totalDeviationKg}` : shift.totalDeviationKg}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {((shift.totalDeviationKg / (shift.totalTargetWeightKg || 1)) * 100).toFixed(2)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#EBEBE6] dark:border-[#26282E] bg-[#F8F8F5] dark:bg-[#181A20] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              if (window.confirm('Завершить текущую смену и открыть чистый пульт для новой смены?')) {
                onStartNewShift();
              }
            }}
            id="btn-start-new-shift"
            className="px-4 py-2.5 rounded-xl bg-[#EBEBE6] hover:bg-[#DFDFD8] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Начать новую смену</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              id="btn-download-pdf-summary"
              className="px-4 py-2.5 rounded-xl bg-[#111215] hover:bg-[#252830] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] text-xs font-black flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4 text-[#E63B00]" />
              <span>{isExportingPdf ? 'Генерация PDF...' : 'Скачать PDF акт'}</span>
            </button>

            <button
              onClick={() => exportShiftToExcel(shift, recipe)}
              id="btn-export-excel-summary"
              className="px-4 py-2.5 rounded-xl bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs font-bold flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              onClick={onPrint}
              id="btn-print-summary"
              className="px-4 py-2.5 rounded-xl bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Печать</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
