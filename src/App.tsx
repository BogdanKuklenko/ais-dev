import React, { useState, useEffect, useCallback } from 'react';
import { 
  Recipe, 
  BatchRecord, 
  ShiftSummary, 
  AppSettings,
  AlexPatchPackage
} from './types';
import { 
  getStoredRecipes, 
  saveRecipes, 
  resetRecipesToDefault,
  getActiveShift, 
  saveActiveShift, 
  getSavedShifts, 
  saveCompletedShift, 
  deleteSavedShift,
  getStoredSettings, 
  saveSettings, 
  calculateShiftSummary,
  playBeep,
  getStoredCurrentRecipeId,
  saveStoredCurrentRecipeId,
  getStoredTheme,
  saveStoredTheme,
  getEmergencySessionSnapshot,
  clearEmergencySessionSnapshot,
  getBatchDraft
} from './lib/storage';
import { 
  pollServerForUpdates, 
  executeZeroLossForceUpdate, 
  createSimulatedServerForcedPatch 
} from './lib/serverApiClient';
import { CURRENT_APP_VERSION } from './lib/patchEngine';
import { exportShiftToExcel } from './lib/exportExcel';
import { exportShiftToPdf } from './lib/exportPdf';
import { Header, ActiveTab } from './components/Header';
import { RecipeSelector } from './components/RecipeSelector';
import { ActiveBatchPanel } from './components/ActiveBatchPanel';
import { BatchHistoryTable } from './components/BatchHistoryTable';
import { ShiftSummaryModal } from './components/ShiftSummaryModal';
import { SavedShiftsHistory } from './components/SavedShiftsHistory';
import { RecipeManagerModal } from './components/RecipeManagerModal';
import { TechSupportModal } from './components/TechSupportModal';
import { PrintReportView } from './components/PrintReportView';
import { UpdateManagerModal } from './components/UpdateManagerModal';
import { 
  FlaskConical, 
  Sparkles, 
  FileSpreadsheet, 
  FileText, 
  RotateCcw, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Scale,
  Plus,
  Trash2,
  Edit3,
  Lock,
  Zap,
  Radio,
  X
} from 'lucide-react';

interface ForcedUpdateBannerInfo {
  id: string;
  title: string;
  version: string;
  message: string;
  timestamp: string;
  type: 'forced_remote_update' | 'session_restored' | 'patch_applied';
}

export default function App() {
  // 1. Data States
  const [recipes, setRecipes] = useState<Recipe[]>(() => getStoredRecipes());
  const [currentRecipe, setCurrentRecipe] = useState<Recipe>(() => {
    const list = getStoredRecipes();
    const storedId = getStoredCurrentRecipeId();
    if (storedId) {
      const found = list.find((r) => r.id === storedId);
      if (found) return found;
    }
    return list.find((r) => r.code === 'С-41') || list[0];
  });

  const [settings, setSettings] = useState<AppSettings>(() => getStoredSettings());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getStoredTheme());
  const [activeTab, setActiveTab] = useState<ActiveTab>('console');

  // Shift & Batches State
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [shiftDate, setShiftDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [shiftNumber, setShiftNumber] = useState<number>(1);
  const [startTime, setStartTime] = useState<string>(
    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  );
  const [shiftId, setShiftId] = useState<string>(`shift_${Date.now()}`);
  const [savedShifts, setSavedShifts] = useState<ShiftSummary[]>(() => getSavedShifts());

  // Forced Update & Session Persistence Banner
  const [forcedUpdateBanner, setForcedUpdateBanner] = useState<ForcedUpdateBannerInfo | null>(null);

  // 2. Modals Visibility
  const [isRecipeSelectorOpen, setIsRecipeSelectorOpen] = useState<boolean>(false);
  const [isRecipeManagerOpen, setIsRecipeManagerOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [summaryModalShift, setSummaryModalShift] = useState<ShiftSummary | null>(null);
  const [printModalShift, setPrintModalShift] = useState<ShiftSummary | null>(null);

  const handleUpdateSystemState = (
    updatedRecipes: Recipe[],
    updatedSettings: AppSettings,
    updatedRecipeId?: string | null
  ) => {
    setRecipes(updatedRecipes);
    setSettings(updatedSettings);

    if (updatedRecipeId) {
      const found = updatedRecipes.find((r) => r.id === updatedRecipeId);
      if (found) setCurrentRecipe(found);
    } else {
      // Ensure currentRecipe is still valid in the new recipe list
      const stillExists = updatedRecipes.find((r) => r.id === currentRecipe.id || r.code === currentRecipe.code);
      if (stillExists) {
        setCurrentRecipe(stillExists);
      } else if (updatedRecipes.length > 0) {
        setCurrentRecipe(updatedRecipes[0]);
      }
    }
  };

  // Zero-Loss Forced Update Execution Handler
  const handleExecuteForcedServerUpdate = useCallback((patchPackage?: AlexPatchPackage, reason?: string) => {
    const targetPatch = patchPackage || createSimulatedServerForcedPatch();
    const currentDraft = getBatchDraft();

    // Construct current shift summary to snapshot
    let activeShiftSummary: ShiftSummary | null = null;
    if (batches.length > 0 && currentRecipe) {
      activeShiftSummary = calculateShiftSummary(batches, currentRecipe, {
        id: shiftId,
        shiftDate,
        shiftNumber,
        operatorName: settings.operatorName,
        startTime,
        endTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    const res = executeZeroLossForceUpdate({
      patch: targetPatch,
      currentRecipes: recipes,
      currentSettings: settings,
      currentRecipeId: currentRecipe.id,
      activeShift: activeShiftSummary,
      batchDraft: currentDraft,
      reason: reason || `Принудительный Push v${targetPatch.version} с центрального сервера АСУ ТП (SSL API)`,
    });

    if (res.success) {
      setRecipes(res.updatedRecipes);
      setSettings(res.updatedSettings);
      if (res.updatedRecipeId) {
        const found = res.updatedRecipes.find((r) => r.id === res.updatedRecipeId);
        if (found) setCurrentRecipe(found);
      }
      if (settings.soundEnabled) {
        playBeep('success');
      }

      setForcedUpdateBanner({
        id: `force_update_${Date.now()}`,
        title: `Принудительное обновление v${targetPatch.version} наложено сервером`,
        version: targetPatch.version,
        message: `Центральный сервер АСУ ТП через защищенный SSL/HTTPS канал наложил обновление «${targetPatch.title}» без прерывания работы. Все данные активной смены (${batches.length} замесов) и текущие веса сохранены в памяти!`,
        timestamp: new Date().toLocaleTimeString('ru-RU'),
        type: 'forced_remote_update'
      });
    }
  }, [recipes, settings, currentRecipe, batches, shiftId, shiftDate, shiftNumber, startTime]);

  // 3. Load active shift or emergency snapshot from storage on mount
  useEffect(() => {
    // Check if an emergency session snapshot was preserved
    const emergencySnapshot = getEmergencySessionSnapshot();
    if (emergencySnapshot) {
      if (emergencySnapshot.activeShift && emergencySnapshot.activeShift.batches) {
        setBatches(emergencySnapshot.activeShift.batches);
        setShiftDate(emergencySnapshot.activeShift.shiftDate);
        setShiftNumber(emergencySnapshot.activeShift.shiftNumber);
        setStartTime(emergencySnapshot.activeShift.startTime);
        setShiftId(emergencySnapshot.activeShift.id);
      }
      if (emergencySnapshot.recipes && emergencySnapshot.recipes.length > 0) {
        setRecipes(emergencySnapshot.recipes);
      }
      if (emergencySnapshot.currentRecipeId && emergencySnapshot.recipes) {
        const found = emergencySnapshot.recipes.find((r) => r.id === emergencySnapshot.currentRecipeId);
        if (found) setCurrentRecipe(found);
      }
      if (emergencySnapshot.settings) {
        setSettings(emergencySnapshot.settings);
      }

      setForcedUpdateBanner({
        id: `restored_${Date.now()}`,
        title: 'Сессия и параметры полностью сохранены!',
        version: emergencySnapshot.version,
        message: `Сессия оператора успешно восстановлена без потерь: ${emergencySnapshot.activeShift?.batches?.length || 0} замесов в смене, рецепт «${emergencySnapshot.currentRecipeId}», сохранены все допуски и веса.`,
        timestamp: new Date().toLocaleTimeString('ru-RU'),
        type: 'session_restored'
      });

      // Clear once safely loaded in memory
      clearEmergencySessionSnapshot();
      return;
    }

    // Standard active shift loading
    const active = getActiveShift();
    if (active && active.batches && active.batches.length > 0) {
      setBatches(active.batches);
      setShiftDate(active.shiftDate);
      setShiftNumber(active.shiftNumber);
      setStartTime(active.startTime);
      setShiftId(active.id);
      const matchingRecipe = recipes.find((r) => r.id === active.recipeId);
      if (matchingRecipe) {
        setCurrentRecipe(matchingRecipe);
      }
    }
  }, []);

  // 4. Background SSL API Polling Loop for Forced Remote Updates
  useEffect(() => {
    const sslCfg = settings.serverApiSsl;
    if (!sslCfg || !sslCfg.enabled || !sslCfg.pollIntervalSec || sslCfg.pollIntervalSec <= 0) {
      return;
    }

    const intervalMs = Math.max(10, sslCfg.pollIntervalSec) * 1000;
    const poller = setInterval(async () => {
      try {
        const checkResult = await pollServerForUpdates(sslCfg, CURRENT_APP_VERSION);
        if (checkResult.hasUpdate && checkResult.isForced && sslCfg.autoForceApplyMandatoryUpdates) {
          const patchToApply = checkResult.patch || createSimulatedServerForcedPatch();
          handleExecuteForcedServerUpdate(patchToApply, 'Автоматический опрос сервера по защищенному SSL API (TLS 1.3)');
        }
      } catch (err) {
        // Polling failure is non-blocking
      }
    }, intervalMs);

    return () => clearInterval(poller);
  }, [settings.serverApiSsl, handleExecuteForcedServerUpdate]);

  // Save active shift continuously
  useEffect(() => {
    if (batches.length > 0 && currentRecipe) {
      const summary = calculateShiftSummary(batches, currentRecipe, {
        id: shiftId,
        shiftDate,
        shiftNumber,
        operatorName: settings.operatorName,
        startTime,
        endTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      });
      saveActiveShift(summary);
    } else {
      saveActiveShift(null);
    }
  }, [batches, currentRecipe, shiftDate, shiftNumber, settings.operatorName, startTime, shiftId]);

  const handleSelectRecipe = (recipe: Recipe) => {
    setCurrentRecipe(recipe);
    saveStoredCurrentRecipeId(recipe.id);
  };

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      saveStoredTheme(next);
      return next;
    });
  };

  // Batch handlers
  const handleSaveBatch = (newBatch: BatchRecord) => {
    setBatches((prev) => {
      const existingIdx = prev.findIndex((b) => b.batchNumber === newBatch.batchNumber);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newBatch;
        return updated;
      }
      return [...prev, newBatch];
    });
  };

  const handleDeleteBatch = (batchId: string) => {
    setBatches((prev) => {
      const filtered = prev.filter((b) => b.id !== batchId);
      return filtered.map((b, idx) => ({
        ...b,
        batchNumber: idx + 1,
      }));
    });
  };

  const handleFinishShift = () => {
    if (batches.length === 0) {
      alert('В текущей смене ещё нет ни одного замеса!');
      return;
    }
    const currentSummary = calculateShiftSummary(batches, currentRecipe, {
      id: shiftId,
      shiftDate,
      shiftNumber,
      operatorName: settings.operatorName,
      startTime,
      endTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    });

    saveCompletedShift(currentSummary);
    setSavedShifts(getSavedShifts());
    setSummaryModalShift(currentSummary);
  };

  const handleStartNewShift = () => {
    if (batches.length > 0) {
      const currentSummary = calculateShiftSummary(batches, currentRecipe, {
        id: shiftId,
        shiftDate,
        shiftNumber,
        operatorName: settings.operatorName,
        startTime,
        endTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      });
      saveCompletedShift(currentSummary);
      setSavedShifts(getSavedShifts());
    }

    setBatches([]);
    setShiftId(`shift_${Date.now()}`);
    setStartTime(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    setSummaryModalShift(null);
    setActiveTab('console');
  };

  const handleDirectPdfExport = async () => {
    if (batches.length === 0) return;
    const summary = calculateShiftSummary(batches, currentRecipe, {
      id: shiftId,
      shiftDate,
      shiftNumber,
      operatorName: settings.operatorName,
      startTime,
      endTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    });
    await exportShiftToPdf(summary, currentRecipe);
  };

  // Recipe management handlers
  const handleSaveRecipe = (updatedRecipe: Recipe) => {
    const existingIdx = recipes.findIndex((r) => r.id === updatedRecipe.id);
    let updatedList: Recipe[];
    if (existingIdx >= 0) {
      updatedList = [...recipes];
      updatedList[existingIdx] = updatedRecipe;
    } else {
      updatedList = [updatedRecipe, ...recipes];
    }
    setRecipes(updatedList);
    saveRecipes(updatedList);
    if (currentRecipe.id === updatedRecipe.id) {
      setCurrentRecipe(updatedRecipe);
    }
  };

  const handleDeleteRecipe = (recipeId: string) => {
    const updated = recipes.filter((r) => r.id !== recipeId);
    setRecipes(updated);
    saveRecipes(updated);
    if (currentRecipe.id === recipeId && updated.length > 0) {
      setCurrentRecipe(updated[0]);
    }
  };

  const handleResetDefaultRecipes = () => {
    const defaults = resetRecipesToDefault();
    setRecipes(defaults);
    setCurrentRecipe(defaults[0]);
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Demo generator
  const handleLoadDemoShift = () => {
    if (batches.length > 0) {
      if (!window.confirm('Заполнить демонстрационные 40 замесов по формуле С-41?')) {
        return;
      }
    }

    const recipe = currentRecipe;
    const demoBatches: BatchRecord[] = [];
    const now = Date.now();

    for (let i = 1; i <= 40; i++) {
      let totalTarget = 0;
      let totalActual = 0;

      const items = recipe.components.map((comp) => {
        const variance = Math.round((Math.random() * 16 - 6) * 10) / 10;
        const actualKg = Math.max(0, comp.targetWeightKg + variance);
        const deviationKg = Number((actualKg - comp.targetWeightKg).toFixed(2));
        const deviationPercent = Number(((deviationKg / comp.targetWeightKg) * 100).toFixed(2));

        totalTarget += comp.targetWeightKg;
        totalActual += actualKg;

        return {
          componentId: comp.id,
          componentName: comp.name,
          fraction: comp.fraction,
          targetKg: comp.targetWeightKg,
          actualKg,
          deviationKg,
          deviationPercent,
        };
      });

      totalTarget = Number(totalTarget.toFixed(2));
      totalActual = Number(totalActual.toFixed(2));
      const totalDev = Number((totalActual - totalTarget).toFixed(2));

      demoBatches.push({
        id: `demo_batch_${now}_${i}`,
        batchNumber: i,
        timestamp: new Date(now - (40 - i) * 3 * 60 * 1000).toISOString(),
        recipeId: recipe.id,
        recipeCode: recipe.code,
        recipeName: recipe.name,
        operatorName: settings.operatorName,
        items,
        totalTargetKg: totalTarget,
        totalActualKg: totalActual,
        totalDeviationKg: totalDev,
      });
    }

    setBatches(demoBatches);
    if (settings.soundEnabled) playBeep('success');
  };

  const totalActualTons = batches.reduce((acc, b) => acc + b.totalActualKg, 0) / 1000;
  const totalActualKgSum = batches.reduce((acc, b) => acc + b.totalActualKg, 0);
  const totalTargetKgSum = batches.reduce((acc, b) => acc + b.totalTargetKg, 0);
  const totalDeviationKgSum = Number((totalActualKgSum - totalTargetKgSum).toFixed(2));
  const nextBatchNumber = batches.length + 1;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#0E0F12] text-[#EDEDED]' : 'bg-[#F8F8F5] text-[#111215]'} transition-colors font-sans antialiased`}>
      {/* Minimalist Top Header */}
      <Header
        currentRecipe={currentRecipe}
        operatorName={settings.operatorName}
        shiftNumber={shiftNumber}
        shiftDate={shiftDate}
        batchesCount={batches.length}
        totalTons={totalActualTons}
        totalDeviationKg={totalDeviationKgSum}
        settings={settings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRecipeSelect={() => setIsRecipeSelectorOpen(true)}
        onOpenSupport={() => setIsSupportOpen(true)}
        onOpenUpdates={() => setIsUpdateModalOpen(true)}
        onToggleSound={() => handleUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
        onToggleTheme={handleToggleTheme}
        isDarkMode={isDarkMode}
        onFinishShift={handleFinishShift}
        onExportPdf={handleDirectPdfExport}
      />

      {/* Main Workspace Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
        
        {/* Zero-Loss Force Update / Session Restored Banner */}
        {forcedUpdateBanner && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500/60 shadow-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950">
                    {forcedUpdateBanner.type === 'forced_remote_update' ? 'SSL API Force Push' : 'Сессия Сохранена'}
                  </span>
                  <span className="font-bold text-xs sm:text-sm text-emerald-300">
                    {forcedUpdateBanner.title}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    [{forcedUpdateBanner.timestamp}]
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  {forcedUpdateBanner.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <button
                type="button"
                onClick={() => setIsUpdateModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
              >
                Центр обновлений
              </button>
              <button
                type="button"
                onClick={() => setForcedUpdateBanner(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Закрыть уведомление"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Quick Shift Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] shadow-xs text-xs text-[#111215] dark:text-white transition-colors">
          <div className="flex items-center gap-2 font-mono text-[#5E6472] dark:text-[#A0A6B5]">
            <span className="w-2 h-2 rounded-full bg-[#E63B00]"></span>
            <span>
              Смена №{shiftNumber} • {shiftDate} • Оператор: <strong className="text-[#111215] dark:text-white">{settings.operatorName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadDemoShift}
              id="btn-load-demo-data"
              className="px-2.5 py-1 rounded-lg bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-[11px] font-semibold flex items-center gap-1.5 transition"
              title="Заполнить 40 тестовых замесов"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E63B00]" />
              <span>Демо 40 замесов</span>
            </button>

            {batches.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Очистить все замесы текущей смены?')) {
                    setBatches([]);
                  }
                }}
                className="px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#717684] hover:text-rose-600 dark:hover:text-rose-400 text-[11px] font-medium transition"
              >
                Очистить
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: OPERATOR CONSOLE (Kept in DOM so switching tabs never loses state or focus) */}
        <div className={activeTab === 'console' ? 'space-y-6 animate-fadeIn' : 'hidden'}>
          <ActiveBatchPanel
            recipe={currentRecipe}
            currentBatchNumber={nextBatchNumber}
            operatorName={settings.operatorName}
            onSaveBatch={handleSaveBatch}
            onFinishShift={handleFinishShift}
            batchesHistory={batches}
            settings={settings}
          />

          {/* Quick Mini Table in console view */}
          {batches.length > 0 && (
            <BatchHistoryTable
              batches={batches}
              recipe={currentRecipe}
              onEditBatch={(batchNum) => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDeleteBatch={handleDeleteBatch}
              onFinishShift={handleFinishShift}
              onExportExcel={() => {
                const summary = calculateShiftSummary(batches, currentRecipe, {
                  id: shiftId,
                  shiftDate,
                  shiftNumber,
                  operatorName: settings.operatorName,
                  startTime,
                  endTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                });
                exportShiftToExcel(summary, currentRecipe);
              }}
              onExportPdf={handleDirectPdfExport}
              onPrintReport={() => {
                const summary = calculateShiftSummary(batches, currentRecipe, {
                  id: shiftId,
                  shiftDate,
                  shiftNumber,
                  operatorName: settings.operatorName,
                  startTime,
                  endTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                });
                setPrintModalShift(summary);
              }}
            />
          )}
        </div>

        {/* TAB 2: JOURNAL OF BATCHES */}
        {activeTab === 'journal' && (
          <div className="animate-fadeIn">
            <BatchHistoryTable
              batches={batches}
              recipe={currentRecipe}
              onEditBatch={(batchNum) => {
                setActiveTab('console');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDeleteBatch={handleDeleteBatch}
              onFinishShift={handleFinishShift}
              onExportExcel={() => {
                if (batches.length === 0) return;
                const summary = calculateShiftSummary(batches, currentRecipe, {
                  id: shiftId,
                  shiftDate,
                  shiftNumber,
                  operatorName: settings.operatorName,
                  startTime,
                  endTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                });
                exportShiftToExcel(summary, currentRecipe);
              }}
              onExportPdf={handleDirectPdfExport}
              onPrintReport={() => {
                if (batches.length === 0) return;
                const summary = calculateShiftSummary(batches, currentRecipe, {
                  id: shiftId,
                  shiftDate,
                  shiftNumber,
                  operatorName: settings.operatorName,
                  startTime,
                  endTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                });
                setPrintModalShift(summary);
              }}
            />
          </div>
        )}

        {/* TAB 3: FORMULAS / RECIPES REPOSITORY */}
        {activeTab === 'recipes' && (
          <div className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl p-4 sm:p-5 shadow-sm space-y-4 animate-fadeIn transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EBEBE6] dark:border-[#26282E] pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4 text-[#E63B00]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#111215] dark:text-white text-base">
                    Рецептуры и нормы смеси
                  </h3>
                  <p className="text-xs text-[#717684] dark:text-[#8E95A5] font-mono">
                    Активная формула: <strong className="text-[#E63B00]">{currentRecipe.code} ({currentRecipe.name})</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRecipeManagerOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#111215] hover:bg-[#252830] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] text-xs font-bold flex items-center gap-1.5 transition shadow-xs self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5 text-[#E63B00]" />
                <span>Редактор формул</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {recipes.map((r) => {
                const isSelected = r.id === currentRecipe.id;
                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3.5 ${
                      isSelected
                        ? 'bg-[#FFF6F3] dark:bg-[#201815] border-[#E63B00] shadow-sm ring-1 ring-[#E63B00]/30'
                        : 'bg-white dark:bg-[#1A1C22] border-[#E5E5E0] dark:border-[#26282E] hover:border-[#111215] dark:hover:border-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-[#111215] dark:text-white text-lg">{r.code}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#F0F0EB] dark:bg-[#262830] text-[#5E6472] dark:text-[#A0A6B5] font-mono font-bold">
                          {r.targetTotalWeightKg} кг / замес
                        </span>
                      </div>
                      <h4 className="font-bold text-[#111215] dark:text-white text-sm mt-1">{r.name}</h4>
                      <p className="text-xs text-[#717684] dark:text-[#8E95A5] mt-0.5 line-clamp-1">{r.description || 'Стандартная рецептура'}</p>

                      <div className="space-y-1 mt-3 text-xs font-mono">
                        {r.components.map((c) => (
                          <div key={c.id} className="flex justify-between text-[#5E6472] dark:text-[#A0A6B5] text-[11px] py-0.5 border-b border-[#F0F0EB] dark:border-[#262830]/50 last:border-0">
                            <span>{c.name}:</span>
                            <strong className="text-[#111215] dark:text-white">{c.targetWeightKg} кг</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        handleSelectRecipe(r);
                        setActiveTab('console');
                      }}
                      className={`w-full py-2 rounded-lg font-mono font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#E63B00] text-white cursor-default shadow-xs'
                          : 'bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#262830] dark:hover:bg-[#30333C] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#333640]'
                      }`}
                    >
                      {isSelected ? '✓ Активна на пульте' : 'Выбрать для работы'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: SHIFTS ARCHIVE */}
        {activeTab === 'archive' && (
          <div className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl p-4 sm:p-5 shadow-sm space-y-4 animate-fadeIn transition-colors">
            <div className="flex items-center justify-between border-b border-[#EBEBE6] dark:border-[#26282E] pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-bold">
                  <History className="w-4 h-4 text-[#E63B00]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#111215] dark:text-white text-base">
                    Архив сменных рапортов
                  </h3>
                  <p className="text-xs text-[#717684] dark:text-[#8E95A5] font-mono">
                    История завершённых смен завода ООО «АЛЕКС»
                  </p>
                </div>
              </div>
            </div>

            {savedShifts.length === 0 ? (
              <div className="py-12 text-center text-[#717684] space-y-2">
                <History className="w-8 h-8 mx-auto opacity-30 text-[#E63B00]" />
                <p className="font-semibold text-sm text-[#111215] dark:text-white">В архиве пока нет сохранённых смен</p>
                <p className="text-xs text-[#717684] dark:text-[#8E95A5]">
                  После завершения смены на пульте отчёт будет автоматически сохранён сюда.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-white dark:bg-[#1A1C22] p-4 rounded-xl border border-[#E5E5E0] dark:border-[#26282E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#111215] dark:hover:border-white transition shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-black text-[#111215] dark:text-white text-base">{shift.recipeCode}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-[#F0F0EB] dark:bg-[#262830] text-[#5E6472] dark:text-[#A0A6B5]">
                          {shift.shiftDate} (Смена №{shift.shiftNumber})
                        </span>
                      </div>
                      <div className="text-xs text-[#5E6472] dark:text-[#A0A6B5] mt-1">
                        Оператор: <strong className="text-[#111215] dark:text-white">{shift.operatorName}</strong> • Замесов: <strong className="text-[#111215] dark:text-white font-mono">{shift.batchesCount}</strong> • Тоннаж: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{(shift.totalActualWeightKg / 1000).toFixed(3)} т</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSummaryModalShift(shift)}
                        className="px-3 py-1.5 rounded-lg bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#262830] dark:hover:bg-[#30333C] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#333640] text-xs font-semibold transition"
                      >
                        Просмотр
                      </button>
                      <button
                        onClick={() => exportShiftToPdf(shift, recipes.find((r) => r.id === shift.recipeId))}
                        className="px-3 py-1.5 rounded-lg bg-[#111215] hover:bg-[#252830] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] text-xs font-bold flex items-center gap-1 transition shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#E63B00]" />
                        <span>PDF</span>
                      </button>
                      <button
                        onClick={() => exportShiftToExcel(shift, recipes.find((r) => r.id === shift.recipeId))}
                        className="px-3 py-1.5 rounded-lg bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#262830] dark:hover:bg-[#30333C] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#333640] text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Excel</span>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Удалить смену из архива?')) {
                            const updated = deleteSavedShift(shift.id);
                            setSavedShifts(updated);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#717684] hover:text-rose-600 dark:hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODALS */}
      {/* 1. Recipe Selector Modal */}
      {isRecipeSelectorOpen && (
        <RecipeSelector
          recipes={recipes}
          currentRecipeId={currentRecipe.id}
          onSelectRecipe={(selected) => handleSelectRecipe(selected)}
          onClose={() => setIsRecipeSelectorOpen(false)}
          onOpenRecipeManager={() => {
            setIsRecipeSelectorOpen(false);
            setIsRecipeManagerOpen(true);
          }}
        />
      )}

      {/* 2. Recipe Manager Modal */}
      {isRecipeManagerOpen && (
        <RecipeManagerModal
          recipes={recipes}
          onSaveRecipe={handleSaveRecipe}
          onDeleteRecipe={handleDeleteRecipe}
          onResetDefaults={handleResetDefaultRecipes}
          onClose={() => setIsRecipeManagerOpen(false)}
        />
      )}

      {/* 3. Shift Summary Modal */}
      {summaryModalShift && (
        <ShiftSummaryModal
          shift={summaryModalShift}
          recipe={currentRecipe}
          onClose={() => setSummaryModalShift(null)}
          onPrint={() => {
            setPrintModalShift(summaryModalShift);
            setSummaryModalShift(null);
          }}
          onStartNewShift={handleStartNewShift}
        />
      )}

      {/* 4. History Modal */}
      {isHistoryOpen && (
        <SavedShiftsHistory
          shifts={savedShifts}
          recipes={recipes}
          onSelectShiftToView={(shift) => {
            setIsHistoryOpen(false);
            setSummaryModalShift(shift);
          }}
          onDeleteShift={(shiftId) => {
            const updated = deleteSavedShift(shiftId);
            setSavedShifts(updated);
          }}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* 5. Tech Support & Settings Modal */}
      {isSupportOpen && (
        <TechSupportModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setIsSupportOpen(false)}
          onOpenUpdates={() => setIsUpdateModalOpen(true)}
          onTriggerForcedUpdateTest={() => handleExecuteForcedServerUpdate()}
        />
      )}

      {/* 6. Printable Report View Modal */}
      {printModalShift && (
        <PrintReportView
          shift={printModalShift}
          recipe={currentRecipe}
          onClose={() => setPrintModalShift(null)}
        />
      )}

      {/* 7. Update & Patch Manager Modal */}
      {isUpdateModalOpen && (
        <UpdateManagerModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          recipes={recipes}
          settings={settings}
          currentRecipeId={currentRecipe.id}
          onUpdateState={handleUpdateSystemState}
          onTriggerForcedUpdateTest={() => handleExecuteForcedServerUpdate()}
        />
      )}
    </div>
  );
}
