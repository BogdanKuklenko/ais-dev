export interface RecipeComponent {
  id: string;
  name: string;
  fraction?: string; // e.g. '0-0.6 мм', '1.0-2.0 мм', 'М-500'
  targetWeightKg: number; // Норма в кг на 1 замес
  unit: 'кг' | 'г' | 'л';
  tolerancePercent?: number; // Допустимое отклонение в %, по умолч. 1.5%
  color?: string;
}

export interface Recipe {
  id: string;
  code: string; // e.g. 'С-41', 'С-41 Про', 'С-22', 'П-20'
  name: string; // e.g. 'Смесь штукатурная С-41'
  category: 'Штукатурка' | 'Клей' | 'Кладочные' | 'Бетоны и Стяжки' | 'Специальные';
  description?: string;
  targetTotalWeightKg: number;
  components: RecipeComponent[];
  isCustom?: boolean;
  updatedAt: string;
}

export interface BatchItemWeight {
  componentId: string;
  componentName: string;
  fraction?: string;
  targetKg: number;
  actualKg: number;
  deviationKg: number; // actual - target
  deviationPercent: number; // ((actual - target) / target) * 100
}

export interface BatchRecord {
  id: string;
  batchNumber: number; // 1, 2, 3...
  timestamp: string; // ISO string
  recipeId: string;
  recipeCode: string;
  recipeName: string;
  operatorName: string;
  items: BatchItemWeight[];
  totalTargetKg: number;
  totalActualKg: number;
  totalDeviationKg: number;
  notes?: string;
}

export interface ShiftSummary {
  id: string;
  shiftDate: string; // YYYY-MM-DD
  shiftNumber: number; // 1 or 2 (Дневная / Ночная)
  operatorName: string;
  recipeId: string;
  recipeCode: string;
  recipeName: string;
  startTime: string;
  endTime: string;
  batchesCount: number;
  totalTargetWeightKg: number;
  totalActualWeightKg: number;
  totalDeviationKg: number;
  componentTotals: {
    componentId: string;
    name: string;
    fraction?: string;
    totalTargetKg: number;
    totalActualKg: number;
    totalDeviationKg: number;
    deviationPercent: number;
  }[];
  batches: BatchRecord[];
  notes?: string;
  status: 'active' | 'completed';
}

export interface ServerApiSslConfig {
  enabled: boolean;
  serverUrl: string; // e.g. 'https://api.alex-mixes.ru/v1/ota'
  apiKey: string; // API Key / Bearer Token
  sslMode: 'strict' | 'custom_cert' | 'pinning';
  sslCertFingerprint?: string; // SHA-256 fingerprint, e.g. 7F:1B:3C:99:...
  pollIntervalSec: number; // 15, 30, 60, 300, 0
  autoForceApplyMandatoryUpdates: boolean; // Принудительное авто-обновление без подтверждения
  preserveSessionOnHotReload: boolean; // Сохранение сессии и значений замеса в памяти
  lastSyncTime?: string;
  status: 'connected' | 'error' | 'disconnected' | 'syncing';
  errorMessage?: string;
}

export interface AppSettings {
  operatorName: string;
  plantName: string; // e.g. 'ООО «АЛЕКС»'
  soundEnabled: boolean;
  autoAdvanceOnEnter: boolean;
  highContrastMode: boolean;
  fontSize: 'normal' | 'large' | 'extra-large';
  serverApiSsl?: ServerApiSslConfig;
}

export interface SessionStateSnapshot {
  timestamp: string;
  version: string;
  activeShift: ShiftSummary | null;
  batchDraft: BatchDraft | null;
  currentRecipeId: string | null;
  recipes: Recipe[];
  settings: AppSettings;
  updateReason?: string;
}

export interface BatchDraft {
  recipeId: string;
  actualWeights: Record<string, string>;
  editingBatchNum: number | null;
  notes?: string;
  updatedAt: string;
}

export type PatchType = 'recipes_update' | 'system_config' | 'full_rollup' | 'hotfix';

export interface AlexPatchPackage {
  format: 'alex_patch_v1';
  patchId: string;
  version: string;
  title: string;
  description: string;
  releaseDate: string;
  author: string;
  patchType: PatchType;
  targetMinVersion?: string;
  checksum?: string;
  changelog?: string[];
  payload: {
    recipesToAddOrUpdate?: Recipe[];
    recipesToDeleteIds?: string[];
    settingsUpdate?: Partial<AppSettings>;
    systemVersion?: string;
    releaseNotes?: string;
  };
}

export interface UpdateManifest {
  latestVersion: string;
  minSupportedVersion: string;
  releaseDate: string;
  title: string;
  description: string;
  changelog: string[];
  mandatory: boolean;
  packageUrl?: string;
  downloadUrl?: string;
  checksum?: string;
  serverProtocol?: string;
  sslVerified?: boolean;
  patchPackage?: AlexPatchPackage;
}

export interface PatchHistoryRecord {
  id: string;
  appliedAt: string;
  patchId: string;
  patchTitle: string;
  patchVersion: string;
  patchType: PatchType;
  author: string;
  backupId: string;
  status: 'applied' | 'rolled_back';
  details?: string;
}

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  reason: string;
  recipes: Recipe[];
  settings: AppSettings;
  currentRecipeId: string | null;
}

export type VersionEventType = 
  | 'release'
  | 'patch'
  | 'formula_update'
  | 'calibration'
  | 'rollback'
  | 'manual_audit'
  | 'ota_sync';

export interface VersionLogEntry {
  id: string;
  version: string;
  timestamp: string; // ISO string
  type: VersionEventType;
  title: string;
  description: string;
  author: string;
  changelog: string[];
  affectedRecipes?: string[];
  checksum?: string;
  backupSnapshotId?: string;
  isCurrent?: boolean;
  meta?: {
    recipesCount?: number;
    changedComponents?: string[];
    serverProtocol?: string;
    targetMinVersion?: string;
  };
}

