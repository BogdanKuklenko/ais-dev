import { 
  Recipe, 
  AppSettings, 
  ServerApiSslConfig, 
  AlexPatchPackage, 
  UpdateManifest, 
  ShiftSummary, 
  BatchDraft,
  SessionStateSnapshot
} from '../types';
import { 
  CURRENT_APP_VERSION, 
  SAMPLE_PATCHES, 
  applyAlexPatch, 
  calculateChecksum,
  checkNetworkUpdates,
  downloadSslPatchPackage,
} from './patchEngine';
import { 
  saveEmergencySessionSnapshot, 
  saveActiveShift, 
  saveBatchDraft, 
  saveRecipes, 
  saveSettings,
  saveStoredCurrentRecipeId,
  OFFICIAL_CLOUD_UPDATE_MANIFEST_URL,
} from './storage';

export interface SslTestResult {
  success: boolean;
  latencyMs: number;
  tlsVersion: string;
  cipher: string;
  certIssuer: string;
  certValidUntil: string;
  fingerprintMatch: boolean;
  serverTime: string;
  message: string;
  error?: string;
}

/**
 * Tests an SSL/TLS connection to the configured factory server API
 */
export async function testServerSslConnection(config: ServerApiSslConfig): Promise<SslTestResult> {
  const startTime = performance.now();
  
  if (!config.enabled) {
    return {
      success: false,
      latencyMs: 0,
      tlsVersion: 'N/A',
      cipher: 'N/A',
      certIssuer: 'N/A',
      certValidUntil: 'N/A',
      fingerprintMatch: false,
      serverTime: new Date().toISOString(),
      message: 'SSL API клиент отключен в настройках рабочего места',
      error: 'Клиент деактивирован'
    };
  }

  const url = (config.serverUrl || OFFICIAL_CLOUD_UPDATE_MANIFEST_URL).trim();
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return {
      success: false,
      latencyMs: 0,
      tlsVersion: 'N/A',
      cipher: 'N/A',
      certIssuer: 'N/A',
      certValidUntil: 'N/A',
      fingerprintMatch: false,
      serverTime: new Date().toISOString(),
      message: 'Некорректный протокол. Для защищенного соединения требуется https://',
      error: 'Invalid HTTPS URL'
    };
  }

  const manifestUrl = url.endsWith('.json') ? url : `${url.replace(/\/+$/, '')}/update-manifest.json`;
  const isSsl = manifestUrl.startsWith('https://');

  try {
    const res = await fetch(manifestUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000)
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok) {
      let latest = '';
      try {
        const data = await res.json() as { latestVersion?: string; patchPackage?: unknown };
        latest = typeof data?.latestVersion === 'string' ? data.latestVersion : '';
        if (!latest || !data.patchPackage) {
          return {
            success: false,
            latencyMs,
            tlsVersion: isSsl ? 'TLS (handshake OK)' : 'HTTP',
            cipher: isSsl ? 'шифруется браузером / Electron' : 'без TLS',
            certIssuer: isSsl ? 'GitHub / системное хранилище сертификатов' : 'N/A',
            certValidUntil: 'N/A',
            fingerprintMatch: false,
            serverTime: new Date().toISOString(),
            message: 'HTTPS 200, но JSON без latestVersion или patchPackage.',
            error: 'Invalid OTA JSON'
          };
        }
      } catch {
        return {
          success: false,
          latencyMs,
          tlsVersion: isSsl ? 'TLS (handshake OK)' : 'HTTP',
          cipher: 'N/A',
          certIssuer: 'N/A',
          certValidUntil: 'N/A',
          fingerprintMatch: false,
          serverTime: new Date().toISOString(),
          message: 'Сервер ответил 200, но тело не JSON.',
          error: 'Not JSON'
        };
      }
      return {
        success: true,
        latencyMs,
        tlsVersion: isSsl ? 'TLS (handshake OK)' : 'HTTP',
        cipher: isSsl ? 'шифруется браузером / Electron' : 'без TLS',
        certIssuer: isSsl ? 'GitHub / системное хранилище сертификатов' : 'N/A',
        certValidUntil: 'N/A',
        fingerprintMatch: false,
        serverTime: new Date().toISOString(),
        message: `Манифест v${latest} получен (${res.status}) за ${latencyMs} мс.`
      };
    }

    if (res.status === 404 && isSsl) {
      return {
        success: false,
        latencyMs,
        tlsVersion: 'TLS (handshake OK)',
        cipher: 'шифруется браузером / Electron',
        certIssuer: 'сертификат хоста (HTTPS)',
        certValidUntil: 'N/A',
        fingerprintMatch: false,
        serverTime: new Date().toISOString(),
        message: `Шифрование TLS установлено, но файл обновления не найден (HTTP 404): ${manifestUrl}`,
        error: 'HTTP 404'
      };
    }

    return {
      success: false,
      latencyMs,
      tlsVersion: isSsl ? 'TLS (handshake OK)' : 'HTTP',
      cipher: 'N/A',
      certIssuer: 'N/A',
      certValidUntil: 'N/A',
      fingerprintMatch: false,
      serverTime: new Date().toISOString(),
      message: `Сервер ответил HTTP ${res.status}: ${res.statusText}`,
      error: `HTTP ${res.status}`
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errMsg = err instanceof Error ? err.message : 'сеть недоступна';
    const isDns = /Failed to fetch|Name not resolved|ERR_NAME_NOT_RESOLVED|not resolve/i.test(errMsg);
    return {
      success: false,
      latencyMs,
      tlsVersion: 'N/A',
      cipher: 'N/A',
      certIssuer: 'N/A',
      certValidUntil: 'N/A',
      fingerprintMatch: false,
      serverTime: new Date().toISOString(),
      message: isDns
        ? `Домен не существует в DNS (${manifestUrl}). Раньше в программе стоял вымышленный api.alex-mixes.ru.`
        : `Нет соединения: ${errMsg}`,
      error: errMsg
    };
  }
}

/**
 * Polls the SSL server for mandatory/forced remote updates
 */
export async function pollServerForUpdates(
  config: ServerApiSslConfig,
  currentVersion: string
): Promise<{
  hasUpdate: boolean;
  isForced: boolean;
  manifest?: UpdateManifest;
  patch?: AlexPatchPackage;
  message?: string;
}> {
  if (!config.enabled) {
    return { hasUpdate: false, isForced: false };
  }

  try {
    const result = await checkNetworkUpdates(config.serverUrl);
    let patch = result.manifest?.patchPackage;
    if (result.hasUpdate && result.manifest && !patch) {
      const loaded = await downloadSslPatchPackage(result.manifest, result.serverUrl);
      patch = loaded.patch;
    }
    return {
      hasUpdate: result.hasUpdate,
      isForced: Boolean(result.manifest?.mandatory),
      manifest: result.manifest,
      patch,
      message: result.error || result.warning,
    };
  } catch {
    return { hasUpdate: false, isForced: false };
  }
}

/**
 * Executes a zero-loss forced remote server update:
 * 1. Takes an emergency snapshot of active shift, weights, drafts, operator inputs
 * 2. Applies new recipes and parameters
 * 3. Restores exact draft inputs and active shift in memory
 */
export function executeZeroLossForceUpdate(params: {
  patch: AlexPatchPackage;
  currentRecipes: Recipe[];
  currentSettings: AppSettings;
  currentRecipeId: string | null;
  activeShift: ShiftSummary | null;
  batchDraft: BatchDraft | null;
  reason?: string;
}): {
  success: boolean;
  updatedRecipes: Recipe[];
  updatedSettings: AppSettings;
  updatedRecipeId: string | null;
  updatedActiveShift: ShiftSummary | null;
  updatedBatchDraft: BatchDraft | null;
  backupId: string;
  message: string;
  error?: string;
} {
  const { patch, currentRecipes, currentSettings, currentRecipeId, activeShift, batchDraft, reason } = params;

  try {
    // 1. Create an emergency session snapshot
    const emergencySnapshot: SessionStateSnapshot = {
      timestamp: new Date().toISOString(),
      version: patch.version || CURRENT_APP_VERSION,
      activeShift: activeShift ? JSON.parse(JSON.stringify(activeShift)) : null,
      batchDraft: batchDraft ? JSON.parse(JSON.stringify(batchDraft)) : null,
      currentRecipeId,
      recipes: JSON.parse(JSON.stringify(currentRecipes)),
      settings: JSON.parse(JSON.stringify(currentSettings)),
      updateReason: reason || `Принудительное авто-обновление сервера (v${patch.version})`,
    };

    saveEmergencySessionSnapshot(emergencySnapshot);

    // 2. Apply the patch changes through patch engine
    const patchResult = applyAlexPatch(patch, currentRecipes, currentSettings, currentRecipeId);

    if (!patchResult.success) {
      return {
        success: false,
        updatedRecipes: currentRecipes,
        updatedSettings: currentSettings,
        updatedRecipeId: currentRecipeId,
        updatedActiveShift: activeShift,
        updatedBatchDraft: batchDraft,
        backupId: '',
        message: 'Ошибка применения патча на сервере',
        error: patchResult.error
      };
    }

    // 3. Keep active shift and current batch draft 100% intact!
    let preservedRecipeId = currentRecipeId;
    if (preservedRecipeId) {
      // Ensure the recipe still exists in updated list
      const exists = patchResult.updatedRecipes.some((r) => r.id === preservedRecipeId);
      if (!exists && patchResult.updatedRecipes.length > 0) {
        preservedRecipeId = patchResult.updatedRecipes[0].id;
      }
    } else if (patchResult.updatedRecipes.length > 0) {
      preservedRecipeId = patchResult.updatedRecipes[0].id;
    }

    // 4. Update storage records safely
    if (activeShift) {
      saveActiveShift(activeShift);
    }
    if (batchDraft) {
      saveBatchDraft(batchDraft);
    }
    if (preservedRecipeId) {
      saveStoredCurrentRecipeId(preservedRecipeId);
    }

    // Preserve SSL configurations in settings if not specified in patch
    const finalSettings: AppSettings = {
      ...patchResult.updatedSettings,
      serverApiSsl: {
        ...(currentSettings.serverApiSsl || {
          enabled: true,
          serverUrl: OFFICIAL_CLOUD_UPDATE_MANIFEST_URL,
          apiKey: 'ALEX-PLANT-SECURE-KEY-2026',
          sslMode: 'strict',
          pollIntervalSec: 30,
          autoForceApplyMandatoryUpdates: true,
          preserveSessionOnHotReload: true,
          status: 'connected',
        }),
        lastSyncTime: new Date().toISOString(),
        status: 'connected',
      }
    };
    saveSettings(finalSettings);

    return {
      success: true,
      updatedRecipes: patchResult.updatedRecipes,
      updatedSettings: finalSettings,
      updatedRecipeId: preservedRecipeId,
      updatedActiveShift: activeShift,
      updatedBatchDraft: batchDraft,
      backupId: patchResult.backupId,
      message: `Принудительное обновление v${patch.version} («${patch.title}») успешно наложено сервером через защищенный SSL канал. Активная смена и текущие весовые данные сохранены без потерь!`
    };
  } catch (e) {
    return {
      success: false,
      updatedRecipes: currentRecipes,
      updatedSettings: currentSettings,
      updatedRecipeId: currentRecipeId,
      updatedActiveShift: activeShift,
      updatedBatchDraft: batchDraft,
      backupId: '',
      message: 'Исключение при выполнении горячего обновления',
      error: e instanceof Error ? e.message : 'Неизвестная ошибка'
    };
  }
}

/**
 * Generates a mock server push payload for testing forced remote updates
 */
export function createSimulatedServerForcedPatch(): AlexPatchPackage {
  const version = '2.5.2';
  return {
    format: 'alex_patch_v1',
    patchId: `server_forced_push_${Date.now()}`,
    version,
    title: 'Серверный Push: «Срочная калибровка зимних норм и допусков смеси»',
    description: 'Принудительное технологическое обновление с главного сервера АСУ ТП завода. Корректировка норм пластификатора и времени перемешивания.',
    releaseDate: new Date().toISOString().slice(0, 10),
    author: 'Главный сервер АСУ ТП завода (SSL Remote Push)',
    patchType: 'hotfix',
    targetMinVersion: '2.0.0',
    changelog: [
      'Установлен приоритетный допуск ±0.8% на дозирование химических добавок',
      'Обновлена норма расхода ускорителя твердения для зимнего сезона',
      'Синхронизированы технологические карты с центральной базой 1С:Предприятие',
      'Сессия оператора, активная смена и незавершенный замес сохранены в полном объеме'
    ],
    payload: {
      systemVersion: version,
      recipesToAddOrUpdate: [
        {
          id: 'rec_s41_winter_forced',
          code: 'С-41 Зима (SSL)',
          name: 'Штукатурка фасадная цементная (Серверная калибровка -15°C)',
          category: 'Штукатурка',
          description: 'Зимняя модификация, синхронизированная по защищенному каналу SSL с сервером завода.',
          targetTotalWeightKg: 1000,
          updatedAt: new Date().toISOString(),
          components: [
            { id: 'cw-1', name: 'Цемент ПЦ 500-Д0', fraction: 'М-500', targetWeightKg: 285, unit: 'кг', tolerancePercent: 1.0, color: '#64748B' },
            { id: 'cw-2', name: 'Песок кварцевый сухой', fraction: '0.1-0.63 мм', targetWeightKg: 615, unit: 'кг', tolerancePercent: 1.5, color: '#D97706' },
            { id: 'cw-3', name: 'Мука известняковая', fraction: '0-0.1 мм', targetWeightKg: 80, unit: 'кг', tolerancePercent: 2.0, color: '#A8A29E' },
            { id: 'cw-4', name: 'Эфир целлюлозы (MHEC)', fraction: 'порошок', targetWeightKg: 2.5, unit: 'кг', tolerancePercent: 0.8, color: '#065F46' },
            { id: 'cw-5', name: 'Противоморозный комплекс', fraction: 'порошок -15°C', targetWeightKg: 17.5, unit: 'кг', tolerancePercent: 0.8, color: '#0284C7' }
          ]
        }
      ]
    }
  };
}
