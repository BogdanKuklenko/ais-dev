import jsPDF from 'jspdf';
import { ShiftSummary, Recipe, BatchRecord } from '../types';

interface BatchStats {
  minBatch: BatchRecord | null;
  maxBatch: BatchRecord | null;
  avgBatchWeight: number;
  inToleranceCount: number;
  overToleranceCount: number;
  underToleranceCount: number;
  qualityRatePercent: number;
  shiftDurationMinutes: number;
  batchesPerHour: number;
  tonsPerHour: number;
}

function calculateDetailedStats(shift: ShiftSummary, recipe?: Recipe): BatchStats {
  const batches = shift.batches || [];
  const targetPerBatch = recipe?.targetTotalWeightKg || (shift.batchesCount > 0 ? shift.totalTargetWeightKg / shift.batchesCount : 1000);

  if (batches.length === 0) {
    return {
      minBatch: null,
      maxBatch: null,
      avgBatchWeight: targetPerBatch,
      inToleranceCount: 0,
      overToleranceCount: 0,
      underToleranceCount: 0,
      qualityRatePercent: 100,
      shiftDurationMinutes: 480,
      batchesPerHour: 0,
      tonsPerHour: 0,
    };
  }

  let minB = batches[0];
  let maxB = batches[0];
  let inTolerance = 0;
  let overTolerance = 0;
  let underTolerance = 0;

  batches.forEach((b) => {
    if (b.totalActualKg < minB.totalActualKg) minB = b;
    if (b.totalActualKg > maxB.totalActualKg) maxB = b;

    const diffPct = ((b.totalActualKg - b.totalTargetKg) / (b.totalTargetKg || 1)) * 100;
    if (Math.abs(diffPct) <= 1.5) {
      inTolerance++;
    } else if (diffPct > 1.5) {
      overTolerance++;
    } else {
      underTolerance++;
    }
  });

  const avgWeight = shift.totalActualWeightKg / batches.length;
  const qualityRate = Math.round((inTolerance / batches.length) * 1000) / 10;

  // Duration calculation
  let durationMins = 480; // default 8 hours
  try {
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);
    if (!isNaN(startH) && !isNaN(endH)) {
      let diff = (endH * 60 + endM) - (startH * 60 + startM);
      if (diff <= 0) diff += 24 * 60; // night shift crossover
      if (diff > 0 && diff < 1440) durationMins = diff;
    }
  } catch {
    durationMins = 480;
  }

  const durationHours = Math.max(durationMins / 60, 0.25);
  const batchesPerHour = Math.round((batches.length / durationHours) * 10) / 10;
  const tonsPerHour = Math.round(((shift.totalActualWeightKg / 1000) / durationHours) * 100) / 100;

  return {
    minBatch: minB,
    maxBatch: maxB,
    avgBatchWeight: Math.round(avgWeight * 10) / 10,
    inToleranceCount: inTolerance,
    overToleranceCount: overTolerance,
    underToleranceCount: underTolerance,
    qualityRatePercent: qualityRate,
    shiftDurationMinutes: durationMins,
    batchesPerHour,
    tonsPerHour,
  };
}

/**
 * Creates high-DPI canvas for Page 1 (Summary, KPIs, Balance, Quality Analysis, Signatures)
 * All font sizes, row heights and paddings are calibrated for large, crisp, legible print.
 */
function renderPage1ToCanvas(
  shift: ShiftSummary,
  recipe: Recipe | undefined,
  stats: BatchStats,
  totalPages: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  // A4 dimensions at 200 DPI
  const width = 1654;
  const height = 2338;
  canvas.width = width;
  canvas.height = height;

  // Crisp white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const marginX = 65;
  const contentW = width - marginX * 2; // 1524px
  let currentY = 50;

  // Top Accent Banner (clean, solid bar)
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(marginX, currentY, contentW, 6);
  
  // Generous spacing between top bar and title so text never touches the bar
  currentY += 46;

  // Header Title (+6pt larger)
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 36px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('ООО «АЛЕКС» — ЗАВОД СУХИХ СТРОИТЕЛЬНЫХ СМЕСЕЙ', marginX, currentY);

  // Subtitle (+5pt larger)
  ctx.fillStyle = '#475569';
  ctx.font = '22px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('Производственно-технологический комплекс • Участок автоматизированного весового дозирования', marginX, currentY + 34);

  // Top Right Badge (Document Number & Date)
  const badgeW = 420;
  const badgeH = 80;
  const badgeX = width - marginX - badgeW;
  const badgeY = currentY - 24;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.fillText(`СМЕННЫЙ АКТ № ${shift.shiftNumber}`, badgeX + 18, badgeY + 34);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.fillText(`Дата: ${shift.shiftDate}`, badgeX + 18, badgeY + 64);

  currentY += 86;

  // Horizontal divider
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, currentY);
  ctx.lineTo(width - marginX, currentY);
  ctx.stroke();

  currentY += 32;

  // Meta Grid: 4 columns
  const metaBoxW = contentW / 4;
  const metaItems = [
    { label: 'РЕЦЕПТУРА / МАРКА', val: `${shift.recipeCode} — ${shift.recipeName}` },
    { label: 'ОПЕРАТОР ПУЛЬТА', val: shift.operatorName },
    { label: 'ВРЕМЯ / ДЛИТЕЛЬНОСТЬ', val: `${shift.startTime} — ${shift.endTime} (${Math.floor(stats.shiftDurationMinutes / 60)}ч ${stats.shiftDurationMinutes % 60}м)` },
    { label: 'НОРМА НА 1 ЗАМЕС', val: `${recipe?.targetTotalWeightKg || (shift.totalTargetWeightKg / (shift.batchesCount || 1))} кг` },
  ];

  metaItems.forEach((item, idx) => {
    const x = marginX + idx * metaBoxW;
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(item.label, x, currentY);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px "Segoe UI", Roboto, Arial, sans-serif';
    
    let displayText = item.val;
    const maxTextW = metaBoxW - 16;
    if (ctx.measureText(displayText).width > maxTextW) {
      while (displayText.length > 4 && ctx.measureText(displayText + '...').width > maxTextW) {
        displayText = displayText.slice(0, -1);
      }
      displayText += '...';
    }
    ctx.fillText(displayText, x, currentY + 30);
  });

  currentY += 68;

  // KPI Summary Strip: 6 key metrics (Large, High-Contrast & Legible)
  const kpiCount = 6;
  const kpiGap = 14;
  const kpiW = (contentW - (kpiCount - 1) * kpiGap) / kpiCount;
  const kpiH = 112;

  const kpis = [
    { label: 'ВЫПУСК (ЗАМЕСОВ)', val: `${shift.batchesCount} шт`, color: '#0F172A', sub: `Темп: ${stats.batchesPerHour} з/ч` },
    { label: 'ПЛАН СМЕНЫ', val: `${(shift.totalTargetWeightKg / 1000).toFixed(3)} т`, color: '#0F172A', sub: `${shift.totalTargetWeightKg} кг` },
    { label: 'ФАКТ ВЫРАБОТКИ', val: `${(shift.totalActualWeightKg / 1000).toFixed(3)} т`, color: '#0F172A', sub: `${shift.totalActualWeightKg} кг` },
    { 
      label: 'ОТКЛОНЕНИЕ (ИТОГ)', 
      val: `${shift.totalDeviationKg > 0 ? `+${shift.totalDeviationKg}` : shift.totalDeviationKg} кг`, 
      color: shift.totalDeviationKg > 0 ? '#C2410C' : shift.totalDeviationKg < 0 ? '#1D4ED8' : '#047857',
      sub: `${((shift.totalDeviationKg / (shift.totalTargetWeightKg || 1)) * 100).toFixed(2)}%`
    },
    { label: 'СРЕДНИЙ ЗАМЕС', val: `${stats.avgBatchWeight} кг`, color: '#0F172A', sub: `Норма: ${recipe?.targetTotalWeightKg || 1000} кг` },
    { 
      label: 'ТОЧНОСТЬ (ДОПУСК)', 
      val: `${stats.qualityRatePercent}%`, 
      color: stats.qualityRatePercent >= 95 ? '#047857' : stats.qualityRatePercent >= 85 ? '#C2410C' : '#DC2626',
      sub: `${stats.inToleranceCount} из ${shift.batchesCount} в норме`
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = marginX + idx * (kpiW + kpiGap);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(kpiX, currentY, kpiW, kpiH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(kpiX, currentY, kpiW, kpiH);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(kpi.label, kpiX + 14, currentY + 26);

    ctx.fillStyle = kpi.color;
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillText(kpi.val, kpiX + 14, currentY + 66);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(kpi.sub, kpiX + 14, currentY + 98);
  });

  currentY += kpiH + 36;

  // Section 1 Header: Raw Material Balance Table
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 24px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('1. СВОДНЫЙ БАЛАНС РАСХОДА СЫРЬЯ ПО РЕЦЕПТУРЕ И ФАКТИЧЕСКИЙ УДЕЛ', marginX, currentY);
  
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 17px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Допустимая погрешность: ±1.5% по ГОСТ / ТУ', width - marginX, currentY);
  ctx.textAlign = 'left';

  currentY += 20;

  // Table 1: Detailed Component Raw Material Table
  const tableX = marginX;
  const tableW = contentW;
  const headerRowH = 48;
  const rowH = 46;

  // Exactly sum to tableW (1524)
  // 50 + 330 + 190 + 140 + 104 + 150 + 150 + 140 + 120 + 150 = 1524
  const tableCols = [
    { title: '№', w: 50, align: 'center' },
    { title: 'Компонент сырья', w: 330, align: 'left' },
    { title: 'Фракция / Марка', w: 190, align: 'left' },
    { title: 'Норма 1з', w: 140, align: 'right' },
    { title: 'Доля (%)', w: 104, align: 'right' },
    { title: 'План смены', w: 150, align: 'right' },
    { title: 'Факт расход', w: 150, align: 'right' },
    { title: 'Разница', w: 140, align: 'right' },
    { title: 'Откл. (%)', w: 120, align: 'right' },
    { title: 'Статус допуска', w: 150, align: 'center' },
  ];

  // Header Row
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(tableX, currentY, tableW, headerRowH);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tableX, currentY, tableW, headerRowH);

  let cX = tableX;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 17px "Segoe UI", Roboto, Arial, sans-serif';
  tableCols.forEach((col) => {
    if (col.align === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(col.title, cX + col.w - 12, currentY + 30);
    } else if (col.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(col.title, cX + col.w / 2, currentY + 30);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(col.title, cX + 12, currentY + 30);
    }
    cX += col.w;
  });

  currentY += headerRowH;

  // Component Data Rows
  shift.componentTotals.forEach((comp, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(tableX, currentY, tableW, rowH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, currentY, tableW, rowH);

    const recipeComp = recipe?.components.find((rc) => rc.id === comp.componentId);
    const targetSingle = recipeComp ? recipeComp.targetWeightKg : (shift.batchesCount > 0 ? Math.round(comp.totalTargetKg / shift.batchesCount) : 0);
    const targetSharePct = ((comp.totalTargetKg / (shift.totalTargetWeightKg || 1)) * 100).toFixed(1);
    const isWithinTolerance = Math.abs(comp.deviationPercent) <= 1.5;

    let colX = tableX;
    tableCols.forEach((col, cIdx) => {
      ctx.fillStyle = '#0F172A';
      if (cIdx === 0) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillText(`${idx + 1}`, colX + col.w / 2, currentY + 29);
      } else if (cIdx === 1) {
        ctx.textAlign = 'left';
        ctx.font = 'bold 20px "Segoe UI", Roboto, Arial, sans-serif';
        let compName = comp.name;
        const maxCompW = col.w - 20;
        if (ctx.measureText(compName).width > maxCompW) {
          while (compName.length > 3 && ctx.measureText(compName + '..').width > maxCompW) {
            compName = compName.slice(0, -1);
          }
          compName += '..';
        }
        ctx.fillText(compName, colX + 12, currentY + 29);
      } else if (cIdx === 2) {
        ctx.textAlign = 'left';
        ctx.font = '17px "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(comp.fraction || '—', colX + 12, currentY + 29);
      } else if (cIdx === 3) {
        ctx.textAlign = 'right';
        ctx.font = '18px "Courier New", monospace';
        ctx.fillText(`${targetSingle} кг`, colX + col.w - 12, currentY + 29);
      } else if (cIdx === 4) {
        ctx.textAlign = 'right';
        ctx.font = '18px "Courier New", monospace';
        ctx.fillText(`${targetSharePct}%`, colX + col.w - 12, currentY + 29);
      } else if (cIdx === 5) {
        ctx.textAlign = 'right';
        ctx.font = '19px "Courier New", monospace';
        ctx.fillText(`${comp.totalTargetKg}`, colX + col.w - 12, currentY + 29);
      } else if (cIdx === 6) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.fillText(`${comp.totalActualKg}`, colX + col.w - 12, currentY + 29);
      } else if (cIdx === 7) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 21px "Courier New", monospace';
        const diffText = comp.totalDeviationKg > 0 ? `+${comp.totalDeviationKg}` : `${comp.totalDeviationKg}`;
        ctx.fillStyle = comp.totalDeviationKg > 0 ? '#C2410C' : comp.totalDeviationKg < 0 ? '#1D4ED8' : '#047857';
        ctx.fillText(diffText, colX + col.w - 12, currentY + 29);
      } else if (cIdx === 8) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 19px "Courier New", monospace';
        const pctText = comp.deviationPercent > 0 ? `+${comp.deviationPercent}%` : `${comp.deviationPercent}%`;
        ctx.fillText(pctText, colX + col.w - 12, currentY + 29);
      } else if (cIdx === 9) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif';
        if (isWithinTolerance) {
          ctx.fillStyle = '#047857';
          ctx.fillText('✓ В НОРМЕ', colX + col.w / 2, currentY + 29);
        } else if (comp.deviationPercent > 1.5) {
          ctx.fillStyle = '#C2410C';
          ctx.fillText('▲ ПЕРЕРАСХОД', colX + col.w / 2, currentY + 29);
        } else {
          ctx.fillStyle = '#1D4ED8';
          ctx.fillText('▼ ЭКОНОМИЯ', colX + col.w / 2, currentY + 29);
        }
      }
      colX += col.w;
    });

    currentY += rowH;
  });

  // Table Totals Footer
  const footerH = 50;
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(tableX, currentY, tableW, footerH);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tableX, currentY, tableW, footerH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ИТОГО ПО СМЕСИ:', tableX + 12, currentY + 31);

  ctx.textAlign = 'right';
  ctx.font = 'bold 20px "Courier New", monospace';
  // Target total
  const targetColEnd = tableX + 50 + 330 + 190 + 140 + 104 + 150;
  ctx.fillText(`${shift.totalTargetWeightKg} кг`, targetColEnd - 12, currentY + 31);
  // Actual total
  const actualColEnd = targetColEnd + 150;
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText(`${shift.totalActualWeightKg} кг`, actualColEnd - 12, currentY + 31);
  // Diff total
  const diffColEnd = actualColEnd + 140;
  const totDiff = shift.totalDeviationKg > 0 ? `+${shift.totalDeviationKg}` : `${shift.totalDeviationKg}`;
  ctx.fillStyle = shift.totalDeviationKg > 0 ? '#C2410C' : shift.totalDeviationKg < 0 ? '#1D4ED8' : '#047857';
  ctx.fillText(totDiff, diffColEnd - 12, currentY + 31);
  // Diff %
  const pctColEnd = diffColEnd + 120;
  const totPct = ((shift.totalDeviationKg / (shift.totalTargetWeightKg || 1)) * 100).toFixed(2);
  ctx.fillStyle = '#0F172A';
  ctx.fillText(`${totPct}%`, pctColEnd - 12, currentY + 31);

  ctx.textAlign = 'center';
  ctx.font = 'bold 17px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = Math.abs(Number(totPct)) <= 1.5 ? '#047857' : '#C2410C';
  ctx.fillText(Math.abs(Number(totPct)) <= 1.5 ? 'СООТВЕТСТВУЕТ ТУ' : 'КОРРЕКТИРОВКА', pctColEnd + (tableW - (pctColEnd - tableX)) / 2, currentY + 31);

  currentY += footerH + 36;

  // Section 2: Technological & Quality Analysis Box
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 24px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('2. ТЕХНОЛОГИЧЕСКИЙ АНАЛИЗ ТОЧНОСТИ И СТАБИЛЬНОСТИ ДОЗИРОВАНИЯ', marginX, currentY);
  currentY += 20;

  const techBoxH = 175;
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(marginX, currentY, tableW, techBoxH);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(marginX, currentY, tableW, techBoxH);

  // 3 Columns inside tech analysis
  const techColW = tableW / 3;

  // Column A: Dispersion and Extremums
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 19px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('Вариация и экстремумы замесов:', marginX + 18, currentY + 36);

  ctx.font = '18px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('• Минимальный замес:', marginX + 18, currentY + 74);
  ctx.fillText('• Максимальный замес:', marginX + 18, currentY + 110);
  ctx.fillText('• Размах вариации (макс - мин):', marginX + 18, currentY + 146);

  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillStyle = '#0F172A';
  ctx.fillText(stats.minBatch ? `№${stats.minBatch.batchNumber} (${stats.minBatch.totalActualKg} кг)` : '—', marginX + 275, currentY + 74);
  ctx.fillText(stats.maxBatch ? `№${stats.maxBatch.batchNumber} (${stats.maxBatch.totalActualKg} кг)` : '—', marginX + 275, currentY + 110);
  const spread = stats.minBatch && stats.maxBatch ? stats.maxBatch.totalActualKg - stats.minBatch.totalActualKg : 0;
  ctx.fillText(`${spread} кг (${((spread / (recipe?.targetTotalWeightKg || 1000)) * 100).toFixed(1)}%)`, marginX + 275, currentY + 146);

  // Column B: Distribution by tolerance
  const colBX = marginX + techColW;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 19px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('Распределение по зонам допуска:', colBX + 18, currentY + 36);

  ctx.font = '18px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('• В пределах нормы (±1.5%):', colBX + 18, currentY + 74);
  ctx.fillText('• С превышением (> +1.5%):', colBX + 18, currentY + 110);
  ctx.fillText('• С занижением (< -1.5%):', colBX + 18, currentY + 146);

  ctx.font = 'bold 19px "Courier New", monospace';
  ctx.fillStyle = '#047857';
  ctx.fillText(`${stats.inToleranceCount} шт (${stats.qualityRatePercent}%)`, colBX + 275, currentY + 74);
  ctx.fillStyle = '#C2410C';
  ctx.fillText(`${stats.overToleranceCount} шт`, colBX + 275, currentY + 110);
  ctx.fillStyle = '#1D4ED8';
  ctx.fillText(`${stats.underToleranceCount} шт`, colBX + 275, currentY + 146);

  // Column C: Production Line Efficiency
  const colCX = marginX + techColW * 2;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 19px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('Эффективность линии и время:', colCX + 18, currentY + 36);

  ctx.font = '18px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('• Производительность в час:', colCX + 18, currentY + 74);
  ctx.fillText('• Скорость выпуска тонн/час:', colCX + 18, currentY + 110);
  ctx.fillText('• Среднее время на 1 замес:', colCX + 18, currentY + 146);

  ctx.font = 'bold 19px "Courier New", monospace';
  ctx.fillStyle = '#0F172A';
  ctx.fillText(`${stats.batchesPerHour} зам/час`, colCX + 270, currentY + 74);
  ctx.fillText(`${stats.tonsPerHour} т/час`, colCX + 270, currentY + 110);
  const avgMinsPerBatch = shift.batchesCount > 0 ? (stats.shiftDurationMinutes / shift.batchesCount).toFixed(1) : '—';
  ctx.fillText(`${avgMinsPerBatch} мин`, colCX + 270, currentY + 146);

  currentY += techBoxH + 32;

  // Section 3: Notes & Operator Remarks
  if (shift.notes) {
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Особые отметки и примечания смены:', marginX, currentY);
    currentY += 24;

    ctx.fillStyle = '#334155';
    ctx.font = 'italic 18px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(`«${shift.notes}»`, marginX + 14, currentY);
    currentY += 34;
  }

  // Official Signatures & Approval Stamps
  const sigY = Math.max(currentY + 20, height - 240);

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, sigY);
  ctx.lineTo(width - marginX, sigY);
  ctx.stroke();

  const sigColW = contentW / 3;
  const signatures = [
    { role: 'СДАЛ (ОПЕРАТОР ВЕСОВОГО ПОСТА):', name: shift.operatorName, title: 'Оператор линии дозирования' },
    { role: 'ПРОВЕРИЛ (ОТК / ЛАБОРАТОРИЯ):', name: '/ __________________ /', title: 'Инженер-лаборант ОТК' },
    { role: 'УТВЕРДИЛ (НАЧАЛЬНИК ПРОИЗВОДСТВА):', name: '/ __________________ /', title: 'Главный технолог / Начальник цеха' },
  ];

  signatures.forEach((sig, idx) => {
    const sX = marginX + idx * sigColW;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(sig.role, sX, sigY + 32);

    ctx.font = '16px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(sig.title, sX, sigY + 58);

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sX, sigY + 120);
    ctx.lineTo(sX + sigColW - 40, sigY + 120);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '17px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Подпись: ___________', sX, sigY + 114);

    ctx.font = 'bold 19px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(sig.name, sX + 165, sigY + 114);
  });

  // Footer Running Line
  ctx.fillStyle = '#94A3B8';
  ctx.font = '16px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`ООО «АЛЕКС» • АСУ ТП «Дозирование и Смешивание» • Документ сформирован: ${new Date().toLocaleString('ru-RU')}`, marginX, height - 38);

  ctx.textAlign = 'right';
  ctx.fillText(`Страница 1 из ${totalPages}`, width - marginX, height - 38);

  return canvas;
}

/**
 * Creates high-DPI canvas for Page 2+ (Detailed paginated batch ledger)
 * High font size, clear numbers, legible spacing.
 */
function renderBatchLedgerPageToCanvas(
  shift: ShiftSummary,
  recipe: Recipe | undefined,
  batchesSlice: BatchRecord[],
  pageNumber: number,
  totalPages: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  const width = 1654;
  const height = 2338;
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const marginX = 65;
  const contentW = width - marginX * 2; // 1524px
  let currentY = 50;

  // Page Header Accent Bar
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(marginX, currentY, contentW, 6);
  
  // Generous gap between top bar and title
  currentY += 46;

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 32px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('ПРИЛОЖЕНИЕ: ПОЗАМЕСНЫЙ РЕЕСТР КОНТРОЛЯ ДОЗИРОВАНИЯ', marginX, currentY);

  ctx.fillStyle = '#475569';
  ctx.font = '20px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(`Акт смены №${shift.shiftNumber} от ${shift.shiftDate} • Рецептура: ${shift.recipeCode} (${shift.recipeName}) • Оператор: ${shift.operatorName}`, marginX, currentY + 32);

  currentY += 66;

  const tableX = marginX;
  const tableW = contentW;
  const headerRowH = 50;
  const rowH = 48;

  const components = recipe?.components || [];
  const compCount = Math.min(components.length, 6);
  
  // Columns definition:
  // № (70) + Время (110) + Comp columns + План (130) + Факт (140) + Разн (130) + Откл % (110) + Допуск (140) + Отметка (remaining)
  const numColW = 70;
  const timeColW = 110;
  const targetColW = 130;
  const actualColW = 140;
  const diffColW = 130;
  const pctColW = 110;
  const statusColW = 140;
  
  const fixedNonCompW = numColW + timeColW + targetColW + actualColW + diffColW + pctColW + statusColW; // 830px
  const compAreaW = Math.min(560, contentW - fixedNonCompW - 134); // ~560px for components
  const compColW = Math.floor(compAreaW / (compCount || 1));
  const notesColW = tableW - (fixedNonCompW + compCount * compColW);

  // Table Header
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(tableX, currentY, tableW, headerRowH);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tableX, currentY, tableW, headerRowH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 17px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('№ Зам.', tableX + numColW / 2, currentY + 31);
  ctx.fillText('Время', tableX + numColW + timeColW / 2, currentY + 31);

  let curCompX = tableX + numColW + timeColW;
  components.slice(0, compCount).forEach((c) => {
    ctx.textAlign = 'right';
    let compTitle = c.name;
    const maxCompW = compColW - 14;
    if (ctx.measureText(compTitle).width > maxCompW) {
      while (compTitle.length > 3 && ctx.measureText(compTitle + '..').width > maxCompW) {
        compTitle = compTitle.slice(0, -1);
      }
      compTitle += '..';
    }
    ctx.fillText(`${compTitle}`, curCompX + compColW - 10, currentY + 22);
    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = '#64748B';
    ctx.fillText(`(${c.targetWeightKg}кг)`, curCompX + compColW - 10, currentY + 40);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 17px "Segoe UI", Roboto, Arial, sans-serif';
    curCompX += compColW;
  });

  ctx.textAlign = 'right';
  ctx.fillText('План (кг)', curCompX + targetColW - 10, currentY + 31);
  ctx.fillText('Факт (кг)', curCompX + targetColW + actualColW - 10, currentY + 31);
  ctx.fillText('Разн. (кг)', curCompX + targetColW + actualColW + diffColW - 10, currentY + 31);
  ctx.fillText('Откл. %', curCompX + targetColW + actualColW + diffColW + pctColW - 10, currentY + 31);

  ctx.textAlign = 'center';
  ctx.fillText('Допуск', curCompX + targetColW + actualColW + diffColW + pctColW + statusColW / 2, currentY + 31);
  if (notesColW > 40) {
    ctx.textAlign = 'left';
    ctx.fillText('Отметка', curCompX + targetColW + actualColW + diffColW + pctColW + statusColW + 12, currentY + 31);
  }

  currentY += headerRowH;

  // Batch Rows
  batchesSlice.forEach((b, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(tableX, currentY, tableW, rowH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, currentY, tableW, rowH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText(`№${b.batchNumber}`, tableX + numColW / 2, currentY + 30);

    ctx.fillStyle = '#475569';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(
      new Date(b.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      tableX + numColW + timeColW / 2,
      currentY + 30
    );

    let rowCompX = tableX + numColW + timeColW;
    components.slice(0, compCount).forEach((c) => {
      const item = b.items.find((i) => i.componentId === c.id);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0F172A';
      ctx.font = '18px "Courier New", monospace';
      ctx.fillText(item ? `${item.actualKg}` : '—', rowCompX + compColW - 10, currentY + 30);
      rowCompX += compColW;
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(`${b.totalTargetKg}`, rowCompX + targetColW - 10, currentY + 30);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 21px "Courier New", monospace';
    ctx.fillText(`${b.totalActualKg}`, rowCompX + targetColW + actualColW - 10, currentY + 30);

    const dev = b.totalDeviationKg;
    ctx.fillStyle = dev > 0 ? '#C2410C' : dev < 0 ? '#1D4ED8' : '#047857';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText(dev > 0 ? `+${dev}` : `${dev}`, rowCompX + targetColW + actualColW + diffColW - 10, currentY + 30);

    const devPct = ((dev / (b.totalTargetKg || 1)) * 100).toFixed(1);
    ctx.fillStyle = '#0F172A';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(`${devPct}%`, rowCompX + targetColW + actualColW + diffColW + pctColW - 10, currentY + 30);

    const isOk = Math.abs(Number(devPct)) <= 1.5;
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif';
    if (isOk) {
      ctx.fillStyle = '#047857';
      ctx.fillText('✓ Норма', rowCompX + targetColW + actualColW + diffColW + pctColW + statusColW / 2, currentY + 30);
    } else if (Number(devPct) > 1.5) {
      ctx.fillStyle = '#C2410C';
      ctx.fillText('▲ Перевес', rowCompX + targetColW + actualColW + diffColW + pctColW + statusColW / 2, currentY + 30);
    } else {
      ctx.fillStyle = '#1D4ED8';
      ctx.fillText('▼ Недовес', rowCompX + targetColW + actualColW + diffColW + pctColW + statusColW / 2, currentY + 30);
    }

    if (notesColW > 40) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 15px "Segoe UI", Roboto, Arial, sans-serif';
      const noteText = b.notes || '—';
      ctx.fillText(noteText.slice(0, 16), rowCompX + targetColW + actualColW + diffColW + pctColW + statusColW + 12, currentY + 30);
    }

    currentY += rowH;
  });

  // Footer Running Line
  ctx.fillStyle = '#94A3B8';
  ctx.font = '16px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`ООО «АЛЕКС» • Позамесный реестр • Сформировано: ${new Date().toLocaleString('ru-RU')}`, marginX, height - 38);

  ctx.textAlign = 'right';
  ctx.fillText(`Страница ${pageNumber} из ${totalPages}`, width - marginX, height - 38);

  return canvas;
}

/**
 * Main PDF Export Function
 * Generates an engineering-grade, multi-page, highly informative report with full Cyrillic fidelity and large, readable fonts.
 */
export async function exportShiftToPdf(
  shift: ShiftSummary,
  recipe?: Recipe
): Promise<void> {
  const stats = calculateDetailedStats(shift, recipe);
  const batches = shift.batches || [];

  // Determine pagination for batch ledger (30 batches per page for clear readability and high font sizes)
  const BATCHES_PER_LEDGER_PAGE = 30;
  const ledgerPageCount = Math.ceil(batches.length / BATCHES_PER_LEDGER_PAGE);
  const totalPages = 1 + ledgerPageCount;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Page 1: Main Summary & KPIs & Balance & Quality & Signatures
  const page1Canvas = renderPage1ToCanvas(shift, recipe, stats, totalPages);
  const page1Data = page1Canvas.toDataURL('image/png');
  pdf.addImage(page1Data, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

  // Page 2+: Detailed Batch Ledgers
  for (let i = 0; i < ledgerPageCount; i++) {
    pdf.addPage();
    const slice = batches.slice(i * BATCHES_PER_LEDGER_PAGE, (i + 1) * BATCHES_PER_LEDGER_PAGE);
    const ledgerCanvas = renderBatchLedgerPageToCanvas(shift, recipe, slice, i + 2, totalPages);
    const ledgerData = ledgerCanvas.toDataURL('image/png');
    pdf.addImage(ledgerData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  }

  const safeDate = shift.shiftDate.replace(/[/\\?%*:|"<>]/g, '-');
  const filename = `Акт_смены_${shift.recipeCode}_${safeDate}_№${shift.shiftNumber}.pdf`;
  pdf.save(filename);
}
