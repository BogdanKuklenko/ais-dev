import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  Check, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  RotateCcw,
  CornerDownLeft,
  ShieldCheck
} from 'lucide-react';
import { Recipe, BatchRecord, BatchItemWeight, AppSettings } from '../types';
import { playBeep, getBatchDraft, saveBatchDraft, clearBatchDraft } from '../lib/storage';

interface ActiveBatchPanelProps {
  recipe: Recipe;
  currentBatchNumber: number;
  operatorName: string;
  onSaveBatch: (batch: BatchRecord) => void;
  onFinishShift: () => void;
  batchesHistory: BatchRecord[];
  onSelectBatchForEdit?: (batchNumber: number) => void;
  settings: AppSettings;
}

export const ActiveBatchPanel: React.FC<ActiveBatchPanelProps> = ({
  recipe,
  currentBatchNumber,
  operatorName,
  onSaveBatch,
  onFinishShift,
  batchesHistory,
  settings,
}) => {
  const [editingBatchNum, setEditingBatchNum] = useState<number | null>(() => {
    const draft = getBatchDraft();
    return draft && draft.recipeId === recipe.id ? draft.editingBatchNum : null;
  });

  const [actualWeights, setActualWeights] = useState<Record<string, string>>(() => {
    const draft = getBatchDraft();
    if (draft && draft.recipeId === recipe.id && draft.actualWeights) {
      return draft.actualWeights;
    }
    const initialMap: Record<string, string> = {};
    recipe.components.forEach((c) => {
      initialMap[c.id] = '';
    });
    return initialMap;
  });

  const [notes, setNotes] = useState<string>(() => {
    const draft = getBatchDraft();
    return draft && draft.recipeId === recipe.id ? draft.notes || '' : '';
  });

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Sync state when recipe or editing mode changes
  useEffect(() => {
    const draft = getBatchDraft();

    if (editingBatchNum !== null) {
      if (draft && draft.recipeId === recipe.id && draft.editingBatchNum === editingBatchNum) {
        setActualWeights(draft.actualWeights);
        setNotes(draft.notes || '');
        return;
      }

      const existing = batchesHistory.find((b) => b.batchNumber === editingBatchNum);
      if (existing) {
        const map: Record<string, string> = {};
        existing.items.forEach((item) => {
          map[item.componentId] = item.actualKg.toString();
        });
        setActualWeights(map);
        setNotes(existing.notes || '');
        saveBatchDraft({
          recipeId: recipe.id,
          actualWeights: map,
          editingBatchNum,
          notes: existing.notes || '',
          updatedAt: new Date().toISOString(),
        });
        return;
      }
    } else {
      // New batch mode
      if (draft && draft.recipeId === recipe.id && draft.editingBatchNum === null) {
        // Ensure all components from recipe are present
        const map: Record<string, string> = {};
        recipe.components.forEach((c) => {
          map[c.id] = draft.actualWeights[c.id] || '';
        });
        setActualWeights(map);
        setNotes(draft.notes || '');
      } else {
        const initialMap: Record<string, string> = {};
        recipe.components.forEach((c) => {
          initialMap[c.id] = '';
        });
        setActualWeights(initialMap);
        setNotes('');
      }
    }

    const timer = setTimeout(() => {
      if (firstInputRef.current) {
        firstInputRef.current.focus();
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [currentBatchNumber, recipe.id, editingBatchNum]);

  // Handle immediate input change with atomic localStorage persistence
  const handleInputChange = (compId: string, val: string) => {
    const sanitized = val.replace(',', '.').replace(/[^0-9.]/g, '');
    setActualWeights((prev) => {
      const nextWeights = {
        ...prev,
        [compId]: sanitized,
      };
      // Instantly persist draft to localStorage so no data is lost on crash/tab switch/exit
      saveBatchDraft({
        recipeId: recipe.id,
        actualWeights: nextWeights,
        editingBatchNum,
        notes,
        updatedAt: new Date().toISOString(),
      });
      return nextWeights;
    });
  };

  const fillByNorm = () => {
    const map: Record<string, string> = {};
    recipe.components.forEach((c) => {
      map[c.id] = c.targetWeightKg.toString();
    });
    setActualWeights(map);
    saveBatchDraft({
      recipeId: recipe.id,
      actualWeights: map,
      editingBatchNum,
      notes,
      updatedAt: new Date().toISOString(),
    });
  };

  const adjustWeight = (compId: string, delta: number) => {
    const comp = recipe.components.find((c) => c.id === compId);
    if (!comp) return;
    const current = parseFloat(actualWeights[compId]) || comp.targetWeightKg;
    const nextVal = Math.max(0, Math.round((current + delta) * 10) / 10);
    setActualWeights((prev) => {
      const nextWeights = {
        ...prev,
        [compId]: nextVal.toString(),
      };
      saveBatchDraft({
        recipeId: recipe.id,
        actualWeights: nextWeights,
        editingBatchNum,
        notes,
        updatedAt: new Date().toISOString(),
      });
      return nextWeights;
    });
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    saveBatchDraft({
      recipeId: recipe.id,
      actualWeights,
      editingBatchNum,
      notes: val,
      updatedAt: new Date().toISOString(),
    });
  };

  let totalTargetKg = 0;
  let totalActualKg = 0;
  const items: BatchItemWeight[] = recipe.components.map((comp) => {
    const targetKg = comp.targetWeightKg;
    const actualRaw = parseFloat(actualWeights[comp.id]);
    const actualKg = isNaN(actualRaw) ? 0 : actualRaw;
    const deviationKg = Number((actualKg - targetKg).toFixed(2));
    const deviationPercent = targetKg > 0 ? Number(((deviationKg / targetKg) * 100).toFixed(2)) : 0;

    totalTargetKg += targetKg;
    totalActualKg += actualKg;

    return {
      componentId: comp.id,
      componentName: comp.name,
      fraction: comp.fraction,
      targetKg,
      actualKg,
      deviationKg,
      deviationPercent,
    };
  });

  totalTargetKg = Number(totalTargetKg.toFixed(2));
  totalActualKg = Number(totalActualKg.toFixed(2));
  const totalDeviationKg = Number((totalActualKg - totalTargetKg).toFixed(2));

  const isAllFilled = recipe.components.every((c) => {
    const val = parseFloat(actualWeights[c.id]);
    return !isNaN(val) && val > 0;
  });

  const handleNextBatch = () => {
    if (!isAllFilled) {
      if (settings.soundEnabled) playBeep('warning');
      return;
    }

    const batchNumberToSave = editingBatchNum !== null ? editingBatchNum : currentBatchNumber;

    const newBatch: BatchRecord = {
      id: `batch_${Date.now()}_${batchNumberToSave}`,
      batchNumber: batchNumberToSave,
      timestamp: new Date().toISOString(),
      recipeId: recipe.id,
      recipeCode: recipe.code,
      recipeName: recipe.name,
      operatorName,
      items,
      totalTargetKg,
      totalActualKg,
      totalDeviationKg,
      notes: notes.trim() || undefined,
    };

    if (settings.soundEnabled) playBeep('success');
    
    // Clear draft after successful batch commit
    clearBatchDraft();

    // Reset local inputs for next batch
    const nextMap: Record<string, string> = {};
    recipe.components.forEach((c) => {
      nextMap[c.id] = '';
    });
    setActualWeights(nextMap);
    setNotes('');
    setEditingBatchNum(null);

    onSaveBatch(newBatch);

    // Focus on first input for fast continuous operation
    setTimeout(() => {
      if (firstInputRef.current) {
        firstInputRef.current.focus();
      }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === recipe.components.length - 1) {
        if (isAllFilled) {
          handleNextBatch();
        }
      } else {
        const nextInput = document.getElementById(`input-comp-${index + 1}`) as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };

  const activeBatchDisplayNumber = editingBatchNum !== null ? editingBatchNum : currentBatchNumber;
  const isOver = isAllFilled && totalDeviationKg > 0;
  const isUnder = isAllFilled && totalDeviationKg < 0;

  return (
    <div className="space-y-4">
      {/* Precision Batch Header Strip */}
      <div className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl p-4 sm:p-5 shadow-sm transition-colors flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Giant Clean Batch Number */}
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase font-mono tracking-widest text-[#717684] dark:text-[#8E95A5] font-semibold">
              Замес
            </span>
            <span className="font-mono text-3xl sm:text-4xl font-black text-[#111215] dark:text-white tracking-tight tabular-nums">
              № {String(activeBatchDisplayNumber).padStart(2, '0')}
            </span>
          </div>

          <div className="h-6 w-px bg-[#E5E5E0] dark:bg-[#2A2D34] hidden sm:block" />

          <div className="hidden sm:block text-xs">
            <div className="text-[#111215] dark:text-white font-bold font-mono">
              {recipe.code} <span className="font-normal text-[#717684] dark:text-[#8E95A5]">({recipe.name})</span>
            </div>
            <div className="text-[11px] text-[#717684] dark:text-[#8E95A5] font-mono mt-0.5">
              Норма смеси: <strong className="text-[#111215] dark:text-white">{recipe.targetTotalWeightKg} кг</strong>
            </div>
          </div>
        </div>

        {/* Right: Quick Tools & History Nav */}
        <div className="flex items-center gap-2">
          {editingBatchNum !== null && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-[#FFF3EE] dark:bg-[#2A1E19] text-[#E63B00] border border-[#FFCCBA] dark:border-[#4D281E] font-mono font-bold">
              Правка замеса №{editingBatchNum}
            </span>
          )}

          <button
            type="button"
            onClick={fillByNorm}
            id="btn-fill-by-norm"
            className="px-3 py-1.5 rounded-lg bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#1E2026] dark:hover:bg-[#272A33] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs font-semibold flex items-center gap-1.5 transition"
            title="Заполнить все поля по паспортной норме"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E63B00]" />
            <span>По норме (F2)</span>
          </button>

          {batchesHistory.length > 0 && (
            <div className="flex items-center bg-[#F4F4F0] dark:bg-[#1E2026] rounded-lg border border-[#E0E0D9] dark:border-[#2D3039] p-0.5 text-xs font-mono">
              <button
                type="button"
                disabled={activeBatchDisplayNumber <= 1}
                onClick={() => {
                  const prev = activeBatchDisplayNumber - 1;
                  if (prev >= 1) setEditingBatchNum(prev);
                }}
                className="p-1.5 hover:bg-white dark:hover:bg-[#2A2D35] text-[#5E6472] dark:text-[#8E95A5] disabled:opacity-30 rounded transition"
                title="Предыдущий замес"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[#111215] dark:text-white font-bold min-w-[55px] text-center tabular-nums">
                {editingBatchNum ? `№${editingBatchNum}` : `Новый`}
              </span>
              <button
                type="button"
                disabled={editingBatchNum === null}
                onClick={() => {
                  if (editingBatchNum && editingBatchNum < currentBatchNumber - 1) {
                    setEditingBatchNum(editingBatchNum + 1);
                  } else {
                    setEditingBatchNum(null);
                  }
                }}
                className="p-1.5 hover:bg-white dark:hover:bg-[#2A2D35] text-[#5E6472] dark:text-[#8E95A5] disabled:opacity-30 rounded transition"
                title="Следующий / Вернуться к новому"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Ingredient Channel Rows */}
      <div className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl overflow-hidden shadow-sm transition-colors">
        
        {/* Table / Channels Header */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 bg-[#F9F9F7] dark:bg-[#1A1C22] border-b border-[#EBEBE6] dark:border-[#26282E] text-[10px] font-mono uppercase tracking-wider text-[#717684] dark:text-[#8E95A5]">
          <div className="col-span-5 font-semibold">Компонент смеси</div>
          <div className="col-span-2 text-right font-semibold">Норма</div>
          <div className="col-span-3 text-center font-semibold">Фактический вес (кг)</div>
          <div className="col-span-2 text-right font-semibold">Отклонение</div>
        </div>

        <div className="divide-y divide-[#EBEBE6] dark:divide-[#22242B]">
          {recipe.components.map((comp, idx) => {
            const actualVal = actualWeights[comp.id] || '';
            const actualNum = parseFloat(actualVal);
            const isFilled = !isNaN(actualNum) && actualNum > 0;
            const diff = isFilled ? Number((actualNum - comp.targetWeightKg).toFixed(2)) : 0;
            const isCompOver = isFilled && diff > 0;
            const isCompUnder = isFilled && diff < 0;

            return (
              <div
                key={comp.id}
                id={`comp-row-${comp.id}`}
                className="px-4 sm:px-5 py-3 transition hover:bg-[#FAFAF9] dark:hover:bg-[#191B21]"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  
                  {/* Channel & Component Info (Cols 1-5) */}
                  <div className="md:col-span-5 flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-[#F0F0EB] dark:bg-[#202229] border border-[#E0E0D9] dark:border-[#2C2F38] flex items-center justify-center font-mono font-bold text-[#111215] dark:text-white text-xs shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#111215] dark:text-white text-sm sm:text-base truncate">
                        {comp.name}
                      </div>
                      {comp.fraction && (
                        <div className="text-xs text-[#717684] dark:text-[#8E95A5] font-mono truncate">
                          {comp.fraction}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Target Norm (Cols 6-7) */}
                  <div className="md:col-span-2 flex md:justify-end items-center text-xs">
                    <span className="md:hidden text-[#717684] font-mono mr-2">Норма:</span>
                    <span className="font-mono text-sm font-semibold text-[#5E6472] dark:text-[#A0A6B5] tabular-nums">
                      {comp.targetWeightKg} <span className="text-[11px] font-normal text-[#717684]">кг</span>
                    </span>
                  </div>

                  {/* Tactile Numeric Input Field (Cols 8-10) */}
                  <div className="md:col-span-3 flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        ref={idx === 0 ? firstInputRef : null}
                        id={`input-comp-${idx}`}
                        type="text"
                        inputMode="decimal"
                        value={actualVal}
                        onChange={(e) => handleInputChange(comp.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        placeholder={`${comp.targetWeightKg}`}
                        className={`w-full h-11 px-3.5 pr-8 rounded-lg font-mono text-xl sm:text-2xl font-black text-center border transition focus:outline-none tabular-nums ${
                          isFilled
                            ? 'bg-white dark:bg-[#111215] text-[#111215] dark:text-white border-[#111215] dark:border-white shadow-sm ring-1 ring-[#111215]/20 dark:ring-white/20'
                            : 'bg-[#F7F7F4] dark:bg-[#181A20] text-[#717684] border-[#E0E0D9] dark:border-[#2D3039] focus:border-[#E63B00] focus:bg-white dark:focus:bg-[#111215]'
                        }`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#9CA3AF] pointer-events-none">
                        кг
                      </span>
                    </div>

                    {/* Micro Step Adjusters */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => adjustWeight(comp.id, 5)}
                        className="w-7 h-5 bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white font-mono text-[10px] font-bold rounded border border-[#E0E0D9] dark:border-[#2C2F38] flex items-center justify-center transition"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustWeight(comp.id, -5)}
                        className="w-7 h-5 bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white font-mono text-[10px] font-bold rounded border border-[#E0E0D9] dark:border-[#2C2F38] flex items-center justify-center transition"
                      >
                        -5
                      </button>
                    </div>
                  </div>

                  {/* Clean Delta Display (Cols 11-12) */}
                  <div className="md:col-span-2 flex md:justify-end items-center">
                    {isFilled ? (
                      <div
                        className={`font-mono font-bold text-xs sm:text-sm tabular-nums flex items-center gap-1 ${
                          isCompOver
                            ? 'text-[#E63B00]'
                            : isCompUnder
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        <span>
                          {diff > 0 ? `+${diff}` : diff === 0 ? '0.0' : diff} кг
                        </span>
                        {diff === 0 && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      </div>
                    ) : (
                      <span className="text-xs text-[#9CA3AF] font-mono">
                        —
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Batch Total & Commit Action */}
        <div className="bg-[#F8F8F5] dark:bg-[#181A20] p-4 sm:p-5 border-t border-[#E5E5E0] dark:border-[#26282E] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#717684] dark:text-[#8E95A5] font-semibold">
                Итог по замесу № {activeBatchDisplayNumber}:
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Ввод зафиксирован (автосохранение)
              </span>
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-[#111215] dark:text-white tabular-nums">
                {totalActualKg}{' '}
                <span className="text-xs font-normal text-[#717684] dark:text-[#8E95A5]">/ {totalTargetKg} кг</span>
              </span>

              {isAllFilled && (
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded tabular-nums ${
                    isOver
                      ? 'bg-[#FFF3EE] text-[#E63B00] dark:bg-[#2A1E19]'
                      : isUnder
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  }`}
                >
                  {totalDeviationKg > 0 ? `+${totalDeviationKg}` : totalDeviationKg} кг
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {editingBatchNum !== null && (
              <button
                type="button"
                onClick={() => {
                  clearBatchDraft();
                  setEditingBatchNum(null);
                }}
                className="px-4 py-3 rounded-xl bg-[#EBEBE6] hover:bg-[#DFDFD8] dark:bg-[#22242B] dark:hover:bg-[#2B2E37] text-[#111215] dark:text-white font-semibold text-xs transition"
              >
                Отмена
              </button>
            )}

            <button
              type="button"
              id="btn-submit-next-batch"
              onClick={handleNextBatch}
              disabled={!isAllFilled}
              className={`flex-1 sm:flex-none px-6 py-3.5 rounded-xl font-mono font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow transition transform active:scale-98 ${
                isAllFilled
                  ? 'bg-[#111215] hover:bg-[#272A33] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] cursor-pointer'
                  : 'bg-[#E5E5E0] dark:bg-[#22242B] text-[#9CA3AF] cursor-not-allowed opacity-60'
              }`}
            >
              {editingBatchNum !== null ? (
                <>
                  <Save className="w-4 h-4 text-[#E63B00]" />
                  <span>СОХРАНИТЬ ПРАВКИ</span>
                </>
              ) : (
                <>
                  <span>ЗАФИКСИРОВАТЬ ЗАМЕС</span>
                  <ArrowRight className="w-4 h-4 text-[#E63B00]" />
                  <CornerDownLeft className="w-3.5 h-3.5 opacity-50 hidden sm:inline" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
