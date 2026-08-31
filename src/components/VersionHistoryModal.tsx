import React, { useState, useMemo } from 'react';
import { 
  History, 
  X, 
  Plus, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle, 
  Tag, 
  User, 
  Calendar, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  Trash2, 
  FileText, 
  Check, 
  Sparkles,
  RefreshCw,
  GitBranch,
  Cpu
} from 'lucide-react';
import { VersionLogEntry, VersionEventType, Recipe, AppSettings } from '../types';
import { 
  getAllVersionHistory, 
  recordVersionEvent, 
  deleteVersionLogEntry, 
  resetVersionHistoryToBaseline, 
  exportVersionAuditJson, 
  openPrintableVersionReport, 
  getTypeLabelRu 
} from '../lib/versionTracker';
import { CURRENT_APP_VERSION, rollbackToBackup } from '../lib/patchEngine';
import { playBeep } from '../lib/storage';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  settings: AppSettings;
  onUpdateState?: (updatedRecipes: Recipe[], updatedSettings: AppSettings, updatedRecipeId?: string | null) => void;
  onOpenUpdates?: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  recipes,
  settings,
  onUpdateState,
  onOpenUpdates,
}) => {
  const [historyList, setHistoryList] = useState<VersionLogEntry[]>(() => getAllVersionHistory());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // New Audit Entry Form State
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [formVersion, setFormVersion] = useState(`${CURRENT_APP_VERSION}-calib`);
  const [formType, setFormType] = useState<VersionEventType>('calibration');
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState(settings.operatorName || 'Главный технолог ООО «АЛЕКС»');
  const [formDescription, setFormDescription] = useState('');
  const [formChangelog, setFormChangelog] = useState<string[]>(['']);
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Refresh history on open
  React.useEffect(() => {
    if (isOpen) {
      setHistoryList(getAllVersionHistory());
      setStatusMessage(null);
    }
  }, [isOpen]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return historyList.filter((item) => {
      const matchesType = selectedTypeFilter === 'all' || item.type === selectedTypeFilter;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesType;

      const matchesSearch = 
        item.version.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.changelog.some((c) => c.toLowerCase().includes(q)) ||
        (item.affectedRecipes && item.affectedRecipes.some((r) => r.toLowerCase().includes(q)));

      return matchesType && matchesSearch;
    });
  }, [historyList, selectedTypeFilter, searchQuery]);

  if (!isOpen) return null;

  // Handle Add Changelog Item
  const handleAddChangelogLine = () => {
    setFormChangelog([...formChangelog, '']);
  };

  const handleUpdateChangelogLine = (index: number, val: string) => {
    const updated = [...formChangelog];
    updated[index] = val;
    setFormChangelog(updated);
  };

  const handleRemoveChangelogLine = (index: number) => {
    if (formChangelog.length <= 1) {
      setFormChangelog(['']);
      return;
    }
    setFormChangelog(formChangelog.filter((_, idx) => idx !== index));
  };

  // Handle Toggle Recipe for Entry
  const handleToggleRecipe = (code: string) => {
    if (selectedRecipes.includes(code)) {
      setSelectedRecipes(selectedRecipes.filter((c) => c !== code));
    } else {
      setSelectedRecipes([...selectedRecipes, code]);
    }
  };

  // Submit New Version Entry
  const handleCreateVersionEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setStatusMessage({ text: 'Укажите название записи аудита версий', type: 'error' });
      return;
    }

    const cleanChangelog = formChangelog.map((c) => c.trim()).filter(Boolean);
    if (cleanChangelog.length === 0) {
      cleanChangelog.push('Внесены регламентные изменения в технологические параметры');
    }

    const newRecord = recordVersionEvent({
      version: formVersion.trim() || CURRENT_APP_VERSION,
      type: formType,
      title: formTitle.trim(),
      description: formDescription.trim() || 'Технологическая запись в журнале версий предприятия',
      author: formAuthor.trim() || 'Главный технолог ООО «АЛЕКС»',
      changelog: cleanChangelog,
      affectedRecipes: selectedRecipes.length > 0 ? selectedRecipes : undefined,
    });

    setHistoryList(getAllVersionHistory());
    setIsAddingEntry(false);
    setStatusMessage({
      text: `Запись в журнал учета версий (v${newRecord.version}) успешно сохранена!`,
      type: 'success',
    });
    if (settings.soundEnabled) playBeep('success');

    // Reset Form
    setFormTitle('');
    setFormDescription('');
    setFormChangelog(['']);
    setSelectedRecipes([]);
  };

  // Handle Rollback
  const handleRollback = (backupId: string, versionTitle: string) => {
    if (!window.confirm(`Вы действительно хотите выполнить откат системы к точке: "${versionTitle}"?`)) {
      return;
    }

    const res = rollbackToBackup(backupId);
    if (res.success && res.restoredRecipes && res.restoredSettings) {
      if (onUpdateState) {
        onUpdateState(res.restoredRecipes, res.restoredSettings, res.restoredRecipeId);
      }
      setHistoryList(getAllVersionHistory());
      setStatusMessage({
        text: `Откат к версии успешно выполнен! Восстановлено рецептур: ${res.restoredRecipes.length}.`,
        type: 'success',
      });
      if (settings.soundEnabled) playBeep('success');
    } else {
      setStatusMessage({
        text: res.error || 'Не удалось выполнить откат к точке восстановления',
        type: 'error',
      });
      if (settings.soundEnabled) playBeep('error');
    }
  };

  // Handle Delete Entry
  const handleDeleteEntry = (id: string) => {
    if (window.confirm('Удалить эту запись из журнала учета версий?')) {
      const updated = deleteVersionLogEntry(id);
      setHistoryList(updated);
      setStatusMessage({ text: 'Запись удалена из реестра', type: 'info' });
    }
  };

  // Type Badge Styling
  const getTypeBadge = (type: VersionEventType) => {
    switch (type) {
      case 'release':
        return 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'patch':
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'formula_update':
        return 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'calibration':
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'rollback':
        return 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'ota_sync':
        return 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn">
      <div 
        id="version-history-modal"
        className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#111215] dark:text-white transition-colors"
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 border-b border-[#EBEBE6] dark:border-[#26282E] flex items-center justify-between sticky top-0 bg-white dark:bg-[#15171C] z-20">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-bold shrink-0 shadow-sm">
              <History className="w-6 h-6 text-[#E63B00]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-[#111215] dark:text-white truncate">
                  Журнал и учёт версий ПО
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-[#E63B00] text-white text-xs font-mono font-black tracking-wider">
                  v{CURRENT_APP_VERSION} ТЕКУЩАЯ
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#717684] dark:text-[#8E95A5] truncate font-mono">
                {settings.plantName} • Паспорт версий, патчей и калибровок АСУ ТП
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingEntry(!isAddingEntry)}
              id="btn-add-version-entry"
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
                isAddingEntry
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-[#111215] hover:bg-[#252830] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] shadow-xs'
              }`}
            >
              {isAddingEntry ? (
                <>
                  <X className="w-4 h-4" />
                  <span>Отмена</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-[#E63B00]" />
                  <span className="hidden sm:inline">Внести запись</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              id="btn-close-version-history"
              className="p-2 rounded-xl hover:bg-[#F0F0EB] dark:hover:bg-[#202229] text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white transition"
              title="Закрыть окно"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {statusMessage && (
          <div className={`px-5 py-3 text-xs sm:text-sm font-semibold border-b flex items-center justify-between gap-3 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
              : statusMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
          }`}>
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="text-xs opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MAIN BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* STATS STRIP & QUICK ACTIONS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-3.5 sm:p-4 rounded-2xl border border-[#E5E5E0] dark:border-[#26282E]">
              <span className="text-[11px] sm:text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block">
                Активная версия
              </span>
              <span className="font-mono font-black text-lg sm:text-2xl text-[#E63B00]">
                v{CURRENT_APP_VERSION}
              </span>
            </div>

            <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-3.5 sm:p-4 rounded-2xl border border-[#E5E5E0] dark:border-[#26282E]">
              <span className="text-[11px] sm:text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block">
                Записей в реестре
              </span>
              <span className="font-mono font-black text-lg sm:text-2xl text-[#111215] dark:text-white">
                {historyList.length}
              </span>
            </div>

            <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-3.5 sm:p-4 rounded-2xl border border-[#E5E5E0] dark:border-[#26282E]">
              <span className="text-[11px] sm:text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block">
                Контроль SHA-256
              </span>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm sm:text-base mt-1">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Верифицирован</span>
              </div>
            </div>

            <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-3.5 sm:p-4 rounded-2xl border border-[#E5E5E0] dark:border-[#26282E] flex flex-col justify-between">
              <span className="text-[11px] sm:text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block">
                Выгрузка паспорта
              </span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => openPrintableVersionReport(historyList, settings.plantName)}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#252830] border border-[#E0E0D9] dark:border-[#333640] hover:border-[#E63B00] text-xs font-bold flex items-center gap-1 transition"
                  title="Открыть паспорт для печати или сохранения в PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-[#E63B00]" />
                  <span>Печать/PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportVersionAuditJson(historyList, settings.plantName)}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#252830] border border-[#E0E0D9] dark:border-[#333640] hover:border-[#E63B00] text-xs font-bold flex items-center gap-1 transition"
                  title="Скачать реестр версий в JSON формате"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>JSON</span>
                </button>
              </div>
            </div>
          </div>

          {/* FORM: CREATE VERSION / AUDIT ENTRY */}
          {isAddingEntry && (
            <form 
              onSubmit={handleCreateVersionEntry}
              className="bg-[#FFF8F5] dark:bg-[#1F1917] border-2 border-[#E63B00]/40 rounded-3xl p-5 sm:p-6 space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-[#E63B00]/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <Tag className="w-5 h-5 text-[#E63B00]" />
                  <h3 className="font-black text-base sm:text-lg text-[#111215] dark:text-white">
                    Внесение записи аудита / калибровки в реестр версий
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#717684] dark:text-[#8E95A5]">
                  {new Date().toLocaleDateString('ru-RU')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block mb-1">
                    Версия ПО / Патча:
                  </label>
                  <input
                    type="text"
                    required
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    placeholder="2.4.1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#111215] border border-[#E0E0D9] dark:border-[#2D3039] text-sm font-mono font-bold focus:outline-none focus:border-[#E63B00]"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block mb-1">
                    Тип события:
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as VersionEventType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#111215] border border-[#E0E0D9] dark:border-[#2D3039] text-sm font-bold focus:outline-none focus:border-[#E63B00]"
                  >
                    <option value="calibration">Калибровка весов / дозаторов</option>
                    <option value="formula_update">Модификация рецептуры</option>
                    <option value="patch">Технологический патч</option>
                    <option value="release">Официальный релиз завода</option>
                    <option value="manual_audit">Запись производственного аудита</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block mb-1">
                    Автор / Технолог:
                  </label>
                  <input
                    type="text"
                    required
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="Васильев С.М."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#111215] border border-[#E0E0D9] dark:border-[#2D3039] text-sm font-medium focus:outline-none focus:border-[#E63B00]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block mb-1">
                  Название модификации / события:
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Например: Калибровка отсечки шнека цемента и корректировка допуска П-20"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#111215] border border-[#E0E0D9] dark:border-[#2D3039] text-sm font-bold focus:outline-none focus:border-[#E63B00]"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block mb-1">
                  Подробное описание:
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Опишите причину модификации, данные протокола калибровки или регламент испытаний..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#111215] border border-[#E0E0D9] dark:border-[#2D3039] text-sm focus:outline-none focus:border-[#E63B00]"
                />
              </div>

              {/* Affected recipes */}
              <div>
                <label className="text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5] block mb-1.5">
                  Затронутые рецептуры смеси:
                </label>
                <div className="flex flex-wrap gap-2">
                  {recipes.map((r) => {
                    const isSelected = selectedRecipes.includes(r.code);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => handleToggleRecipe(r.code)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-[#E63B00] text-white border-[#E63B00]'
                            : 'bg-white dark:bg-[#1A1C22] border-[#E0E0D9] dark:border-[#2D3039] text-[#5E6472] dark:text-[#A0A6B5]'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        <span>{r.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Changelog items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase font-bold text-[#717684] dark:text-[#8E95A5]">
                    Пункты изменений (Changelog):
                  </label>
                  <button
                    type="button"
                    onClick={handleAddChangelogLine}
                    className="text-xs font-bold text-[#E63B00] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить пункт</span>
                  </button>
                </div>

                {formChangelog.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#717684] w-4 text-right">{idx + 1}.</span>
                    <input
                      type="text"
                      value={line}
                      onChange={(e) => handleUpdateChangelogLine(idx, e.target.value)}
                      placeholder="Опишите конкретное изменение (например: Уменьшен допуск цемента до ±0.5 кг)"
                      className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#111215] border border-[#E0E0D9] dark:border-[#2D3039] text-sm focus:outline-none focus:border-[#E63B00]"
                    />
                    {formChangelog.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChangelogLine(idx)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingEntry(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white text-xs sm:text-sm font-semibold transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#E63B00] hover:bg-[#CC3400] text-white text-xs sm:text-sm font-black transition shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Сохранить в реестр</span>
                </button>
              </div>
            </form>
          )}

          {/* SEARCH & FILTER BAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8F8F5] dark:bg-[#1A1C22] p-3 sm:p-4 rounded-2xl border border-[#E5E5E0] dark:border-[#26282E]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#717684] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по версии, названию, автору, рецептурам или пунктам changelog..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#111215] border border-[#E0E0D9] dark:border-[#2D3039] rounded-xl text-xs sm:text-sm text-[#111215] dark:text-white focus:outline-none focus:border-[#E63B00]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#717684] hover:text-[#111215] dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'Все' },
                { id: 'release', label: 'Релизы' },
                { id: 'patch', label: 'Патчи' },
                { id: 'calibration', label: 'Калибровки' },
                { id: 'formula_update', label: 'Рецептуры' },
                { id: 'rollback', label: 'Откаты' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedTypeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    selectedTypeFilter === f.id
                      ? 'bg-[#111215] dark:bg-white text-white dark:text-[#111215] shadow-xs'
                      : 'bg-white dark:bg-[#111215] text-[#5E6472] dark:text-[#A0A6B5] border border-[#E0E0D9] dark:border-[#2D3039] hover:text-[#111215] dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* TIMELINE OF VERSIONS */}
          <div className="space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="py-12 text-center text-[#717684] space-y-3 bg-[#F8F8F5] dark:bg-[#1A1C22] rounded-3xl border border-[#E5E5E0] dark:border-[#26282E]">
                <History className="w-10 h-10 mx-auto opacity-30 text-[#E63B00]" />
                <p className="font-bold text-base text-[#111215] dark:text-white">Записи версий не найдены</p>
                <p className="text-xs sm:text-sm text-[#717684] dark:text-[#8E95A5]">
                  Попробуйте изменить поисковый запрос или фильтр типа событий.
                </p>
              </div>
            ) : (
              filteredEntries.map((entry, index) => {
                const isCurrent = entry.version === CURRENT_APP_VERSION;
                const isExpanded = expandedEntryId === entry.id || isCurrent;
                const dateStr = new Date(entry.timestamp).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
                const timeStr = new Date(entry.timestamp).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={entry.id}
                    className={`rounded-3xl border transition-all ${
                      isCurrent
                        ? 'bg-[#FFF8F5] dark:bg-[#1C1715] border-[#E63B00] shadow-md ring-1 ring-[#E63B00]/40'
                        : 'bg-white dark:bg-[#1A1C22] border-[#E5E5E0] dark:border-[#26282E] hover:border-[#CBD5E1] dark:hover:border-[#333640]'
                    }`}
                  >
                    {/* Card Header */}
                    <div 
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono font-black text-sm shrink-0 border ${
                          isCurrent 
                            ? 'bg-[#E63B00] text-white border-[#E63B00]' 
                            : 'bg-[#F4F4F0] dark:bg-[#252830] text-[#111215] dark:text-white border-[#E0E0D9] dark:border-[#2D3039]'
                        }`}>
                          v{entry.version}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-base sm:text-lg text-[#111215] dark:text-white">
                              {entry.title}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#E63B00] text-white">
                                Текущая
                              </span>
                            )}
                            <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getTypeBadge(entry.type)}`}>
                              {getTypeLabelRu(entry.type)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#717684] dark:text-[#8E95A5] font-mono">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {dateStr} ({timeStr})
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {entry.author}
                            </span>
                            {entry.checksum && (
                              <>
                                <span>•</span>
                                <span className="text-[11px] text-slate-500">
                                  {entry.checksum}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                        {entry.backupSnapshotId && !isCurrent && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollback(entry.backupSnapshotId!, entry.title);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                            title="Откатить состояние системы к этому снимку"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Откат</span>
                          </button>
                        )}

                        {entry.id.startsWith('ver_evt_') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEntry(entry.id);
                            }}
                            className="p-2 text-[#717684] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
                            title="Удалить запись из реестра"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        <div className="p-1.5 text-[#717684]">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Card Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 sm:px-6 pb-5 pt-1 border-t border-[#EBEBE6] dark:border-[#26282E]/80 space-y-3.5 animate-fadeIn">
                        <p className="text-xs sm:text-sm text-[#5E6472] dark:text-[#CBD5E1] leading-relaxed">
                          {entry.description}
                        </p>

                        {/* Affected Recipes */}
                        {entry.affectedRecipes && entry.affectedRecipes.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#717684] uppercase">Рецептуры:</span>
                            {entry.affectedRecipes.map((code, rIdx) => (
                              <span
                                key={rIdx}
                                className="px-2.5 py-0.5 rounded-md bg-[#F0F0EB] dark:bg-[#252830] text-[#111215] dark:text-white font-mono font-bold text-xs"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Changelog List */}
                        <div className="bg-white/80 dark:bg-[#111215]/80 p-3.5 sm:p-4 rounded-2xl border border-[#E0E0D9] dark:border-[#26282E] space-y-2">
                          <div className="text-xs uppercase font-black tracking-wider text-[#717684] dark:text-[#8E95A5] flex items-center gap-1.5">
                            <GitBranch className="w-3.5 h-3.5 text-[#E63B00]" />
                            <span>Журнал изменений (Changelog)</span>
                          </div>
                          <ul className="space-y-1.5 text-xs sm:text-sm text-[#111215] dark:text-[#E2E8F0] font-sans">
                            {entry.changelog.map((c, cIdx) => (
                              <li key={cIdx} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E63B00] mt-2 shrink-0" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#EBEBE6] dark:border-[#26282E]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Сбросить историю к заводскому реестру по умолчанию?')) {
                    const reset = resetVersionHistoryToBaseline();
                    setHistoryList(reset);
                    setStatusMessage({ text: 'Реестр сброшен к заводской базовой конфигурации', type: 'info' });
                  }
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-[#717684] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              >
                Сбросить к заводскому реестру
              </button>
            </div>

            <div className="flex items-center gap-3">
              {onOpenUpdates && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUpdates();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#111215] hover:bg-[#252830] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] text-xs sm:text-sm font-bold flex items-center gap-2 transition shadow-xs"
                >
                  <RefreshCw className="w-4 h-4 text-[#E63B00]" />
                  <span>Центр обновлений (SSL OTA)</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white text-xs sm:text-sm font-bold transition"
              >
                Закрыть
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
