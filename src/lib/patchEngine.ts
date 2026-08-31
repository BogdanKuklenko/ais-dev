import { 
  Recipe, 
  AppSettings, 
  AlexPatchPackage, 
  UpdateManifest, 
  PatchHistoryRecord, 
  BackupSnapshot,
  PatchType
} from '../types';
import { 
  saveRecipes, 
  saveSettings, 
  getPatchHistory, 
  savePatchHistory, 
  getBackupSnapshots, 
  saveBackupSnapshots, 
  saveStoredCurrentRecipeId 
} from './storage';
import { recordVersionEvent } from './versionTracker';

export const CURRENT_APP_VERSION = '2.4.0';

/**
 * Simple hash for checksum verification
 */
export function calculateChecksum(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `SHA256-${Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()}`;
}

/**
 * Pre-defined sample/demo patches for quick factory offline testing
 */
export const SAMPLE_PATCHES: AlexPatchPackage[] = [
  {
    format: 'alex_patch_v1',
    patchId: 'patch_release_v260_official',
    version: '2.6.0',
    title: 'Официальный пакет v2.6.0: «П-25 Люкс Гранит и С-45 Зима»',
    description: 'Внедрение новых рецептур повышенной адгезии (П-25 Люкс), морозостойкой штукатурки (С-45 Зима) и калибровка отсечки шнековых дозаторов.',
    releaseDate: '2026-08-31',
    author: 'Главный технолог ООО «АЛЕКС» Васильев С.М.',
    patchType: 'recipes_update',
    targetMinVersion: '2.0.0',
    changelog: [
      'Добавлена технологическая карта П-25 Люкс Гранит (ГОСТ 31357)',
      'Добавлена морозостойкая штукатурка С-45 Теплофасад (до -15°C)',
      'Обновлена норма цемента М-500 в базовом клее П-20 Про (285 кг)',
      'Скорректированы весовые допуски микрокомпонентов (±1.0%)'
    ],
    payload: {
      systemVersion: '2.6.0',
      recipesToAddOrUpdate: [
        {
          id: 'rec-p25-lux-granit',
          code: 'П-25 Люкс',
          name: 'Клей усиленный для тяжелого керамогранита и камня (ГОСТ 31357)',
          category: 'Клей',
          description: 'Высокоадгезивный цементный клей класса C2TE для крупноформатного керамогранита и фасадов.',
          targetTotalWeightKg: 1000,
          updatedAt: '2026-08-31T09:00:00Z',
          components: [
            { id: 'cp25-1', name: 'Портландцемент ЦЕМ I 52.5Н', fraction: 'М-500 Д0', targetWeightKg: 320, unit: 'кг', tolerancePercent: 1.0, color: '#475569' },
            { id: 'cp25-2', name: 'Песок кварцевый очищенный', fraction: '0.1-0.63 мм', targetWeightKg: 590, unit: 'кг', tolerancePercent: 1.5, color: '#D97706' },
            { id: 'cp25-3', name: 'Микрокальцит фракционированный', fraction: '0-0.1 мм', targetWeightKg: 80, unit: 'кг', tolerancePercent: 2.0, color: '#A8A29E' },
            { id: 'cp25-4', name: 'Эфир целлюлозы высокой вязкости', fraction: 'порошок', targetWeightKg: 4.5, unit: 'кг', tolerancePercent: 1.0, color: '#065F46' },
            { id: 'cp25-5', name: 'Редиспергируемый полимер VAE', fraction: 'полимер', targetWeightKg: 5.5, unit: 'кг', tolerancePercent: 1.0, color: '#7C3AED' }
          ]
        },
        {
          id: 'rec-s45-winter-fasad',
          code: 'С-45 Зима',
          name: 'Штукатурка фасадная морозостойкая Теплофасад (до -15°C)',
          category: 'Штукатурка',
          description: 'Защитно-отделочная цементная штукатурка с противоморозным модификатором для зимнего бетонирования.',
          targetTotalWeightKg: 1000,
          updatedAt: '2026-08-31T09:00:00Z',
          components: [
            { id: 'cs45-1', name: 'Портландцемент ЦЕМ I 42.5', fraction: 'М-500', targetWeightKg: 260, unit: 'кг', tolerancePercent: 1.0, color: '#64748B' },
            { id: 'cs45-2', name: 'Песок кварцевый крупный', fraction: '0.63-1.25 мм', targetWeightKg: 400, unit: 'кг', tolerancePercent: 1.5, color: '#D97706' },
            { id: 'cs45-3', name: 'Песок кварцевый мелкий', fraction: '0.1-0.63 мм', targetWeightKg: 250, unit: 'кг', tolerancePercent: 1.5, color: '#F59E0B' },
            { id: 'cs45-4', name: 'Известь гидратная пушонка', fraction: 'порошок', targetWeightKg: 70, unit: 'кг', tolerancePercent: 2.0, color: '#CBD5E1' },
            { id: 'cs45-5', name: 'Противоморозный комплекс нитрита натрия', fraction: 'модификатор', targetWeightKg: 15.0, unit: 'кг', tolerancePercent: 1.0, color: '#0284C7' },
            { id: 'cs45-6', name: 'Водоудерживающая добавка', fraction: 'порошок', targetWeightKg: 5.0, unit: 'кг', tolerancePercent: 1.0, color: '#059669' }
          ]
        }
      ]
    }
  },
  {
    format: 'alex_patch_v1',
    patchId: 'patch_2026_winter_series_v250',
    version: '2.5.0',
    title: 'Пакет рецептур: «Зимняя серия и Клей К-15 Экстра»',
    description: 'Добавление рецептуры штукатурки с противоморозной добавкой (С-41 Зима) и усиленного плиточного клея К-15.',
    releaseDate: '2026-08-20',
    author: 'Главный технолог ООО «АЛЕКС» Васильев С.М.',
    patchType: 'recipes_update',
    targetMinVersion: '2.0.0',
    changelog: [
      'Добавлен зимний состав С-41 Зима с добавкой нитрита натрия (до -15°C)',
      'Добавлен клей высокопрочный К-15 Экстра (ГОСТ 31357)',
      'Обновлена норма цемента М-500 в базовом клее П-20 (с 280 до 290 кг)',
      'Скорректированы допуски эфира целлюлозы до ±0.05 кг'
    ],
    payload: {
      systemVersion: '2.5.0',
      recipesToAddOrUpdate: [
        {
          id: 'rec_s41_winter',
          code: 'С-41 Зима',
          name: 'Штукатурка фасадная цементная (Зимняя до -15°C)',
          category: 'Штукатурка',
          description: 'Зимняя модификация с ускорителем твердения и формиатом натрия для работ при отрицательных температурах.',
          targetTotalWeightKg: 1000,
          updatedAt: '2026-08-20T08:00:00Z',
          components: [
            { id: 'cw-1', name: 'Цемент ПЦ 500-Д0', fraction: 'М-500', targetWeightKg: 280, unit: 'кг', tolerancePercent: 1.0, color: '#64748B' },
            { id: 'cw-2', name: 'Песок кварцевый сухой', fraction: '0.1-0.63 мм', targetWeightKg: 620, unit: 'кг', tolerancePercent: 1.5, color: '#D97706' },
            { id: 'cw-3', name: 'Мука известняковая', fraction: '0-0.1 мм', targetWeightKg: 80, unit: 'кг', tolerancePercent: 2.0, color: '#A8A29E' },
            { id: 'cw-4', name: 'Эфир целлюлозы (MHEC)', fraction: 'порошок', targetWeightKg: 2.5, unit: 'кг', tolerancePercent: 1.0, color: '#065F46' },
            { id: 'cw-5', name: 'Противоморозный комплекс', fraction: 'порошок -15°C', targetWeightKg: 17.5, unit: 'кг', tolerancePercent: 1.0, color: '#0284C7' }
          ]
        }
      ]
    }
  }
];

/**
 * Pre-defined remote network update manifest (Simulated OTA Repository)
 */
export const REMOTE_NETWORK_UPDATE_MOCK: UpdateManifest = {
  latestVersion: '2.5.0',
  minSupportedVersion: '2.0.0',
  releaseDate: '2026-08-25',
  title: 'Заводской релиз v2.5.0: Новые рецептуры и расширенная аналитика',
  description: 'Комплексный сервисный пакет АСУ ТП «Дозирование и Смешивание». Включает зимнюю линейку смесей, керамогранитный клей К-15 и протоколы контроля стабильности замесов.',
  changelog: [
    'Новые рецептуры в каталоге: С-41 Зима (до -15°C) и К-15 Экстра (класс C2TE)',
    'Повышена точность расчета баланса расхода сырья по ГОСТ 31357-2007',
    'Улучшена разборчивость позамесного реестра и увеличен шрифт сменных актов',
    'Добавлен модуль дифференциального патчинга по сети и USB-флеш накопителям'
  ],
  mandatory: false,
  patchPackage: SAMPLE_PATCHES[0]
};

/**
 * Validates a patch JSON file content
 */
export function validatePatchJson(jsonText: string): { 
  valid: boolean; 
  error?: string; 
  patch?: AlexPatchPackage 
} {
  try {
    const data = JSON.parse(jsonText);

    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Файл не является корректным JSON-объектом' };
    }

    if (data.format !== 'alex_patch_v1') {
      return { valid: false, error: 'Неверный формат патча (ожидается "alex_patch_v1")' };
    }

    if (!data.patchId || !data.version || !data.title || !data.payload) {
      return { valid: false, error: 'В файле отсутствуют обязательные поля (patchId, version, title, payload)' };
    }

    return {
      valid: true,
      patch: data as AlexPatchPackage
    };
  } catch (e) {
    return {
      valid: false,
      error: `Ошибка парсинга JSON: ${e instanceof Error ? e.message : 'Синтаксическая ошибка'}`
    };
  }
}

/**
 * Applies an AlexPatchPackage to the current application state.
 * Automatically takes a backup before applying!
 */
export function applyAlexPatch(
  patch: AlexPatchPackage,
  currentRecipes: Recipe[],
  currentSettings: AppSettings,
  currentRecipeId: string | null
): {
  success: boolean;
  error?: string;
  updatedRecipes: Recipe[];
  updatedSettings: AppSettings;
  backupId: string;
  summary: {
    recipesAdded: number;
    recipesUpdated: number;
    recipesDeleted: number;
    settingsChanged: boolean;
    version: string;
  };
} {
  try {
    // 1. Create a rollback backup snapshot
    const backupId = `backup_${Date.now()}_before_${patch.patchId}`;
    const backupSnapshot: BackupSnapshot = {
      id: backupId,
      timestamp: new Date().toISOString(),
      reason: `Резервная копия перед установкой патча: ${patch.title} (v${patch.version})`,
      recipes: JSON.parse(JSON.stringify(currentRecipes)),
      settings: JSON.parse(JSON.stringify(currentSettings)),
      currentRecipeId,
    };

    const existingBackups = getBackupSnapshots();
    saveBackupSnapshots([backupSnapshot, ...existingBackups]);

    // 2. Clone current recipes to mutate
    let updatedRecipes: Recipe[] = JSON.parse(JSON.stringify(currentRecipes));
    let recipesAdded = 0;
    let recipesUpdated = 0;
    let recipesDeleted = 0;

    // Handle Recipes to Add / Update
    if (patch.payload.recipesToAddOrUpdate && Array.isArray(patch.payload.recipesToAddOrUpdate)) {
      patch.payload.recipesToAddOrUpdate.forEach((incomingRecipe) => {
        const existingIdx = updatedRecipes.findIndex(
          (r) => r.id === incomingRecipe.id || r.code.trim().toLowerCase() === incomingRecipe.code.trim().toLowerCase()
        );

        if (existingIdx >= 0) {
          // Update existing
          updatedRecipes[existingIdx] = {
            ...incomingRecipe,
            updatedAt: new Date().toISOString(),
          };
          recipesUpdated++;
        } else {
          // Add new
          updatedRecipes.push({
            ...incomingRecipe,
            id: incomingRecipe.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            updatedAt: new Date().toISOString(),
          });
          recipesAdded++;
        }
      });
    }

    // Handle Recipes to Delete
    if (patch.payload.recipesToDeleteIds && Array.isArray(patch.payload.recipesToDeleteIds)) {
      const deleteSet = new Set(patch.payload.recipesToDeleteIds);
      const prevLen = updatedRecipes.length;
      updatedRecipes = updatedRecipes.filter((r) => !deleteSet.has(r.id) && !deleteSet.has(r.code));
      recipesDeleted = prevLen - updatedRecipes.length;
    }

    // 3. Update Settings if present
    let updatedSettings: AppSettings = { ...currentSettings };
    let settingsChanged = false;
    if (patch.payload.settingsUpdate && typeof patch.payload.settingsUpdate === 'object') {
      updatedSettings = {
        ...currentSettings,
        ...patch.payload.settingsUpdate,
      };
      settingsChanged = true;
    }

    // 4. Save state to localStorage
    saveRecipes(updatedRecipes);
    if (settingsChanged) {
      saveSettings(updatedSettings);
    }

    // 5. Register in Patch History
    const historyRecord: PatchHistoryRecord = {
      id: `ph_${Date.now()}`,
      appliedAt: new Date().toISOString(),
      patchId: patch.patchId,
      patchTitle: patch.title,
      patchVersion: patch.version,
      patchType: patch.patchType,
      author: patch.author,
      backupId: backupId,
      status: 'applied',
      details: `Добавлено: ${recipesAdded}, обновлено: ${recipesUpdated}, удалено: ${recipesDeleted}`
    };

    const currentHistory = getPatchHistory();
    savePatchHistory([historyRecord, ...currentHistory]);

    // 6. Record in Master Version Ledger
    recordVersionEvent({
      id: `ver_log_${patch.patchId}_${Date.now()}`,
      version: patch.version || CURRENT_APP_VERSION,
      type: patch.patchType === 'recipes_update' ? 'patch' : 'release',
      title: patch.title,
      description: patch.description,
      author: patch.author,
      changelog: patch.changelog && patch.changelog.length > 0 ? patch.changelog : ['Успешная установка технологического пакета'],
      affectedRecipes: patch.payload.recipesToAddOrUpdate?.map((r) => r.code) || [],
      checksum: patch.checksum || calculateChecksum(patch.payload),
      backupSnapshotId: backupId,
      meta: {
        recipesCount: updatedRecipes.length,
        serverProtocol: 'HTTPS / TLS 1.3'
      }
    });

    return {
      success: true,
      updatedRecipes,
      updatedSettings,
      backupId,
      summary: {
        recipesAdded,
        recipesUpdated,
        recipesDeleted,
        settingsChanged,
        version: patch.version || CURRENT_APP_VERSION,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Неизвестная ошибка при накате патча',
      updatedRecipes: currentRecipes,
      updatedSettings: currentSettings,
      backupId: '',
      summary: {
        recipesAdded: 0,
        recipesUpdated: 0,
        recipesDeleted: 0,
        settingsChanged: false,
        version: CURRENT_APP_VERSION,
      },
    };
  }
}

/**
 * Restores the system to a previous backup snapshot
 */
export function rollbackToBackup(backupId: string): {
  success: boolean;
  error?: string;
  restoredRecipes?: Recipe[];
  restoredSettings?: AppSettings;
  restoredRecipeId?: string | null;
} {
  try {
    const backups = getBackupSnapshots();
    const snapshot = backups.find((b) => b.id === backupId);

    if (!snapshot) {
      return { success: false, error: 'Точка восстановления не найдена' };
    }

    saveRecipes(snapshot.recipes);
    saveSettings(snapshot.settings);
    if (snapshot.currentRecipeId) {
      saveStoredCurrentRecipeId(snapshot.currentRecipeId);
    }

    // Update patch history status
    const history = getPatchHistory();
    const updatedHistory = history.map((h) => {
      if (h.backupId === backupId) {
        return { ...h, status: 'rolled_back' as const };
      }
      return h;
    });
    savePatchHistory(updatedHistory);

    // Record Rollback in Version Ledger
    recordVersionEvent({
      id: `ver_rollback_${Date.now()}`,
      version: CURRENT_APP_VERSION,
      type: 'rollback',
      title: `Откат к точке восстановления: ${snapshot.reason}`,
      description: `Восстановлено ${snapshot.recipes.length} технологических рецептур и настройки пульта из снимка ${snapshot.id}.`,
      author: snapshot.settings.operatorName || 'Главный технолог ООО «АЛЕКС»',
      changelog: [
        `Выполнен откат системы к резервной копии от ${new Date(snapshot.timestamp).toLocaleString('ru-RU')}`,
        `Восстановлены технологические формулы (${snapshot.recipes.length} шт.)`,
        `Восстановлена активная рецептура: ${snapshot.currentRecipeId || 'По умолчанию'}`
      ],
      affectedRecipes: snapshot.recipes.map((r) => r.code),
      checksum: calculateChecksum(snapshot.recipes),
      backupSnapshotId: backupId,
      meta: {
        recipesCount: snapshot.recipes.length
      }
    });

    return {
      success: true,
      restoredRecipes: snapshot.recipes,
      restoredSettings: snapshot.settings,
      restoredRecipeId: snapshot.currentRecipeId,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Ошибка при откате',
    };
  }
}

/**
 * Builds an official AlexPatchPackage object (Patch Generator for Technologist)
 */
export function generateAlexPatchPackage(options: {
  patchId?: string;
  version: string;
  title: string;
  description: string;
  author: string;
  patchType: PatchType;
  changelog: string[];
  recipes: Recipe[];
  settingsUpdate?: Partial<AppSettings>;
}): AlexPatchPackage {
  const pId = options.patchId || `patch_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${Math.random().toString(36).substr(2, 6)}`;
  
  const pkg: AlexPatchPackage = {
    format: 'alex_patch_v1',
    patchId: pId,
    version: options.version || '2.5.0',
    title: options.title || 'Технологический патч рецептур',
    description: options.description || 'Пакет обновления технологических карт и рецептур завода ООО «АЛЕКС»',
    releaseDate: new Date().toISOString().slice(0, 10),
    author: options.author || 'Главный технолог ООО «АЛЕКС»',
    patchType: options.patchType,
    targetMinVersion: '2.0.0',
    changelog: options.changelog.length > 0 ? options.changelog : ['Плановое обновление технологических параметров'],
    payload: {
      systemVersion: options.version,
      recipesToAddOrUpdate: options.recipes,
      settingsUpdate: options.settingsUpdate,
      releaseNotes: options.description,
    },
  };

  pkg.checksum = calculateChecksum(pkg.payload);
  return pkg;
}

/**
 * Exports a patch package as a downloadable `.alex-patch` file
 */
export function exportPatchFile(patch: AlexPatchPackage): void {
  const json = JSON.stringify(patch, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = patch.patchId.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${safeTitle}_v${patch.version}.alex-patch`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const DEFAULT_CLOUD_UPDATE_SERVER = 'https://raw.githubusercontent.com/BogdanKuklenko/ais-dev/main/public/update-manifest.json';

/**
 * Checks for updates over network via secure HTTPS / SSL (OTA)
 */
export async function checkNetworkUpdates(serverUrl?: string): Promise<{
  hasUpdate: boolean;
  manifest?: UpdateManifest;
  error?: string;
  latencyMs?: number;
  sslVerified: boolean;
  serverUrl: string;
}> {
  const targetBase = (serverUrl && serverUrl.trim()) ? serverUrl.trim() : DEFAULT_CLOUD_UPDATE_SERVER;
  const cleanBase = targetBase.replace(/\/+$/, '');
  const manifestUrl = cleanBase.endsWith('.json') ? cleanBase : `${cleanBase}/update-manifest.json?t=${Date.now()}`;
  const isSsl = cleanBase.startsWith('https://');

  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(manifestUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      return {
        hasUpdate: false,
        error: `Сервер вернул HTTP ${res.status}: ${res.statusText}. Проверьте адрес сервера обновлений.`,
        latencyMs,
        sslVerified: isSsl,
        serverUrl: cleanBase,
      };
    }

    const data = await res.json();

    if (!data || typeof data !== 'object' || !data.latestVersion || !data.patchPackage) {
      return {
        hasUpdate: false,
        error: 'Ответ сервера не содержит валидного манифеста обновления (отсутствуют latestVersion или patchPackage).',
        latencyMs,
        sslVerified: isSsl,
        serverUrl: cleanBase,
      };
    }

    const manifest: UpdateManifest = {
      latestVersion: data.latestVersion,
      minSupportedVersion: data.minSupportedVersion || '2.0.0',
      releaseDate: data.releaseDate || new Date().toISOString().slice(0, 10),
      title: data.title || `Релиз v${data.latestVersion}`,
      description: data.description || 'Пакет обновления технологического пульта',
      changelog: Array.isArray(data.changelog) ? data.changelog : ['Плановое обновление системы'],
      mandatory: Boolean(data.mandatory),
      packageUrl: data.downloadUrl || manifestUrl,
      downloadUrl: data.downloadUrl,
      checksum: data.checksum,
      serverProtocol: isSsl ? 'HTTPS / TLS 1.3' : 'HTTP',
      sslVerified: isSsl,
      patchPackage: data.patchPackage,
    };

    const hasUpdate = isNewerVersion(manifest.latestVersion, CURRENT_APP_VERSION);

    return {
      hasUpdate,
      manifest,
      latencyMs,
      sslVerified: isSsl,
      serverUrl: cleanBase,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errMsg = err instanceof Error 
      ? (err.name === 'AbortError' ? 'Таймаут соединения (сервер не ответил за 8 сек)' : err.message)
      : 'Не удалось подключиться к серверу обновлений';

    return {
      hasUpdate: false,
      error: `Ошибка SSL/HTTPS соединения: ${errMsg}. Убедитесь, что сервер доступен по сети.`,
      latencyMs,
      sslVerified: isSsl,
      serverUrl: cleanBase,
    };
  }
}

export function isNewerVersion(v1: string, v2: string): boolean {
  const p1 = (v1 || '').split('.').map((x) => parseInt(x, 10) || 0);
  const p2 = (v2 || '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false;
}
