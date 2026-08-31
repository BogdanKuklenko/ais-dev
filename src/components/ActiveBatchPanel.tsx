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
      <div className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-2xl p-4 sm:p-6 shadow-sm transition-colors flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Giant Clean Batch Number */}
        <div className="flex items-center gap-5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm uppercase font-mono tracking-widest text-[#717684] dark:text-[#8E95A5] font-black">
              Замес
            </span>
            <span className="font-mono text-4xl sm:text-5xl font-black text-[#111215] dark:text-white tracking-tight tabular-nums">
              № {String(activeBatchDisplayNumber).padStart(2, '0')}
            </span>
          </div>

          <div className="h-8 w-px bg-[#E5E5E0] dark:bg-[#2A2D34] hidden sm:block" />

          <div className="hidden sm:block">
            <div className="text-[#111215] dark:text-white font-black text-sm sm:text-base font-mono">
              {recipe.code} <span className="font-normal text-xs sm:text-sm text-[#717684] dark:text-[#8E95A5]">({recipe.name})</span>
            </div>
            <div className="text-xs sm:text-sm text-[#717684] dark:text-[#8E95A5] font-mono mt-0.5">
              Норма смеси: <strong className="text-[#111215] dark:text-white">{recipe.targetTotalWeightKg} кг</strong>
            </div>
          </div>
        </div>

        {/* Right: Quick Tools & History Nav */}
        <div className="flex items-center gap-2.5">
          {editingBatchNum !== null && (
            <span className="text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-[#FFF3EE] dark:bg-[#2A1E19] text-[#E63B00] border border-[#FFCCBA] dark:border-[#4D281E] font-mono font-black">
              Правка замеса №{editingBatchNum}
            </span>
          )}

          <button
            type="button"
            onClick={fillByNorm}
            id="btn-fill-by-norm"
            className="px-3.5 py-2 rounded-xl bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#1E2026] dark:hover:bg-[#272A33] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs sm:text-sm font-bold flex items-center gap-2 transition"
            title="Заполнить все поля по паспортной норме"
          >
            <Sparkles className="w-4 h-4 text-[#E63B00]" />
            <span>По норме (F2)</span>
          </button>

          {batchesHistory.length > 0 && (
            <div className="flex items-center bg-[#F4F4F0] dark:bg-[#1E2026] rounded-xl border border-[#E0E0D9] dark:border-[#2D3039] p-1 text-xs sm:text-sm font-mono">
              <button
                type="button"
                disabled={activeBatchDisplayNumber <= 1}
                onClick={() => {
                  const prev = activeBatchDisplayNumber - 1;
                  if (prev >= 1) setEditingBatchNum(prev);
                }}
                className="p-1.5 hover:bg-white dark:hover:bg-[#2A2D35] text-[#5E6472] dark:text-[#8E95A5] disabled:opacity-30 rounded-lg transition"
                title="Предыдущий замес"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 text-[#111215] dark:text-white font-black min-w-[65px] text-center tabular-nums">
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
                className="p-1.5 hover:bg-white dark:hover:bg-[#2A2D35] text-[#5E6472] dark:text-[#8E95A5] disabled:opacity-30 rounded-lg transition"
                title="Следующий / Вернуться к новому"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Ingredient Channel Rows */}
      <div className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-2xl overflow-hidden shadow-sm transition-colors">
        
        {/* Table / Channels Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-[#F9F9F7] dark:bg-[#1A1C22] border-b border-[#EBEBE6] dark:border-[#26282E] text-xs font-mono uppercase tracking-wider text-[#717684] dark:text-[#8E95A5]">
          <div className="col-span-4 font-black">Компонент смеси</div>
          <div className="col-span-2 text-right font-black">Норма</div>
          <div className="col-span-4 text-center font-black">Фактический вес (кг)</div>
          <div className="col-span-2 text-right font-black">Отклонение</div>
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
                className="px-4 sm:px-6 py-3.5 sm:py-4 transition hover:bg-[#FAFAF9] dark:hover:bg-[#191B21]"
              >
                {/* Desktop & Tablet Layout (>= md) */}
                <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                  
                  {/* Channel & Component Info (Cols 1-4) */}
                  <div className="col-span-4 flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#F0F0EB] dark:bg-[#202229] border border-[#E0E0D9] dark:border-[#2C2F38] flex items-center justify-center font-mono font-black text-[#111215] dark:text-white text-base shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-[#111215] dark:text-white text-lg sm:text-xl truncate" title={comp.name}>
                        {comp.name}
                      </div>
                      {comp.fraction && (
                        <div className="text-sm text-[#717684] dark:text-[#8E95A5] font-mono truncate">
                          {comp.fraction}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Target Norm (Cols 5-6) */}
                  <div className="col-span-2 text-right">
                    <span className="font-mono text-lg lg:text-xl font-bold text-[#5E6472] dark:text-[#A0A6B5] tabular-nums">
                      {comp.targetWeightKg} <span className="text-sm font-normal text-[#717684]">кг</span>
                    </span>
                  </div>

                  {/* Tactile Numeric Input Field (Cols 7-10) */}
                  <div className="col-span-4 flex items-center gap-2">
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
                        className={`w-full h-12 sm:h-14 px-4 pr-10 rounded-xl font-mono text-2xl sm:text-3xl font-black text-center border-2 transition focus:outline-none tabular-nums ${
                          isFilled
                            ? 'bg-white dark:bg-[#111215] text-[#111215] dark:text-white border-[#111215] dark:border-white shadow-sm ring-2 ring-[#111215]/20 dark:ring-white/20'
                            : 'bg-[#F7F7F4] dark:bg-[#181A20] text-[#717684] border-[#E0E0D9] dark:border-[#2D3039] focus:border-[#E63B00] focus:bg-white dark:focus:bg-[#111215]'
                        }`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-[#9CA3AF] pointer-events-none">
                        кг
                      </span>
                    </div>

                    {/* Micro Step Adjusters */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => adjustWeight(comp.id, 5)}
                        className="w-10 h-6 bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white font-mono text-xs font-bold rounded border border-[#E0E0D9] dark:border-[#2C2F38] flex items-center justify-center transition"
                        title="Добавить 5 кг"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustWeight(comp.id, -5)}
                        className="w-10 h-6 bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white font-mono text-xs font-bold rounded border border-[#E0E0D9] dark:border-[#2C2F38] flex items-center justify-center transition"
                        title="Убавить 5 кг"
                      >
                        -5
                      </button>
                    </div>
                  </div>

                  {/* Clean Delta Display (Cols 11-12) */}
                  <div className="col-span-2 flex justify-end items-center">
                    {isFilled ? (
                      <div
                        className={`font-mono font-black text-base lg:text-lg tabular-nums flex items-center gap-1.5 ${
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
                        {diff === 0 && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                      </div>
                    ) : (
                      <span className="text-sm text-[#9CA3AF] font-mono">
                        —
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile Touch Card Layout (< md) */}
                <div className="md:hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#F0F0EB] dark:bg-[#202229] border border-[#E0E0D9] dark:border-[#2C2F38] flex items-center justify-center font-mono font-black text-[#111215] dark:text-white text-xs shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="font-black text-[#111215] dark:text-white text-sm truncate">
                        {comp.name}
                      </div>
                    </div>
                    {comp.fraction && (
                      <span className="text-[11px] text-[#717684] dark:text-[#8E95A5] font-mono bg-[#F0F0EB] dark:bg-[#202229] px-2 py-0.5 rounded">
                        {comp.fraction}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-[#717684] dark:text-[#8E95A5]">
                    <span>Норма: <strong className="text-[#111215] dark:text-white">{comp.targetWeightKg} кг</strong></span>
                    {isFilled && (
                      <span className={`font-black ${
                        isCompOver ? 'text-[#E63B00]' : isCompUnder ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        Откл: {diff > 0 ? `+${diff}` : diff === 0 ? '0.0' : diff} кг
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={idx === 0 ? firstInputRef : null}
                        id={`input-comp-mobile-${idx}`}
                        type="text"
                        inputMode="decimal"
                        value={actualVal}
                        onChange={(e) => handleInputChange(comp.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        placeholder={`${comp.targetWeightKg}`}
                        className={`w-full h-11 px-3 pr-8 rounded-xl font-mono text-xl font-black text-center border-2 transition focus:outline-none tabular-nums ${
                          isFilled
                            ? 'bg-white dark:bg-[#111215] text-[#111215] dark:text-white border-[#111215] dark:border-white shadow-sm ring-2 ring-[#111215]/20 dark:ring-white/20'
                            : 'bg-[#F7F7F4] dark:bg-[#181A20] text-[#717684] border-[#E0E0D9] dark:border-[#2D3039] focus:border-[#E63B00] focus:bg-white dark:focus:bg-[#111215]'
                        }`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[#9CA3AF] pointer-events-none">
                        кг
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => adjustWeight(comp.id, -5)}
                        className="px-2.5 h-11 bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] text-[#111215] dark:text-white font-mono text-xs font-bold rounded-xl border border-[#E0E0D9] dark:border-[#2C2F38] transition"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustWeight(comp.id, 5)}
                        className="px-2.5 h-11 bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] text-[#111215] dark:text-white font-mono text-xs font-bold rounded-xl border border-[#E0E0D9] dark:border-[#2C2F38] transition"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Batch Total & Commit Action */}
        <div className="bg-[#F8F8F5] dark:bg-[#181A20] p-4 sm:p-6 border-t border-[#E5E5E0] dark:border-[#26282E] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-xs sm:text-sm uppercase font-mono tracking-wider text-[#717684] dark:text-[#8E95A5] font-bold">
                Итог по замесу № {activeBatchDisplayNumber}:
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Ввод зафиксирован (автосохранение)
              </span>
            </div>
            <div className="flex items-baseline gap-3.5 mt-1">
              <span className="text-3xl sm:text-4xl font-black font-mono text-[#111215] dark:text-white tabular-nums">
                {totalActualKg}{' '}
                <span className="text-sm sm:text-base font-normal text-[#717684] dark:text-[#8E95A5]">/ {totalTargetKg} кг</span>
              </span>

              {isAllFilled && (
                <span
                  className={`text-sm sm:text-base font-mono font-black px-3 py-1 rounded-lg tabular-nums ${
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

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {editingBatchNum !== null && (
              <button
                type="button"
                onClick={() => {
                  clearBatchDraft();
                  setEditingBatchNum(null);
                }}
                className="px-5 py-3.5 rounded-xl bg-[#EBEBE6] hover:bg-[#DFDFD8] dark:bg-[#22242B] dark:hover:bg-[#2B2E37] text-[#111215] dark:text-white font-bold text-sm transition"
              >
                Отмена
              </button>
            )}

            <button
              type="button"
              id="btn-submit-next-batch"
              onClick={handleNextBatch}
              disabled={!isAllFilled}
              className={`flex-1 sm:flex-none px-7 py-4 rounded-xl font-mono font-black text-base sm:text-lg flex items-center justify-center gap-2.5 shadow transition transform active:scale-98 ${
                isAllFilled
                  ? 'bg-[#111215] hover:bg-[#272A33] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] cursor-pointer'
                  : 'bg-[#E5E5E0] dark:bg-[#22242B] text-[#9CA3AF] cursor-not-allowed opacity-60'
              }`}
            >
              {editingBatchNum !== null ? (
                <>
                  <Save className="w-5 h-5 text-[#E63B00]" />
                  <span>СОХРАНИТЬ ПРАВКИ</span>
                </>
              ) : (
                <>
                  <span>ЗАФИКСИРОВАТЬ ЗАМЕС</span>
                  <ArrowRight className="w-5 h-5 text-[#E63B00]" />
                  <CornerDownLeft className="w-4 h-4 opacity-50 hidden sm:inline" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
