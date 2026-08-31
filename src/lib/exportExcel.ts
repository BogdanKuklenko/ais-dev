import * as XLSX from 'xlsx';
import { ShiftSummary, Recipe } from '../types';

export function exportShiftToExcel(shift: ShiftSummary, recipe?: Recipe) {
  const wb = XLSX.utils.book_new();

  // 1. SUMMARY SHEET
  const summaryData: (string | number)[][] = [
    ['ОТЧЁТ ПО ПРОИЗВОДСТВЕННОЙ СМЕНЕ — ЗАВОД СУХИХ СМЕСЕЙ ООО «АЛЕКС»'],
    [''],
    ['Параметр', 'Значение'],
    ['Дата смены', shift.shiftDate],
    ['Номер смены', `Смена № ${shift.shiftNumber}`],
    ['Оператор пульта / Замесчик', shift.operatorName],
    ['Рецептура / Формула', `${shift.recipeCode} — ${shift.recipeName}`],
    ['Время начала смены', shift.startTime],
    ['Время завершения', shift.endTime],
    ['Всего выполнено замесов', shift.batchesCount],
    ['Общий плановый тоннаж (Норма)', `${(shift.totalTargetWeightKg / 1000).toFixed(3)} т (${shift.totalTargetWeightKg} кг)`],
    ['Общий фактический тоннаж (Факт)', `${(shift.totalActualWeightKg / 1000).toFixed(3)} т (${shift.totalActualWeightKg} кг)`],
    [
      'Итоговое суммарное отклонение',
      `${shift.totalDeviationKg > 0 ? '+' : ''}${shift.totalDeviationKg} кг (${(
        (shift.totalDeviationKg / (shift.totalTargetWeightKg || 1)) *
        100
      ).toFixed(2)}%) ${shift.totalDeviationKg > 0 ? 'ПЕРЕВЕС' : shift.totalDeviationKg < 0 ? 'НЕДОВЕС' : 'ТОЧНО В НОРМУ'}`,
    ],
    [''],
    ['СВОДНЫЙ РАСХОД СЫРЬЯ ПО КОМПОНЕНТАМ:'],
    ['Компонент', 'Фракция / Марка', 'Норма (кг)', 'Факт (кг)', 'Отклонение (кг)', 'Отклонение (%)', 'Статус'],
  ];

  shift.componentTotals.forEach((c) => {
    const status =
      c.totalDeviationKg > 0
        ? `ПЕРЕВЕС (+${c.totalDeviationKg} кг)`
        : c.totalDeviationKg < 0
        ? `НЕДОВЕС (${c.totalDeviationKg} кг)`
        : 'НОРМА (0 кг)';

    summaryData.push([
      c.name,
      c.fraction || '—',
      c.totalTargetKg,
      c.totalActualKg,
      c.totalDeviationKg > 0 ? `+${c.totalDeviationKg}` : c.totalDeviationKg,
      `${c.deviationPercent > 0 ? '+' : ''}${c.deviationPercent}%`,
      status,
    ]);
  });

  summaryData.push(['']);
  summaryData.push(['Подпись оператора: __________________ / ' + shift.operatorName]);
  summaryData.push(['Подпись лаборанта: __________________']);
  summaryData.push(['Подпись начальника смены: __________________']);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths
  wsSummary['!cols'] = [
    { wch: 32 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Сводка_Смены');

  // 2. BATCHES DETAIL SHEET
  if (shift.batches && shift.batches.length > 0) {
    const firstBatch = shift.batches[0];
    const headerRow: (string | number)[] = ['№ Замеса', 'Время'];

    firstBatch.items.forEach((item) => {
      const compLabel = item.fraction ? `${item.componentName} (${item.fraction})` : item.componentName;
      headerRow.push(`${compLabel} Норма (кг)`);
      headerRow.push(`${compLabel} Факт (кг)`);
      headerRow.push(`${compLabel} Откл (кг)`);
    });

    headerRow.push('Итого Норма (кг)');
    headerRow.push('Итого Факт (кг)');
    headerRow.push('Итого Откл (кг)');
    headerRow.push('Статус замеса');

    const batchesData: (string | number)[][] = [
      [`ЖУРНАЛ ЗАМЕСОВ: ${shift.recipeCode} (${shift.shiftDate}, Смена ${shift.shiftNumber})`],
      [''],
      headerRow,
    ];

    shift.batches.forEach((b) => {
      const timeStr = new Date(b.timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const row: (string | number)[] = [b.batchNumber, timeStr];

      b.items.forEach((item) => {
        row.push(item.targetKg);
        row.push(item.actualKg);
        row.push(item.deviationKg > 0 ? `+${item.deviationKg}` : item.deviationKg);
      });

      row.push(b.totalTargetKg);
      row.push(b.totalActualKg);
      row.push(b.totalDeviationKg > 0 ? `+${b.totalDeviationKg}` : b.totalDeviationKg);

      const batchStatus =
        b.totalDeviationKg > 0
          ? `Перевес (+${b.totalDeviationKg} кг)`
          : b.totalDeviationKg < 0
          ? `Недовес (${b.totalDeviationKg} кг)`
          : 'Норма';
      row.push(batchStatus);

      batchesData.push(row);
    });

    // Add totals row
    const totalsRow: (string | number)[] = ['ИТОГО ПО ВСЕМ ЗАМЕСАМ', ''];
    firstBatch.items.forEach((_, idx) => {
      const compTotal = shift.componentTotals[idx];
      if (compTotal) {
        totalsRow.push(compTotal.totalTargetKg);
        totalsRow.push(compTotal.totalActualKg);
        totalsRow.push(compTotal.totalDeviationKg > 0 ? `+${compTotal.totalDeviationKg}` : compTotal.totalDeviationKg);
      } else {
        totalsRow.push('', '', '');
      }
    });
    totalsRow.push(shift.totalTargetWeightKg);
    totalsRow.push(shift.totalActualWeightKg);
    totalsRow.push(shift.totalDeviationKg > 0 ? `+${shift.totalDeviationKg}` : shift.totalDeviationKg);
    totalsRow.push('');

    batchesData.push(['']);
    batchesData.push(totalsRow);

    const wsBatches = XLSX.utils.aoa_to_sheet(batchesData);
    XLSX.utils.book_append_sheet(wb, wsBatches, 'Журнал_Замесов');
  }

  // 3. RECIPE SPECIFICATION SHEET
  if (recipe) {
    const recipeData: (string | number)[][] = [
      ['ПАСПОРТ РЕЦЕПТУРЫ (ТЕХНОЛОГИЧЕСКАЯ КАРТА)'],
      [''],
      ['Код смеси', recipe.code],
      ['Наименование', recipe.name],
      ['Категория', recipe.category],
      ['Описание', recipe.description || '—'],
      ['Базовый вес 1 замеса', `${recipe.targetTotalWeightKg} кг`],
      [''],
      ['Состав рецептуры на 1 замес:'],
      ['№', 'Компонент', 'Фракция / Марка', 'Норма расхода (кг)', 'Доля (%)', 'Допуск (±%)'],
    ];

    recipe.components.forEach((c, idx) => {
      const share = ((c.targetWeightKg / (recipe.targetTotalWeightKg || 1)) * 100).toFixed(1);
      recipeData.push([
        idx + 1,
        c.name,
        c.fraction || '—',
        c.targetWeightKg,
        `${share}%`,
        `±${c.tolerancePercent || 1.5}%`,
      ]);
    });

    const wsRecipe = XLSX.utils.aoa_to_sheet(recipeData);
    wsRecipe['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 24 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRecipe, 'Техкарта_Рецепта');
  }

  const safeCode = shift.recipeCode.replace(/[^a-zA-Z0-9а-яА-Я_-]/g, '_');
  const filename = `Отчет_Замесы_Алекс_${safeCode}_${shift.shiftDate}_Смена${shift.shiftNumber}.xlsx`;

  XLSX.writeFile(wb, filename);
}
