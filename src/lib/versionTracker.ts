import { VersionLogEntry, VersionEventType, Recipe, AppSettings } from '../types';
import { getStoredVersionLog, saveStoredVersionLog } from './storage';
import { CURRENT_APP_VERSION, calculateChecksum } from './patchEngine';

/**
 * Official Factory Release History (ООО «АЛЕКС» — Завод сухих строительных смесей)
 */
export const OFFICIAL_VERSION_REGISTRY: VersionLogEntry[] = [
  {
    id: 'ver_v241_official',
    version: '2.4.1',
    timestamp: '2026-08-31T08:50:00.000Z',
    type: 'release',
    title: 'Релиз v2.4.1: Восстановление промышленных шрифтов',
    description: 'По требованию операторов восстановлены крупные размеры шрифтов и кнопок в панели дозирования и шапке.',
    author: 'Отдел автоматизации и ИТ завода ООО «АЛЕКС»',
    changelog: [
      'Увеличены поля ввода фактического веса для удобного сенсорного ввода',
      'Увеличены кнопки микроподстройки +5 / -5 кг',
      'Восстановлен читабельный размер навигационных кнопок и информационных блоков в шапке'
    ],
    checksum: 'SHA256-D74A2B99',
    isCurrent: true,
    meta: {
      recipesCount: 6,
      serverProtocol: 'HTTPS / TLS 1.3 Strict',
    }
  },
  {
    id: 'ver_v240_official',
    version: '2.4.0',
    timestamp: '2026-08-31T07:30:00.000Z',
    type: 'release',
    title: 'Релиз v2.4.0: Крупный промышленный шрифт и подсистема учета версий',
    description: 'Масштабирование элементов интерфейса для операторских мониторов в пыльных условиях цеха, внедрение сквозного учета версий и калибровок, OTA SSL API push.',
    author: 'Главный технолог Васильев С.М. / Разработка АСУ ТП',
    changelog: [
      'Увеличен базовый размер шрифтов и кнопок на всех вкладках пульта, в журналах и актах',
      'Внедрен модуль сквозного учета версий, аудита калибровок рецептур и журнала модификаций',
      'Реализован протокол защищенного push-обновления OTA с контролем целостности SHA-256',
      'Добавлен экспорт паспорта версий и журнала аудита в печатный формат и JSON'
    ],
    affectedRecipes: ['С-41', 'С-41 Про', 'П-20', 'М-150', 'П-25 Люкс'],
    checksum: 'SHA256-A89E23B1',
    isCurrent: false,
    meta: {
      recipesCount: 6,
      serverProtocol: 'HTTPS / TLS 1.3 Strict',
      targetMinVersion: '2.0.0'
    }
  },
  {
    id: 'ver_v230_official',
    version: '2.3.0',
    timestamp: '2026-08-28T09:15:00.000Z',
    type: 'release',
    title: 'Релиз v2.3.0: Отказоустойчивое сохранение сессии и SSL API Push',
    description: 'Интеграция протокола горячего применения обновлений без прерывания текущей смены (Zero-Loss Hot Reload) и защита весовых данных.',
    author: 'Отдел автоматизации и ИТ завода ООО «АЛЕКС»',
    changelog: [
      'Внедрена энергонезависимая сессионная память для текущих замесов при горячей перезагрузке',
      'Добавлен мониторинг задержки (ping) и статуса шифрования SSL/TLS 1.3',
      'Защита от сброса весовых параметров при фоновой доставке обязательных патчей',
      'Информационный баннер восстановления сессии с временными метками'
    ],
    checksum: 'SHA256-7C4F9102',
    meta: {
      recipesCount: 5,
      serverProtocol: 'HTTPS / TLS 1.3'
    }
  },
  {
    id: 'ver_v220_official',
    version: '2.2.0',
    timestamp: '2026-08-15T11:00:00.000Z',
    type: 'release',
    title: 'Релиз v2.2.0: Интерактивный редактор рецептур и формул',
    description: 'Полнофункциональный конструктор технологических карт смесей с поддержкой микрокомпонентов и тонкой калибровки допусков.',
    author: 'Главный технолог Васильев С.М.',
    changelog: [
      'Создан визуальный редактор компонентов, фракций и норм расхода сырья',
      'Реализован расчет баланса смешивания и динамическая валидация 1000 кг нормы',
      'Добавлены цветовые маркеры сырьевых компонентов по бункерам дозирования',
      'Поддержка пользовательских (custom) рецептур завода'
    ],
    affectedRecipes: ['С-41', 'С-41 Про', 'П-20', 'М-150'],
    checksum: 'SHA256-62DE889C',
    meta: {
      recipesCount: 5
    }
  },
  {
    id: 'ver_v210_official',
    version: '2.1.0',
    timestamp: '2026-08-01T08:30:00.000Z',
    type: 'release',
    title: 'Релиз v2.1.0: Официальная отчетность PDF и Excel (ГОСТ 31357)',
    description: 'Модуль экспорта сменных рапортов, расчет статистического отклонения и соответствия нормативным стандартам.',
    author: 'Инженер ОТК Морозов Д.А.',
    changelog: [
      'Внедрен экспорт сменных отчетов в векторный PDF с заводским штампом ОТК',
      'Реализована выгрузка сводных ведомостей расхода сырья в Excel / CSV',
      'Автоматический расчет среднего отклонения на замес и суммарного баланса смены',
      'Архив завершенных смен с быстрым поиском'
    ],
    checksum: 'SHA256-5B108AE4',
    meta: {
      recipesCount: 4
    }
  },
  {
    id: 'ver_v200_official',
    version: '2.0.0',
    timestamp: '2026-07-15T07:00:00.000Z',
    type: 'release',
    title: 'Релиз v2.0.0: Многокомпонентное дозирование смесительного узла',
    description: 'Переход на архитектуру раздельного взвешивания до 6 сырьевых компонентов на один замес (цемент, пески, добавки).',
    author: 'Главный технолог Васильев С.М.',
    changelog: [
      'Поддержка одновременного взвешивания цемента, фракционированного песка и микрокальцита',
      'Звуковая и цветовая сигнализация передозировки / недовеса в реальном времени',
      'Автоматический переход фокуса на следующий компонент по клавише Enter',
      'Журнал замесов с возможностью корректировки и удаления ошибочных записей'
    ],
    checksum: 'SHA256-431A77C8',
    meta: {
      recipesCount: 4
    }
  },
  {
    id: 'ver_v100_official',
    version: '1.0.0',
    timestamp: '2026-06-01T08:00:00.000Z',
    type: 'release',
    title: 'Релиз v1.0.0: Базовый пульт весового контроля смесителя',
    description: 'Первичный ввод системы весового учета на производственной линии ООО «АЛЕКС».',
    author: 'Разработка АСУ ТП',
    changelog: [
      'Базовый интерфейс оператора смесительного узла',
      'Фиксация времени замеса и фактической массы',
      'Локальное сохранение данных смены в памяти терминала'
    ],
    checksum: 'SHA256-1188D930',
    meta: {
      recipesCount: 2
    }
  }
];

/**
 * Retrieves all version history entries merged with local storage records,
 * sorted from newest to oldest.
 */
export function getAllVersionHistory(): VersionLogEntry[] {
  const customLogs = getStoredVersionLog();
  
  // Combine official registry with custom logs, avoiding duplicates by id
  const map = new Map<string, VersionLogEntry>();

  // Add custom logs first
  customLogs.forEach((item) => {
    map.set(item.id, item);
  });

  // Add official entries if not overwritten
  OFFICIAL_VERSION_REGISTRY.forEach((item) => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });

  const list = Array.from(map.values());

  // Sort by timestamp descending
  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Mark currently active version
  return list.map((item) => ({
    ...item,
    isCurrent: item.version === CURRENT_APP_VERSION,
  }));
}

/**
 * Records a new version or calibration event to the ledger
 */
export function recordVersionEvent(entry: Omit<VersionLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): VersionLogEntry {
  const newEntry: VersionLogEntry = {
    id: entry.id || `ver_evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    version: entry.version,
    type: entry.type,
    title: entry.title,
    description: entry.description,
    author: entry.author || 'Оператор / Технолог пульта',
    changelog: entry.changelog && entry.changelog.length > 0 ? entry.changelog : ['Внесены изменения в конфигурацию системы'],
    affectedRecipes: entry.affectedRecipes,
    checksum: entry.checksum || calculateChecksum(entry),
    backupSnapshotId: entry.backupSnapshotId,
    meta: entry.meta,
  };

  const current = getStoredVersionLog();
  const updated = [newEntry, ...current.filter((x) => x.id !== newEntry.id)];
  saveStoredVersionLog(updated);

  return newEntry;
}

/**
 * Deletes a user-added version log entry
 */
export function deleteVersionLogEntry(id: string): VersionLogEntry[] {
  const current = getStoredVersionLog();
  const updated = current.filter((x) => x.id !== id);
  saveStoredVersionLog(updated);
  return getAllVersionHistory();
}

/**
 * Resets version history back to the official factory baseline
 */
export function resetVersionHistoryToBaseline(): VersionLogEntry[] {
  saveStoredVersionLog([]);
  return getAllVersionHistory();
}

/**
 * Exports Version History as structured plain text / audit sheet
 */
export function exportVersionAuditText(entries: VersionLogEntry[], plantName: string = 'ООО «АЛЕКС»'): string {
  const nowStr = new Date().toLocaleString('ru-RU');
  let text = `=======================================================================\n`;
  text += `   ПАСПОРТ ВЕРСИЙ И ЖУРНАЛ МОДИФИКАЦИЙ ПРОГРАММНОГО ОБЕСПЕЧЕНИЯ\n`;
  text += `   АСУ ТП «ДОЗИРОВАНИЕ И СМЕШИВАНИЕ СУХИХ СТРОИТЕЛЬНЫХ СМЕСЕЙ»\n`;
  text += `   Предприятие: ${plantName}\n`;
  text += `   Дата выгрузки реестра: ${nowStr}\n`;
  text += `   Текущая активная версия ПО: v${CURRENT_APP_VERSION}\n`;
  text += `=======================================================================\n\n`;

  entries.forEach((e, idx) => {
    const d = new Date(e.timestamp).toLocaleDateString('ru-RU');
    const t = new Date(e.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const typeLabel = getTypeLabelRu(e.type);

    text += `[${idx + 1}] ВЕРСИЯ: v${e.version} | ТИП: ${typeLabel} | ДАТА: ${d} ${t}\n`;
    text += `    Название: ${e.title}\n`;
    text += `    Автор / Технолог: ${e.author}\n`;
    if (e.checksum) text += `    Контрольная сумма: ${e.checksum}\n`;
    if (e.affectedRecipes && e.affectedRecipes.length > 0) {
      text += `    Затронутые рецептуры: ${e.affectedRecipes.join(', ')}\n`;
    }
    text += `    Описание: ${e.description}\n`;
    text += `    Журнал изменений (Changelog):\n`;
    e.changelog.forEach((c) => {
      text += `      • ${c}\n`;
    });
    text += `-----------------------------------------------------------------------\n`;
  });

  text += `\nВсего записей в реестре: ${entries.length}\n`;
  text += `Главный технолог ООО «АЛЕКС»: _________________ / Васильев С.М. /\n`;
  text += `Начальник производства:       _________________ / Петров А.В. /\n`;
  return text;
}

/**
 * Downloads version ledger as JSON file
 */
export function exportVersionAuditJson(entries: VersionLogEntry[], plantName: string = 'ООО «АЛЕКС»'): void {
  const payload = {
    document: 'alex_software_version_registry_v1',
    plantName,
    exportedAt: new Date().toISOString(),
    currentAppVersion: CURRENT_APP_VERSION,
    totalRecords: entries.length,
    versionLedger: entries,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Паспорт_версий_ПО_АЛЕКС_v${CURRENT_APP_VERSION}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Prints or opens a formatted printable version audit document
 */
export function openPrintableVersionReport(entries: VersionLogEntry[], plantName: string = 'ООО «АЛЕКС»'): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback: download as text
    const text = exportVersionAuditText(entries, plantName);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Паспорт_версий_ПО_АЛЕКС_v${CURRENT_APP_VERSION}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const nowStr = new Date().toLocaleString('ru-RU');

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Паспорт версий и журнал модификаций ПО — ${plantName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      margin: 25px;
      color: #111;
      background: #fff;
      line-height: 1.45;
      font-size: 13px;
    }
    .header {
      border-bottom: 2px solid #111;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .title {
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 4px 0;
    }
    .subtitle {
      font-size: 13px;
      color: #444;
      margin: 0;
    }
    .meta-box {
      background: #f4f4f0;
      border: 1px solid #e0e0d9;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .version-card {
      border: 1px solid #d0d0c8;
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .version-card.current {
      border: 2px solid #e63b00;
      background: #fffbfa;
    }
    .ver-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .ver-badge {
      font-size: 15px;
      font-weight: 900;
      font-family: monospace;
      color: #111;
    }
    .type-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      background: #eee;
    }
    .ver-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 4px;
      color: #111;
    }
    .ver-desc {
      color: #555;
      margin-bottom: 8px;
    }
    .changelog-list {
      margin: 6px 0 0 16px;
      padding: 0;
    }
    .changelog-list li {
      margin-bottom: 3px;
    }
    .ver-meta {
      font-size: 11px;
      color: #666;
      margin-top: 8px;
      border-top: 1px dashed #e0e0d9;
      padding-top: 6px;
      display: flex;
      gap: 16px;
    }
    .signatures {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #111;
      padding-top: 16px;
      font-size: 12px;
    }
    @media print {
      body { margin: 10mm; font-size: 12px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #e63b00; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
      Печать документа / Сохранить в PDF
    </button>
  </div>

  <div class="header">
    <h1 class="title">ПАСПОРТ ВЕРСИЙ И ЖУРНАЛ МОДИФИКАЦИЙ ПО</h1>
    <p class="subtitle">АСУ ТП «Дозирование и Смешивание сухих строительных смесей» • ${plantName}</p>
  </div>

  <div class="meta-box">
    <div><strong>Текущая версия ПО:</strong> v${CURRENT_APP_VERSION} (Активна)</div>
    <div><strong>Дата формирования реестра:</strong> ${nowStr}</div>
    <div><strong>Всего записей в паспорте:</strong> ${entries.length}</div>
  </div>

  ${entries.map((e) => {
    const isCur = e.version === CURRENT_APP_VERSION;
    const d = new Date(e.timestamp).toLocaleDateString('ru-RU');
    const t = new Date(e.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="version-card ${isCur ? 'current' : ''}">
        <div class="ver-header">
          <div>
            <span class="ver-badge">v${e.version}</span>
            ${isCur ? '<span style="margin-left: 8px; color: #e63b00; font-weight: bold; font-size: 11px;">[ТЕКУЩАЯ ВЕРСИЯ]</span>' : ''}
          </div>
          <span class="type-badge">${getTypeLabelRu(e.type)}</span>
        </div>
        <div class="ver-title">${e.title}</div>
        <div class="ver-desc">${e.description}</div>
        <ul class="changelog-list">
          ${e.changelog.map((c) => `<li>${c}</li>`).join('')}
        </ul>
        <div class="ver-meta">
          <div><strong>Автор / Технолог:</strong> ${e.author}</div>
          <div><strong>Дата регистрации:</strong> ${d} ${t}</div>
          ${e.checksum ? `<div><strong>SHA-256:</strong> ${e.checksum}</div>` : ''}
        </div>
      </div>
    `;
  }).join('')}

  <div class="signatures">
    <div>
      Главный технолог ООО «АЛЕКС»<br><br>
      _______________________ / Васильев С.М. /
    </div>
    <div>
      Начальник производства<br><br>
      _______________________ / Петров А.В. /
    </div>
    <div>
      Инженер АСУ ТП<br><br>
      _______________________ / Смирнов К.И. /
    </div>
  </div>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function getTypeLabelRu(type: VersionEventType): string {
  switch (type) {
    case 'release':
      return 'Официальный релиз';
    case 'patch':
      return 'Патч (.alex-patch)';
    case 'formula_update':
      return 'Модификация рецептуры';
    case 'calibration':
      return 'Калибровка весов';
    case 'rollback':
      return 'Откат версии';
    case 'ota_sync':
      return 'Сетевой Push (OTA SSL)';
    case 'manual_audit':
      return 'Запись аудита';
    default:
      return 'Обновление';
  }
}
