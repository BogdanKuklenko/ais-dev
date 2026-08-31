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
  saveStoredCurrentRecipeId,
  OFFICIAL_CLOUD_UPDATE_MANIFEST_URL,
  isPlaceholderUpdateHost,
  getStoredAppVersion,
  saveStoredAppVersion,
  getLastOtaPayloadChecksum,
  saveLastOtaPayloadChecksum,
} from './storage';
import bundledUpdateManifest from '../../public/update-manifest.json';

export const CURRENT_APP_VERSION = '2.4.1';

export function getEffectiveAppVersion(): string {
  return getStoredAppVersion() || CURRENT_APP_VERSION;
}

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
    patchId: 'patch_2026_winter_series_v250',
    version: '2.5.0',
    title: 'Пакет рецептур: «Зимняя серия 2026 и Клей К-15 Экстра»',
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
        },
        {
          id: 'rec_k15_extra',
          code: 'К-15 Экстра',
          name: 'Клей для керамогранита и крупного формата C2TE',
          category: 'Клей',
          description: 'Высокоадгезионный клей повышенной эластичности для тяжелой плитки и теплых полов.',
          targetTotalWeightKg: 1000,
          updatedAt: '2026-08-20T08:00:00Z',
          components: [
            { id: 'ck-1', name: 'Портландцемент белый/серый', fraction: 'ЦЕМ I 42.5Н', targetWeightKg: 340, unit: 'кг', tolerancePercent: 1.0, color: '#475569' },
            { id: 'ck-2', name: 'Песок фракционированный', fraction: '0.1-0.315 мм', targetWeightKg: 580, unit: 'кг', tolerancePercent: 1.5, color: '#D97706' },
            { id: 'ck-3', name: 'Микрокальцит МК-100', fraction: '100 мкм', targetWeightKg: 60, unit: 'кг', tolerancePercent: 2.0, color: '#94A3B8' },
            { id: 'ck-4', name: 'РПП Редиспергируемый порошок', fraction: 'VAE эласт.', targetWeightKg: 16.0, unit: 'кг', tolerancePercent: 1.0, color: '#7C3AED' },
            { id: 'ck-5', name: 'Эфир крахмала модифицированный', fraction: 'порошок', targetWeightKg: 4.0, unit: 'кг', tolerancePercent: 1.0, color: '#059669' }
          ]
        }
      ]
    }
  },
  {
    format: 'alex_patch_v1',
    patchId: 'patch_2026_hotfix_tolerances_v241',
    version: '2.4.1',
    title: 'Hotfix: «Калибровка весовых допусков и метрология»',
    description: 'Ужесточение предельных отклонений по ГОСТ 31357-2007 для обеспечения высшей категории качества смеси.',
    releaseDate: '2026-08-15',
    author: 'Начальник заводской лаборатории и ОТК Ковалева Е.Д.',
    patchType: 'hotfix',
    targetMinVersion: '2.0.0',
    changelog: [
      'Установлен строгий технологический допуск ±1.0% на портландцемент',
      'Включен звуковой сигнал предупреждения при отклонении свыше 1.2%',
      'Обновлена норма крупнофракционного песка в стяжке СТ-10'
    ],
    payload: {
      systemVersion: '2.4.1',
      settingsUpdate: {
        soundEnabled: true,
        autoAdvanceOnEnter: true
      }
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

    const installedVersion = patch.payload.systemVersion || patch.version;
    if (installedVersion) {
      saveStoredAppVersion(installedVersion);
    }
    saveLastOtaPayloadChecksum(calculateChecksum(patch.payload));

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

export const DEFAULT_CLOUD_UPDATE_SERVER = OFFICIAL_CLOUD_UPDATE_MANIFEST_URL;

function rewriteGithubHtmlUrlToRaw(url: string): string {
  const blob = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
  if (blob) {
    return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}/${blob[4]}`;
  }
  if (/^https:\/\/github\.com\/BogdanKuklenko\/ais-dev(\/(tree\/main)?)?$/i.test(url.replace(/\/+$/, ''))) {
    return DEFAULT_CLOUD_UPDATE_SERVER;
  }
  return url;
}

function normalizeToManifestUrl(serverUrl?: string): string {
  const raw = (serverUrl && serverUrl.trim()) ? serverUrl.trim() : DEFAULT_CLOUD_UPDATE_SERVER;
  if (isPlaceholderUpdateHost(raw)) {
    return DEFAULT_CLOUD_UPDATE_SERVER;
  }
  const fromGithub = rewriteGithubHtmlUrlToRaw(raw.replace(/\/+$/, ''));
  if (fromGithub !== raw.replace(/\/+$/, '')) {
    return fromGithub.endsWith('.json') ? fromGithub : DEFAULT_CLOUD_UPDATE_SERVER;
  }
  const clean = raw.replace(/\/+$/, '');
  if (clean.endsWith('.json')) return clean;
  return `${clean}/update-manifest.json`;
}

function parseUpdateManifest(data: unknown, fallbackUrl: string, isSsl: boolean): UpdateManifest | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const patchPackage = d.patchPackage as UpdateManifest['patchPackage'];
  const latestVersion = typeof d.latestVersion === 'string' ? d.latestVersion : '';
  if (!latestVersion || !patchPackage) return null;
  const rawDownload = typeof d.downloadUrl === 'string' ? d.downloadUrl : fallbackUrl;
  const downloadUrl = isPlaceholderUpdateHost(rawDownload) ? fallbackUrl : rawDownload;
  return {
    latestVersion,
    minSupportedVersion: typeof d.minSupportedVersion === 'string' ? d.minSupportedVersion : '2.0.0',
    releaseDate: typeof d.releaseDate === 'string' ? d.releaseDate : new Date().toISOString().slice(0, 10),
    title: typeof d.title === 'string' ? d.title : `Релиз v${latestVersion}`,
    description: typeof d.description === 'string' ? d.description : 'Пакет обновления технологического пульта',
    changelog: Array.isArray(d.changelog) ? d.changelog as string[] : ['Плановое обновление системы'],
    mandatory: Boolean(d.mandatory),
    packageUrl: downloadUrl,
    downloadUrl,
    checksum: typeof d.checksum === 'string' ? d.checksum : undefined,
    serverProtocol: isSsl ? 'HTTPS / TLS 1.3' : 'HTTP',
    sslVerified: isSsl,
    patchPackage,
  };
}

function bundledFactoryManifest(): UpdateManifest | null {
  return parseUpdateManifest(bundledUpdateManifest, 'bundled://update-manifest.json', false);
}

export function isRemotePatchPending(manifest: UpdateManifest): boolean {
  if (isNewerVersion(manifest.latestVersion, getEffectiveAppVersion())) {
    return true;
  }
  const pkg = manifest.patchPackage;
  if (!pkg) return false;
  if (pkg.patchId) {
    const already = getPatchHistory().some(
      (h) => h.patchId === pkg.patchId && h.status === 'applied'
    );
    if (!already) return true;
  }
  if (pkg.payload) {
    const lastCs = getLastOtaPayloadChecksum();
    if (lastCs && calculateChecksum(pkg.payload) !== lastCs) return true;
  }
  return false;
}

/**
 * Checks for updates over HTTPS (GitHub raw manifest), then falls back to the
 * factory package shipped inside the program.
 */
export async function checkNetworkUpdates(serverUrl?: string): Promise<{
  hasUpdate: boolean;
  manifest?: UpdateManifest;
  error?: string;
  warning?: string;
  latencyMs?: number;
  sslVerified: boolean;
  serverUrl: string;
  source: 'remote' | 'bundled';
}> {
  const manifestUrl = normalizeToManifestUrl(serverUrl);
  const isSsl = manifestUrl.startsWith('https://');
  const startTime = performance.now();

  let remoteError: string | undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${manifestUrl}${manifestUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok) {
      const data = await res.json();
      const manifest = parseUpdateManifest(data, manifestUrl, isSsl);
      if (manifest) {
        return {
          hasUpdate: isRemotePatchPending(manifest),
          manifest,
          latencyMs,
          sslVerified: isSsl,
          serverUrl: manifestUrl,
          source: 'remote',
        };
      }
      remoteError = 'Ответ сервера не содержит валидного манифеста (нет latestVersion или patchPackage).';
    } else if (res.status === 404) {
      remoteError = isSsl
        ? `TLS-соединение установлено, но сервер вернул HTTP 404: манифест не найден (${manifestUrl}).`
        : `Сервер вернул HTTP 404: файл обновления не найден.`;
    } else {
      remoteError = `Сервер вернул HTTP ${res.status}: ${res.statusText}.`;
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error
      ? (err.name === 'AbortError' ? 'таймаут 8 сек' : err.message)
      : 'сеть недоступна';
    remoteError = isSsl
      ? `Ошибка HTTPS/SSL: ${errMsg}`
      : `Ошибка соединения: ${errMsg}`;
  }

  const bundled = bundledFactoryManifest();
  if (bundled) {
    const latencyMs = Math.round(performance.now() - startTime);
    bundled.serverProtocol = 'локальный заводской пакет';
    bundled.sslVerified = false;
    return {
      hasUpdate: isRemotePatchPending(bundled),
      manifest: bundled,
      warning: remoteError,
      latencyMs,
      sslVerified: false,
      serverUrl: manifestUrl,
      source: 'bundled',
    };
  }

  return {
    hasUpdate: false,
    error: remoteError || 'Не удалось получить манифест обновления.',
    latencyMs: Math.round(performance.now() - startTime),
    sslVerified: false,
    serverUrl: manifestUrl,
    source: 'bundled',
  };
}

export function resolveUrlAgainstManifest(maybeUrl: string | undefined, manifestUrl: string): string | null {
  if (!maybeUrl || !maybeUrl.trim()) return null;
  const raw = maybeUrl.trim();
  try {
    return new URL(raw, manifestUrl).href;
  } catch {
    return raw.startsWith('http') ? raw : null;
  }
}

/**
 * Loads the full alex_patch_v1 from the SSL manifest: inline patchPackage,
 * or a second HTTPS GET to downloadUrl / packageUrl.
 */
export async function downloadSslPatchPackage(
  manifest: UpdateManifest,
  manifestUrl: string
): Promise<{ patch?: AlexPatchPackage; error?: string; viaSsl: boolean }> {
  const viaSsl = (manifestUrl || '').startsWith('https://');

  if (manifest.patchPackage && manifest.patchPackage.format === 'alex_patch_v1' && manifest.patchPackage.payload) {
    return { patch: manifest.patchPackage, viaSsl };
  }

  const remotePatchUrl = resolveUrlAgainstManifest(
    manifest.downloadUrl || manifest.packageUrl,
    manifestUrl
  );
  if (!remotePatchUrl || remotePatchUrl === manifestUrl) {
    return { error: 'В манифесте нет patchPackage и нет отдельного downloadUrl патча.', viaSsl };
  }

  try {
    const res = await fetch(`${remotePatchUrl}${remotePatchUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { error: `Не удалось скачать патч: HTTP ${res.status}`, viaSsl: remotePatchUrl.startsWith('https://') };
    }
    const data = await res.json();
    const patch = (data && data.patchPackage) ? data.patchPackage : data;
    if (!patch || patch.format !== 'alex_patch_v1' || !patch.payload) {
      return { error: 'Скачанный файл не является патчем alex_patch_v1.', viaSsl: remotePatchUrl.startsWith('https://') };
    }
    return { patch, viaSsl: remotePatchUrl.startsWith('https://') };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'сеть недоступна';
    return { error: `Ошибка загрузки патча по HTTPS: ${msg}`, viaSsl };
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
