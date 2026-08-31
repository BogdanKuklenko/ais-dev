import React, { useState } from 'react';
import { 
  Printer, 
  FileText,
  FileSpreadsheet, 
  X,
} from 'lucide-react';
import { ShiftSummary, Recipe } from '../types';
import { exportShiftToExcel } from '../lib/exportExcel';
import { exportShiftToPdf } from '../lib/exportPdf';

interface PrintReportViewProps {
  shift: ShiftSummary;
  recipe?: Recipe;
  onClose: () => void;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({
  shift,
  recipe,
  onClose,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const isOver = shift.totalDeviationKg > 0;
  const isUnder = shift.totalDeviationKg < 0;

  const batches = shift.batches || [];
  const targetPerBatch = recipe?.targetTotalWeightKg || (shift.batchesCount > 0 ? Math.round(shift.totalTargetWeightKg / shift.batchesCount) : 1000);

  // Quality & dispersion statistics
  let minBatch = batches[0] || null;
  let maxBatch = batches[0] || null;
  let inToleranceCount = 0;
  let overToleranceCount = 0;
  let underToleranceCount = 0;

  batches.forEach((b) => {
    if (!minBatch || b.totalActualKg < minBatch.totalActualKg) minBatch = b;
    if (!maxBatch || b.totalActualKg > maxBatch.totalActualKg) maxBatch = b;

    const diffPct = ((b.totalActualKg - b.totalTargetKg) / (b.totalTargetKg || 1)) * 100;
    if (Math.abs(diffPct) <= 1.5) {
      inToleranceCount++;
    } else if (diffPct > 1.5) {
      overToleranceCount++;
    } else {
      underToleranceCount++;
    }
  });

  const qualityRate = batches.length > 0 ? Math.round((inToleranceCount / batches.length) * 1000) / 10 : 100;
  const avgBatchWeight = batches.length > 0 ? Math.round((shift.totalActualWeightKg / batches.length) * 10) / 10 : targetPerBatch;

  // Duration
  let durationMins = 480;
  try {
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);
    if (!isNaN(startH) && !isNaN(endH)) {
      let diff = (endH * 60 + endM) - (startH * 60 + startM);
      if (diff <= 0) diff += 24 * 60;
      if (diff > 0 && diff < 1440) durationMins = diff;
    }
  } catch {
    durationMins = 480;
  }

  const durationHours = Math.max(durationMins / 60, 0.25);
  const batchesPerHour = Math.round((batches.length / durationHours) * 10) / 10;
  const tonsPerHour = Math.round(((shift.totalActualWeightKg / 1000) / durationHours) * 100) / 100;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportShiftToPdf(shift, recipe);
    } catch (e) {
      console.error('PDF generation error', e);
      alert('Ошибка при генерации PDF. Попробуйте распечатать через диалог печати.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-6 animate-fadeIn">
      {/* Control Toolbar */}
      <div className="w-full max-w-5xl bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl p-3 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-2xl print:hidden text-[#111215] dark:text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-black text-sm">
            А4
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base">Технологический акт смены и крупный PDF</h3>
            <p className="text-xs text-[#717684] dark:text-[#8E95A5] font-mono">
              Смена №{shift.shiftNumber} ({shift.shiftDate}) • {shift.recipeCode} • {shift.batchesCount} замесов • {qualityRate}% точность
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            id="btn-print-view-download-pdf"
            className="px-4 py-2.5 rounded-lg bg-[#111215] hover:bg-[#272A33] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] text-xs sm:text-sm font-black flex items-center gap-2 shadow transition disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-[#E63B00]" />
            <span>{isExportingPdf ? 'Генерация...' : 'Скачать PDF (крупный шрифт)'}</span>
          </button>

          <button
            onClick={() => exportShiftToExcel(shift, recipe)}
            id="btn-print-view-download-excel"
            className="px-3.5 py-2.5 rounded-lg bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs sm:text-sm font-bold flex items-center gap-1.5 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={handlePrint}
            id="btn-trigger-browser-print"
            className="px-3.5 py-2.5 rounded-lg bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Печать на принтер</span>
          </button>

          <button
            onClick={onClose}
            id="btn-close-print-view"
            className="p-2.5 rounded-lg hover:bg-[#F0F0EB] dark:hover:bg-[#202229] text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet Canvas */}
      <div 
        id="printable-sheet"
        className="w-full max-w-[210mm] bg-white text-[#0F172A] p-8 sm:p-10 shadow-2xl rounded-sm print:p-0 print:shadow-none print:max-w-none print:m-0 font-sans"
      >
        {/* Top Accent Strip */}
        <div className="h-2 bg-slate-900 w-full mb-4" />

        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-900 leading-tight">
                ООО «АЛЕКС» — ЗАВОД СУХИХ СТРОИТЕЛЬНЫХ СМЕСЕЙ
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
                Производственно-технологический комплекс • Участок автоматизированного весового дозирования
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="inline-block border-2 border-slate-900 px-3.5 py-1.5 font-mono font-black text-sm bg-slate-100">
                СМЕННЫЙ АКТ № {shift.shiftNumber}
              </div>
              <div className="text-xs text-slate-700 font-mono mt-1.5 font-bold">
                Дата: <strong>{shift.shiftDate}</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-bold">Рецептура / Марка:</span>
              <strong className="font-mono text-slate-900">{shift.recipeCode}</strong> — {shift.recipeName}
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-bold">Оператор пульта:</span>
              <strong className="text-slate-900">{shift.operatorName}</strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-bold">Время / Длительность:</span>
              <strong className="font-mono text-slate-900">{shift.startTime} — {shift.endTime}</strong> ({Math.floor(durationMins / 60)}ч {durationMins % 60}м)
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-bold">Норма на 1 замес:</span>
              <strong className="font-mono text-slate-900">{targetPerBatch} кг</strong>
            </div>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 bg-slate-50 border border-slate-300 p-3 mb-5 text-xs font-mono">
          <div className="p-1">
            <span className="text-[11px] text-slate-500 block uppercase font-bold">Выпуск:</span>
            <strong className="text-base font-black text-slate-900">{shift.batchesCount} шт</strong>
            <span className="text-[11px] text-slate-600 block font-sans">{batchesPerHour} з/ч</span>
          </div>
          <div className="p-1">
            <span className="text-[11px] text-slate-500 block uppercase font-bold">План смены:</span>
            <strong className="text-base font-bold text-slate-900">{(shift.totalTargetWeightKg / 1000).toFixed(3)} т</strong>
            <span className="text-[11px] text-slate-600 block font-sans">{shift.totalTargetWeightKg} кг</span>
          </div>
          <div className="p-1">
            <span className="text-[11px] text-slate-500 block uppercase font-bold">Факт выработки:</span>
            <strong className="text-base font-black text-slate-900">{(shift.totalActualWeightKg / 1000).toFixed(3)} т</strong>
            <span className="text-[11px] text-slate-600 block font-sans">{shift.totalActualWeightKg} кг</span>
          </div>
          <div className="p-1">
            <span className="text-[11px] text-slate-500 block uppercase font-bold">Отклонение:</span>
            <strong className={`text-base font-black ${isOver ? 'text-orange-700' : isUnder ? 'text-blue-700' : 'text-emerald-700'}`}>
              {shift.totalDeviationKg > 0 ? `+${shift.totalDeviationKg}` : shift.totalDeviationKg} кг
            </strong>
            <span className="text-[11px] text-slate-600 block font-sans">
              {((shift.totalDeviationKg / (shift.totalTargetWeightKg || 1)) * 100).toFixed(2)}%
            </span>
          </div>
          <div className="p-1">
            <span className="text-[11px] text-slate-500 block uppercase font-bold">Средний замес:</span>
            <strong className="text-base font-bold text-slate-900">{avgBatchWeight} кг</strong>
            <span className="text-[11px] text-slate-600 block font-sans">Норма: {targetPerBatch} кг</span>
          </div>
          <div className="p-1">
            <span className="text-[11px] text-slate-500 block uppercase font-bold">Точность (допуск):</span>
            <strong className={`text-base font-black ${qualityRate >= 95 ? 'text-emerald-700' : qualityRate >= 85 ? 'text-orange-700' : 'text-red-700'}`}>
              {qualityRate}%
            </strong>
            <span className="text-[11px] text-slate-600 block font-sans">{inToleranceCount}/{shift.batchesCount} в норме</span>
          </div>
        </div>

        {/* Section 1: Raw Material Balance Table */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs sm:text-sm font-black uppercase text-slate-900">
              1. Сводный баланс расхода сырья по рецептуре и фактический удел:
            </div>
            <div className="text-xs text-slate-600 font-bold">
              Допуск: ±1.5% по ГОСТ / ТУ
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-400 text-xs sm:text-sm font-mono">
            <thead>
              <tr className="bg-slate-200 text-slate-900 text-left">
                <th className="border border-slate-400 p-2 text-center w-9">№</th>
                <th className="border border-slate-400 p-2 font-sans font-bold">Компонент сырья</th>
                <th className="border border-slate-400 p-2 font-sans">Фракция / Марка</th>
                <th className="border border-slate-400 p-2 text-right">Норма 1з</th>
                <th className="border border-slate-400 p-2 text-right">Доля %</th>
                <th className="border border-slate-400 p-2 text-right">План смены</th>
                <th className="border border-slate-400 p-2 text-right">Факт расход</th>
                <th className="border border-slate-400 p-2 text-right">Разница</th>
                <th className="border border-slate-400 p-2 text-right">Откл. %</th>
                <th className="border border-slate-400 p-2 text-center font-sans">Статус</th>
              </tr>
            </thead>
            <tbody>
              {shift.componentTotals.map((c, idx) => {
                const recipeComp = recipe?.components.find((rc) => rc.id === c.componentId);
                const targetSingle = recipeComp ? recipeComp.targetWeightKg : (shift.batchesCount > 0 ? Math.round(c.totalTargetKg / shift.batchesCount) : 0);
                const targetSharePct = ((c.totalTargetKg / (shift.totalTargetWeightKg || 1)) * 100).toFixed(1);
                const isWithinTolerance = Math.abs(c.deviationPercent) <= 1.5;

                return (
                  <tr key={c.componentId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border border-slate-300 p-2 text-center text-slate-500 font-bold">{idx + 1}</td>
                    <td className="border border-slate-300 p-2 font-bold font-sans text-slate-900">{c.name}</td>
                    <td className="border border-slate-300 p-2 text-slate-600 font-sans">{c.fraction || '—'}</td>
                    <td className="border border-slate-300 p-2 text-right tabular-nums">{targetSingle} кг</td>
                    <td className="border border-slate-300 p-2 text-right tabular-nums text-slate-600">{targetSharePct}%</td>
                    <td className="border border-slate-300 p-2 text-right tabular-nums">{c.totalTargetKg}</td>
                    <td className="border border-slate-300 p-2 text-right font-black tabular-nums text-slate-900">{c.totalActualKg}</td>
                    <td className="border border-slate-300 p-2 text-right font-bold tabular-nums">
                      <span className={c.totalDeviationKg > 0 ? 'text-orange-700' : c.totalDeviationKg < 0 ? 'text-blue-700' : 'text-emerald-700'}>
                        {c.totalDeviationKg > 0 ? `+${c.totalDeviationKg}` : c.totalDeviationKg}
                      </span>
                    </td>
                    <td className="border border-slate-300 p-2 text-right tabular-nums font-bold">
                      {c.deviationPercent > 0 ? `+${c.deviationPercent}` : c.deviationPercent}%
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-sans font-bold text-xs">
                      {isWithinTolerance ? (
                        <span className="text-emerald-700">✓ В норме</span>
                      ) : c.deviationPercent > 1.5 ? (
                        <span className="text-orange-700">▲ Перерасход</span>
                      ) : (
                        <span className="text-blue-700">▼ Экономия</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-bold">
                <td colSpan={3} className="border border-slate-400 p-2 uppercase font-sans text-slate-900">
                  ИТОГО ПО СМЕСИ:
                </td>
                <td className="border border-slate-400 p-2 text-right tabular-nums">{targetPerBatch} кг</td>
                <td className="border border-slate-400 p-2 text-right tabular-nums">100.0%</td>
                <td className="border border-slate-400 p-2 text-right tabular-nums">{shift.totalTargetWeightKg}</td>
                <td className="border border-slate-400 p-2 text-right text-slate-900 font-black tabular-nums">{shift.totalActualWeightKg}</td>
                <td className="border border-slate-400 p-2 text-right tabular-nums font-black">
                  <span className={shift.totalDeviationKg > 0 ? 'text-orange-700' : shift.totalDeviationKg < 0 ? 'text-blue-700' : 'text-emerald-700'}>
                    {shift.totalDeviationKg > 0 ? `+${shift.totalDeviationKg}` : shift.totalDeviationKg}
                  </span>
                </td>
                <td className="border border-slate-400 p-2 text-right tabular-nums">
                  {((shift.totalDeviationKg / (shift.totalTargetWeightKg || 1)) * 100).toFixed(2)}%
                </td>
                <td className="border border-slate-400 p-2 text-center font-sans text-xs font-black">
                  {Math.abs(Number(((shift.totalDeviationKg / (shift.totalTargetWeightKg || 1)) * 100).toFixed(2))) <= 1.5 ? (
                    <span className="text-emerald-700">СООТВЕТСТВУЕТ ТУ</span>
                  ) : (
                    <span className="text-orange-700">КОРРЕКТИРОВКА</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Section 2: Quality & Technological Analysis */}
        <div className="mb-5 p-4 bg-slate-50 border border-slate-300 rounded-sm">
          <div className="text-xs sm:text-sm font-black uppercase text-slate-900 mb-3">
            2. Технологический анализ точности и стабильности дозирования:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <span className="font-bold text-slate-800 block border-b border-slate-300 pb-1">Вариация и экстремумы замесов:</span>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">Минимальный замес:</span>
                <strong className="font-mono text-slate-900">{minBatch ? `№${(minBatch as any).batchNumber} (${(minBatch as any).totalActualKg} кг)` : '—'}</strong>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">Максимальный замес:</span>
                <strong className="font-mono text-slate-900">{maxBatch ? `№${(maxBatch as any).batchNumber} (${(maxBatch as any).totalActualKg} кг)` : '—'}</strong>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">Размах вариации:</span>
                <strong className="font-mono text-slate-900">{minBatch && maxBatch ? `${(maxBatch as any).totalActualKg - (minBatch as any).totalActualKg} кг` : '—'}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-slate-800 block border-b border-slate-300 pb-1">Распределение по зонам допуска:</span>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">В норме (±1.5%):</span>
                <strong className="font-mono text-emerald-700">{inToleranceCount} шт ({qualityRate}%)</strong>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">С превышением (&gt; +1.5%):</span>
                <strong className="font-mono text-orange-700">{overToleranceCount} шт</strong>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">С занижением (&lt; -1.5%):</span>
                <strong className="font-mono text-blue-700">{underToleranceCount} шт</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-slate-800 block border-b border-slate-300 pb-1">Эффективность линии и время:</span>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">Темп производства:</span>
                <strong className="font-mono text-slate-900">{batchesPerHour} замесов/час</strong>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">Скорость линии:</span>
                <strong className="font-mono text-slate-900">{tonsPerHour} т/час</strong>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">Средний цикл 1 замеса:</span>
                <strong className="font-mono text-slate-900">{shift.batchesCount > 0 ? (durationMins / shift.batchesCount).toFixed(1) : '—'} мин</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Detailed Batch Registry */}
        {batches.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs sm:text-sm font-black uppercase text-slate-900">
                3. Позамесная ведомость дозирования (Реестр смены):
              </div>
              <div className="text-xs text-slate-600 font-mono font-bold">
                Всего записей: {batches.length} замесов
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-400 text-xs font-mono">
              <thead>
                <tr className="bg-slate-200 text-slate-900 text-left">
                  <th className="border border-slate-400 p-1.5 text-center w-10">№</th>
                  <th className="border border-slate-400 p-1.5 text-center w-20">Время</th>
                  {recipe?.components.map((comp) => (
                    <th key={comp.id} className="border border-slate-400 p-1.5 text-right font-sans">
                      {comp.name.slice(0, 10)}
                    </th>
                  ))}
                  <th className="border border-slate-400 p-1.5 text-right">План</th>
                  <th className="border border-slate-400 p-1.5 text-right">Факт (кг)</th>
                  <th className="border border-slate-400 p-1.5 text-right">Разн.</th>
                  <th className="border border-slate-400 p-1.5 text-center font-sans">Допуск</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b, bIdx) => {
                  const devPct = ((b.totalDeviationKg / (b.totalTargetKg || 1)) * 100).toFixed(1);
                  const isOk = Math.abs(Number(devPct)) <= 1.5;

                  return (
                    <tr key={b.id} className={bIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="border border-slate-300 p-1 text-center font-bold text-slate-900">№{b.batchNumber}</td>
                      <td className="border border-slate-300 p-1 text-center text-slate-600">
                        {new Date(b.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      {recipe?.components.map((comp) => {
                        const item = b.items.find((i) => i.componentId === comp.id);
                        return (
                          <td key={comp.id} className="border border-slate-300 p-1 text-right tabular-nums">
                            {item ? item.actualKg : '—'}
                          </td>
                        );
                      })}
                      <td className="border border-slate-300 p-1 text-right tabular-nums text-slate-500">
                        {b.totalTargetKg}
                      </td>
                      <td className="border border-slate-300 p-1 text-right font-black tabular-nums text-slate-900">
                        {b.totalActualKg}
                      </td>
                      <td className="border border-slate-300 p-1 text-right tabular-nums font-bold">
                        <span className={b.totalDeviationKg > 0 ? 'text-orange-700' : b.totalDeviationKg < 0 ? 'text-blue-700' : 'text-emerald-700'}>
                          {b.totalDeviationKg > 0 ? `+${b.totalDeviationKg}` : b.totalDeviationKg}
                        </span>
                      </td>
                      <td className="border border-slate-300 p-1 text-center font-sans font-bold text-[11px]">
                        {isOk ? (
                          <span className="text-emerald-700">✓ Норма</span>
                        ) : Number(devPct) > 1.5 ? (
                          <span className="text-orange-700">▲ +{devPct}%</span>
                        ) : (
                          <span className="text-blue-700">▼ {devPct}%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {shift.notes && (
          <div className="mb-5 p-3 bg-slate-50 border border-slate-300 text-xs sm:text-sm">
            <span className="font-bold text-slate-700 block text-xs uppercase">Особые отметки смены:</span>
            <p className="italic text-slate-800 mt-1">«{shift.notes}»</p>
          </div>
        )}

        {/* Official Signatures */}
        <div className="mt-8 pt-5 border-t-2 border-slate-900 grid grid-cols-3 gap-6 text-xs sm:text-sm">
          <div>
            <span className="text-slate-500 block mb-1 uppercase font-bold text-[11px]">Сдал (Оператор пульта):</span>
            <span className="text-slate-600 text-xs block mb-6">Оператор весового дозирования</span>
            <div className="border-b border-slate-900 pb-1 flex justify-between items-end">
              <span>Подпись: _____________</span>
              <strong className="font-bold text-slate-900">{shift.operatorName}</strong>
            </div>
          </div>

          <div>
            <span className="text-slate-500 block mb-1 uppercase font-bold text-[11px]">Проверил (ОТК / Лаборатория):</span>
            <span className="text-slate-600 text-xs block mb-6">Инженер-лаборант ОТК</span>
            <div className="border-b border-slate-900 pb-1 flex justify-between items-end">
              <span>Подпись: _____________</span>
              <span className="text-slate-400">/ ____________ /</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 block mb-1 uppercase font-bold text-[11px]">Утвердил (Начальник цеха):</span>
            <span className="text-slate-600 text-xs block mb-6">Главный технолог производства</span>
            <div className="border-b border-slate-900 pb-1 flex justify-between items-end">
              <span>Подпись: _____________</span>
              <span className="text-slate-400">/ ____________ /</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-3 border-t border-slate-300 flex justify-between items-center text-xs text-slate-500">
          <span>ООО «АЛЕКС» • Система оперативного контроля дозирования</span>
          <span>Сформировано: {new Date().toLocaleString('ru-RU')}</span>
        </div>
      </div>
    </div>
  );
};
