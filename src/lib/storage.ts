import { 
  Recipe, 
  ShiftSummary, 
  AppSettings, 
  BatchRecord, 
  BatchDraft,
  PatchHistoryRecord,
  BackupSnapshot,
  ServerApiSslConfig,
  SessionStateSnapshot
} from '../types';
import { DEFAULT_RECIPES } from '../data/defaultRecipes';

const STORAGE_KEYS = {
  RECIPES: 'alex_production_recipes_v1',
  ACTIVE_SHIFT: 'alex_production_active_shift_v1',
  SAVED_SHIFTS: 'alex_production_saved_shifts_v1',
  SETTINGS: 'alex_production_settings_v1',
  BATCH_DRAFT: 'alex_production_batch_draft_v1',
  CURRENT_RECIPE_ID: 'alex_production_current_recipe_id_v1',
  THEME: 'alex_production_theme_v1',
  PATCH_HISTORY: 'alex_production_patch_history_v1',
  BACKUP_SNAPSHOTS: 'alex_production_backup_snapshots_v1',
  UPDATE_SERVER_URL: 'alex_production_update_server_url_v1',
  SESSION_PRESERVATION: 'alex_production_session_preservation_v1',
  INSTALLED_APP_VERSION: 'alex_production_installed_version_v1',
  LAST_OTA_PAYLOAD_CHECKSUM: 'alex_production_last_ota_payload_cs_v1',
};

/** HTTPS OTA: GitHub raw of public/update-manifest.json (Cloud Run preview is empty 404). */
export const OFFICIAL_CLOUD_UPDATE_HOST = 'raw.githubusercontent.com';
export const OFFICIAL_CLOUD_UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/BogdanKuklenko/ais-dev/main/public/update-manifest.json';

export function isPlaceholderUpdateHost(url: string): boolean {
  const u = (url || '').toLowerCase();
  return (
    u.includes('alex-mixes.ru') ||
    u.includes('updates.alex-mixes.ru') ||
    u.includes('api.alex-mixes.ru') ||
    u.includes('ais-pre-355eyhx4molixaeonprgkr-542213303113')
  );
}

export const DEFAULT_SSL_CONFIG: ServerApiSslConfig = {
  enabled: true,
  serverUrl: OFFICIAL_CLOUD_UPDATE_MANIFEST_URL,
  apiKey: 'ALEX-PLANT-SECURE-KEY-2026',
  sslMode: 'strict',
  sslCertFingerprint: '',
  pollIntervalSec: 30,
  autoForceApplyMandatoryUpdates: true,
  preserveSessionOnHotReload: true,
  status: 'disconnected',
};

export const DEFAULT_SETTINGS: AppSettings = {
  operatorName: 'Оператор пульта',
  plantName: 'ООО «АЛЕКС» — Завод сухих смесей',
  soundEnabled: true,
  autoAdvanceOnEnter: true,
  highContrastMode: false,
  fontSize: 'large', // default to large for industrial screens
  serverApiSsl: DEFAULT_SSL_CONFIG,
};

export function getStoredRecipes(): Recipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECIPES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(DEFAULT_RECIPES));
      return DEFAULT_RECIPES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RECIPES;
  } catch (e) {
    console.error('Failed to load recipes from localStorage', e);
    return DEFAULT_RECIPES;
  }
}

export function saveRecipes(recipes: Recipe[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(recipes));
  } catch (e) {
    console.error('Failed to save recipes', e);
  }
}

export function resetRecipesToDefault(): Recipe[] {
  localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(DEFAULT_RECIPES));
  return DEFAULT_RECIPES;
}

export function getStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...parsed };
    merged.serverApiSsl = {
      ...DEFAULT_SSL_CONFIG,
      ...(parsed.serverApiSsl || {}),
    };
    if (isPlaceholderUpdateHost(merged.serverApiSsl.serverUrl || '')) {
      merged.serverApiSsl.serverUrl = OFFICIAL_CLOUD_UPDATE_MANIFEST_URL;
      merged.serverApiSsl.status = 'disconnected';
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

export function getBatchDraft(): BatchDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BATCH_DRAFT);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Failed to load batch draft', e);
    return null;
  }
}

export function saveBatchDraft(draft: BatchDraft | null): void {
  try {
    if (draft === null) {
      localStorage.removeItem(STORAGE_KEYS.BATCH_DRAFT);
    } else {
      localStorage.setItem(STORAGE_KEYS.BATCH_DRAFT, JSON.stringify(draft));
    }
  } catch (e) {
    console.error('Failed to save batch draft', e);
  }
}

export function clearBatchDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.BATCH_DRAFT);
  } catch (e) {
    console.error('Failed to clear batch draft', e);
  }
}

export function getStoredCurrentRecipeId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_RECIPE_ID);
  } catch {
    return null;
  }
}

export function saveStoredCurrentRecipeId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_RECIPE_ID, id);
  } catch (e) {
    console.error('Failed to save current recipe ID', e);
  }
}

export function getStoredTheme(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.THEME);
    return raw !== null ? JSON.parse(raw) : true; // default dark
  } catch {
    return true;
  }
}

export function saveStoredTheme(isDark: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(isDark));
  } catch (e) {
    console.error('Failed to save theme', e);
  }
}

export function getActiveShift(): ShiftSummary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveActiveShift(shift: ShiftSummary | null): void {
  try {
    if (shift === null) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);
    } else {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(shift));
    }
  } catch (e) {
    console.error('Failed to save active shift', e);
  }
}

export function getSavedShifts(): ShiftSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_SHIFTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCompletedShift(shift: ShiftSummary): void {
  try {
    const current = getSavedShifts();
    const updated = [shift, ...current.filter((s) => s.id !== shift.id)];
    localStorage.setItem(STORAGE_KEYS.SAVED_SHIFTS, JSON.stringify(updated));
    // Clear active shift if it was the same
    const active = getActiveShift();
    if (active && active.id === shift.id) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);
    }
  } catch (e) {
    console.error('Failed to archive shift', e);
  }
}

export function deleteSavedShift(shiftId: string): ShiftSummary[] {
  try {
    const current = getSavedShifts();
    const updated = current.filter((s) => s.id !== shiftId);
    localStorage.setItem(STORAGE_KEYS.SAVED_SHIFTS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete shift', e);
    return getSavedShifts();
  }
}

export function calculateShiftSummary(
  batches: BatchRecord[],
  recipe: Recipe,
  shiftMeta: {
    id: string;
    shiftDate: string;
    shiftNumber: number;
    operatorName: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }
): ShiftSummary {
  const componentMap = new Map<
    string,
    {
      componentId: string;
      name: string;
      fraction?: string;
      totalTargetKg: number;
      totalActualKg: number;
    }
  >();

  // Initialize with recipe components
  recipe.components.forEach((c) => {
    componentMap.set(c.id, {
      componentId: c.id,
      name: c.name,
      fraction: c.fraction,
      totalTargetKg: 0,
      totalActualKg: 0,
    });
  });

  let totalTargetWeightKg = 0;
  let totalActualWeightKg = 0;

  batches.forEach((b) => {
    totalTargetWeightKg += b.totalTargetKg;
    totalActualWeightKg += b.totalActualKg;

    b.items.forEach((item) => {
      const existing = componentMap.get(item.componentId);
      if (existing) {
        existing.totalTargetKg += item.targetKg;
        existing.totalActualKg += item.actualKg;
      } else {
        componentMap.set(item.componentId, {
          componentId: item.componentId,
          name: item.componentName,
          fraction: item.fraction,
          totalTargetKg: item.targetKg,
          totalActualKg: item.actualKg,
        });
      }
    });
  });

  const componentTotals = Array.from(componentMap.values()).map((c) => {
    const diff = c.totalActualKg - c.totalTargetKg;
    const pct = c.totalTargetKg > 0 ? (diff / c.totalTargetKg) * 100 : 0;
    return {
      componentId: c.componentId,
      name: c.name,
      fraction: c.fraction,
      totalTargetKg: Number(c.totalTargetKg.toFixed(2)),
      totalActualKg: Number(c.totalActualKg.toFixed(2)),
      totalDeviationKg: Number(diff.toFixed(2)),
      deviationPercent: Number(pct.toFixed(2)),
    };
  });

  return {
    id: shiftMeta.id,
    shiftDate: shiftMeta.shiftDate,
    shiftNumber: shiftMeta.shiftNumber,
    operatorName: shiftMeta.operatorName,
    recipeId: recipe.id,
    recipeCode: recipe.code,
    recipeName: recipe.name,
    startTime: shiftMeta.startTime,
    endTime: shiftMeta.endTime || new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    batchesCount: batches.length,
    totalTargetWeightKg: Number(totalTargetWeightKg.toFixed(2)),
    totalActualWeightKg: Number(totalActualWeightKg.toFixed(2)),
    totalDeviationKg: Number((totalActualWeightKg - totalTargetWeightKg).toFixed(2)),
    componentTotals,
    batches,
    notes: shiftMeta.notes,
    status: 'completed',
  };
}

export function getPatchHistory(): PatchHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PATCH_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePatchHistory(history: PatchHistoryRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PATCH_HISTORY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save patch history', e);
  }
}

export function getBackupSnapshots(): BackupSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BACKUP_SNAPSHOTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBackupSnapshots(snapshots: BackupSnapshot[]): void {
  try {
    // Keep max 10 backups to preserve localStorage space
    const trimmed = snapshots.slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.BACKUP_SNAPSHOTS, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save backup snapshots', e);
  }
}

export const DEFAULT_PRODUCTION_UPDATE_URL = OFFICIAL_CLOUD_UPDATE_MANIFEST_URL;

export function getStoredUpdateServerUrl(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.UPDATE_SERVER_URL);
    if (!raw || isPlaceholderUpdateHost(raw)) {
      return DEFAULT_PRODUCTION_UPDATE_URL;
    }
    return raw;
  } catch {
    return DEFAULT_PRODUCTION_UPDATE_URL;
  }
}

export function saveStoredUpdateServerUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.UPDATE_SERVER_URL, url);
  } catch (e) {
    console.error('Failed to save update server URL', e);
  }
}

export function getStoredAppVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.INSTALLED_APP_VERSION);
  } catch {
    return null;
  }
}

export function saveStoredAppVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INSTALLED_APP_VERSION, version);
  } catch (e) {
    console.error('Failed to save installed app version', e);
  }
}

export function getLastOtaPayloadChecksum(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_OTA_PAYLOAD_CHECKSUM);
  } catch {
    return null;
  }
}

export function saveLastOtaPayloadChecksum(checksum: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_OTA_PAYLOAD_CHECKSUM, checksum);
  } catch (e) {
    console.error('Failed to save OTA payload checksum', e);
  }
}

export function saveEmergencySessionSnapshot(snapshot: SessionStateSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION_PRESERVATION, JSON.stringify(snapshot));
  } catch (e) {
    console.error('Failed to save emergency session snapshot', e);
  }
}

export function getEmergencySessionSnapshot(): SessionStateSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION_PRESERVATION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearEmergencySessionSnapshot(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION_PRESERVATION);
  } catch (e) {
    console.error('Failed to clear emergency session snapshot', e);
  }
}

export function playBeep(type: 'success' | 'warning' | 'error') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'warning') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Audio might be disabled or blocked by browser policy
  }
}
