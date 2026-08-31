import React, { useState } from 'react';
import { 
  History, 
  Search, 
  FileSpreadsheet, 
  Trash2, 
  Eye, 
  X
} from 'lucide-react';
import { ShiftSummary, Recipe } from '../types';
import { exportShiftToExcel } from '../lib/exportExcel';

interface SavedShiftsHistoryProps {
  shifts: ShiftSummary[];
  recipes: Recipe[];
  onSelectShiftToView: (shift: ShiftSummary) => void;
  onDeleteShift: (shiftId: string) => void;
  onClose: () => void;
}

export const SavedShiftsHistory: React.FC<SavedShiftsHistoryProps> = ({
  shifts,
  recipes,
  onSelectShiftToView,
  onDeleteShift,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipeFilter, setSelectedRecipeFilter] = useState('Все');

  const filteredShifts = shifts.filter((s) => {
    const matchesSearch =
      s.recipeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.recipeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.operatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.shiftDate.includes(searchTerm);

    const matchesRecipe = selectedRecipeFilter === 'Все' || s.recipeCode === selectedRecipeFilter;

    return matchesSearch && matchesRecipe;
  });

  const uniqueRecipeCodes = ['Все', ...Array.from(new Set(shifts.map((s) => s.recipeCode)))];

  const totalBatchesAll = shifts.reduce((acc, s) => acc + s.batchesCount, 0);
  const totalTonnageAll = shifts.reduce((acc, s) => acc + s.totalActualWeightKg, 0) / 1000;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div 
        id="saved-shifts-modal"
        className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#111215] dark:text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EBEBE6] dark:border-[#26282E] flex items-center justify-between sticky top-0 bg-white dark:bg-[#15171C] z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-bold">
              <History className="w-4 h-4 text-[#E63B00]" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#111215] dark:text-white">
                Архив производственных смен
              </h2>
              <p className="text-xs text-[#717684] dark:text-[#8E95A5]">
                Сохранённые сменные рапорты завода ООО «АЛЕКС»
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="btn-close-shifts-history"
            className="p-1.5 rounded-lg hover:bg-[#F0F0EB] dark:hover:bg-[#202229] text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aggregate KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-[#F8F8F5] dark:bg-[#181A20] border-b border-[#EBEBE6] dark:border-[#26282E] text-xs">
          <div className="p-3 bg-white dark:bg-[#15171C] rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
            <span className="text-[10px] uppercase font-bold text-[#717684] block">Сохранено смен</span>
            <span className="text-xl font-black font-mono text-[#111215] dark:text-white">{shifts.length}</span>
          </div>
          <div className="p-3 bg-white dark:bg-[#15171C] rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
            <span className="text-[10px] uppercase font-bold text-[#717684] block">Замесов учтено</span>
            <span className="text-xl font-black font-mono text-[#111215] dark:text-white">{totalBatchesAll}</span>
          </div>
          <div className="p-3 bg-white dark:bg-[#15171C] rounded-xl border border-[#E5E5E0] dark:border-[#26282E] col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-[#717684] block">Тоннаж</span>
            <span className="text-xl font-black font-mono text-[#111215] dark:text-white">{totalTonnageAll.toFixed(3)} т</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3.5 border-b border-[#EBEBE6] dark:border-[#26282E] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-[#15171C]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по дате (2026-08-27), оператору или формуле (С-41)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#F8F8F5] dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-lg text-xs text-[#111215] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#E63B00]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#717684]">Формула:</span>
            <select
              value={selectedRecipeFilter}
              onChange={(e) => setSelectedRecipeFilter(e.target.value)}
              className="bg-[#F8F8F5] dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] text-[#111215] dark:text-white rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#E63B00]"
            >
              {uniqueRecipeCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* List of Shifts */}
        <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
          {shifts.length === 0 ? (
            <div className="text-center py-16 text-[#717684]">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#E63B00]" />
              <p className="font-bold text-xs text-[#111215] dark:text-white">Архив пуст</p>
              <p className="text-[11px] text-[#717684] mt-0.5">
                Завершите рабочую смену, чтобы сохранить отчёт в архив
              </p>
            </div>
          ) : filteredShifts.length === 0 ? (
            <div className="text-center py-12 text-[#717684] text-xs">
              Смен по заданным критериям поиска не найдено
            </div>
          ) : (
            filteredShifts.map((shift) => {
              const targetRecipe = recipes.find((r) => r.id === shift.recipeId);
              const isOver = shift.totalDeviationKg > 0;
              const isUnder = shift.totalDeviationKg < 0;

              return (
                <div
                  key={shift.id}
                  id={`shift-card-${shift.id}`}
                  className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl p-3.5 hover:border-[#111215] dark:hover:border-white transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-black text-[#111215] dark:text-white text-base">
                        {shift.recipeCode}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#F0F0EB] dark:bg-[#202229] text-[#5E6472] dark:text-[#8E95A5]">
                        {shift.shiftDate} (Смена №{shift.shiftNumber})
                      </span>
                      <span className="text-[10px] text-[#717684]">
                        {shift.startTime} – {shift.endTime}
                      </span>
                    </div>

                    <div className="text-xs text-[#5E6472] dark:text-[#8E95A5]">
                      {shift.recipeName} • Оператор: <strong className="text-[#111215] dark:text-white">{shift.operatorName}</strong>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs font-mono">
                      <span className="text-[#717684]">
                        Замесов: <strong className="text-[#111215] dark:text-white">{shift.batchesCount}</strong>
                      </span>
                      <span className="text-[#717684]">
                        Тоннаж: <strong className="text-[#111215] dark:text-white">{(shift.totalActualWeightKg / 1000).toFixed(3)} т</strong>
                      </span>
                      <span
                        className={`font-bold ${
                          isOver ? 'text-[#E63B00]' : isUnder ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        Откл.: {shift.totalDeviationKg > 0 ? `+${shift.totalDeviationKg}` : shift.totalDeviationKg} кг
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => onSelectShiftToView(shift)}
                      id={`btn-view-shift-${shift.id}`}
                      className="px-3 py-1.5 rounded-lg bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#E63B00]" />
                      <span>Отчёт</span>
                    </button>

                    <button
                      onClick={() => exportShiftToExcel(shift, targetRecipe)}
                      id={`btn-export-excel-shift-${shift.id}`}
                      className="px-3 py-1.5 rounded-lg bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white text-xs font-semibold flex items-center gap-1 border border-[#E0E0D9] dark:border-[#2D3039] transition"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Excel</span>
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(`Удалить смену от ${shift.shiftDate} (${shift.recipeCode}) из архива?`)) {
                          onDeleteShift(shift.id);
                        }
                      }}
                      id={`btn-delete-shift-${shift.id}`}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-[#9CA3AF] hover:text-rose-600 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
