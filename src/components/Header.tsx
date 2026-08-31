import React from 'react';
import { 
  FlaskConical, 
  History, 
  Layers, 
  FileSpreadsheet, 
  FileText,
  Volume2, 
  VolumeX, 
  Sliders, 
  LayoutDashboard, 
  TableProperties, 
  ChevronDown,
  Moon,
  Sun,
  RefreshCw,
  Lock
} from 'lucide-react';
import { Recipe, AppSettings } from '../types';

export type ActiveTab = 'console' | 'journal' | 'recipes' | 'archive';

interface HeaderProps {
  currentRecipe: Recipe | null;
  operatorName: string;
  shiftNumber: number;
  shiftDate: string;
  batchesCount: number;
  totalTons: number;
  totalDeviationKg: number;
  settings: AppSettings;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenRecipeSelect: () => void;
  onOpenSupport: () => void;
  onOpenUpdates: () => void;
  onToggleSound: () => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  onFinishShift: () => void;
  onExportPdf: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRecipe,
  operatorName,
  shiftNumber,
  shiftDate,
  batchesCount,
  totalTons,
  totalDeviationKg,
  settings,
  activeTab,
  setActiveTab,
  onOpenRecipeSelect,
  onOpenSupport,
  onOpenUpdates,
  onToggleSound,
  onToggleTheme,
  isDarkMode,
  onFinishShift,
  onExportPdf,
}) => {
  const isOver = totalDeviationKg > 0;
  const isUnder = totalDeviationKg < 0;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#121316]/95 backdrop-blur-md border-b border-[#E6E6E1] dark:border-[#26282E] select-none transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          
          {/* Left: Brand & Formula Selector */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-mono font-black text-xs shrink-0 tracking-wider shadow-sm">
                AX
              </div>
              <div className="hidden sm:block leading-none">
                <span className="font-bold text-xs tracking-tight text-[#111215] dark:text-white uppercase block">
                  АЛЕКС <span className="text-[#E63B00] font-mono text-[11px] font-bold">СМЕСИ</span>
                </span>
                <span className="text-[10px] text-[#717684] dark:text-[#8E95A5] font-mono mt-0.5 block">
                  Пост дозирования
                </span>
              </div>
            </div>

            <div className="h-4 w-px bg-[#E5E5E0] dark:bg-[#2A2D34] hidden sm:block" />

            {/* Active Formula Selector */}
            {currentRecipe && (
              <button
                type="button"
                onClick={onOpenRecipeSelect}
                id="header-recipe-pill"
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#F4F4F0] hover:bg-[#EBEBE5] dark:bg-[#1C1E23] dark:hover:bg-[#252830] border border-[#E0E0D9] dark:border-[#2D3039] transition text-left group min-w-0"
                title="Выбрать другую рецептуру смеси"
              >
                <FlaskConical className="w-3.5 h-3.5 text-[#E63B00] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] uppercase font-bold text-[#717684] dark:text-[#8E95A5] leading-none">Рецепт:</div>
                  <div className="text-xs font-mono font-bold text-[#111215] dark:text-white group-hover:text-[#E63B00] transition truncate max-w-[110px] sm:max-w-[180px]">
                    {currentRecipe.code} <span className="font-normal text-[#717684] dark:text-[#8E95A5] hidden md:inline">({currentRecipe.name})</span>
                  </div>
                </div>
                <ChevronDown className="w-3 h-3 text-[#717684] group-hover:text-[#E63B00] shrink-0 transition" />
              </button>
            )}
          </div>

          {/* Center: Navigation Tabs */}
          <nav className="flex items-center bg-[#EDEDE8] dark:bg-[#1C1E23] p-1 rounded-xl border border-[#E0E0D9] dark:border-[#2D3039] text-xs font-medium shrink-0">
            <button
              onClick={() => setActiveTab('console')}
              id="tab-btn-console"
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'console'
                  ? 'bg-white dark:bg-[#282B33] text-[#111215] dark:text-white font-bold shadow-sm'
                  : 'text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Пульт</span>
            </button>

            <button
              onClick={() => setActiveTab('journal')}
              id="tab-btn-journal"
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'journal'
                  ? 'bg-white dark:bg-[#282B33] text-[#111215] dark:text-white font-bold shadow-sm'
                  : 'text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Журнал</span>
              {batchesCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  activeTab === 'journal' 
                    ? 'bg-[#111215] text-white dark:bg-white dark:text-[#111215]' 
                    : 'bg-[#DFDFD8] text-[#5E6472] dark:bg-[#2A2D35] dark:text-[#8E95A5]'
                }`}>
                  {batchesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('recipes')}
              id="tab-btn-recipes"
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition hidden sm:flex ${
                activeTab === 'recipes'
                  ? 'bg-white dark:bg-[#282B33] text-[#111215] dark:text-white font-bold shadow-sm'
                  : 'text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Формулы</span>
            </button>

            <button
              onClick={() => setActiveTab('archive')}
              id="tab-btn-archive"
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition hidden md:flex ${
                activeTab === 'archive'
                  ? 'bg-white dark:bg-[#282B33] text-[#111215] dark:text-white font-bold shadow-sm'
                  : 'text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Архив</span>
            </button>
          </nav>

          {/* Right: Telemetry & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Shift Mini Telemetry */}
            <div className="hidden xl:flex items-center gap-3 bg-[#F4F4F0] dark:bg-[#1A1C21] px-2.5 py-1 rounded-lg border border-[#E0E0D9] dark:border-[#2D3039] text-xs font-mono">
              <div>
                <span className="text-[9px] uppercase text-[#717684] dark:text-[#8E95A5] block leading-none">Тоннаж</span>
                <span className="text-[#111215] dark:text-white font-bold">{totalTons.toFixed(3)} т</span>
              </div>
              <div className="h-4 w-px bg-[#E0E0D9] dark:bg-[#2D3039]" />
              <div>
                <span className="text-[9px] uppercase text-[#717684] dark:text-[#8E95A5] block leading-none">Откл.</span>
                <span className={`font-bold ${isOver ? 'text-[#E63B00]' : isUnder ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {totalDeviationKg > 0 ? `+${totalDeviationKg}` : totalDeviationKg} кг
                </span>
              </div>
            </div>

            {/* Updates Button */}
            <button
              type="button"
              onClick={onOpenUpdates}
              id="btn-header-updates"
              className="px-2.5 py-1.5 rounded-lg bg-[#F4F4F0] hover:bg-[#EBEBE5] dark:bg-[#1C1E23] dark:hover:bg-[#252830] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs font-semibold flex items-center gap-1.5 transition"
              title="Центр обновлений (SSL OTA и .alex-patch)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#E63B00]" />
              <span className="hidden lg:inline">Обновления</span>
            </button>

            {/* Direct PDF Export */}
            {batchesCount > 0 && (
              <button
                type="button"
                onClick={onExportPdf}
                id="btn-header-pdf"
                className="px-2.5 py-1.5 rounded-lg bg-[#F4F4F0] hover:bg-[#EBEBE5] dark:bg-[#1C1E23] dark:hover:bg-[#252830] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs font-semibold flex items-center gap-1.5 transition"
                title="Скачать официальный сменный акт в PDF"
              >
                <FileText className="w-3.5 h-3.5 text-[#E63B00]" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              id="btn-header-sound"
              className="p-2 rounded-lg bg-[#F4F4F0] hover:bg-[#EBEBE5] dark:bg-[#1C1E23] dark:hover:bg-[#252830] text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white border border-[#E0E0D9] dark:border-[#2D3039] transition"
              title={settings.soundEnabled ? 'Звуковой сигнал включен' : 'Звуковой сигнал выключен'}
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-[#9CA3AF]" />
              )}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              id="btn-header-theme"
              className="p-2 rounded-lg bg-[#F4F4F0] hover:bg-[#EBEBE5] dark:bg-[#1C1E23] dark:hover:bg-[#252830] text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white border border-[#E0E0D9] dark:border-[#2D3039] transition"
              title="Переключить тему оформления (Светлая / Тёмная)"
            >
              {isDarkMode ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-[#5E6472]" />
              )}
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={onOpenSupport}
              id="btn-header-settings"
              className="p-2 rounded-lg bg-[#F4F4F0] hover:bg-[#EBEBE5] dark:bg-[#1C1E23] dark:hover:bg-[#252830] text-[#5E6472] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white border border-[#E0E0D9] dark:border-[#2D3039] transition"
              title="Параметры и безопасность"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {/* Finish Shift Button */}
            {batchesCount > 0 && (
              <button
                type="button"
                onClick={onFinishShift}
                id="btn-header-finish-shift"
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#111215] hover:bg-[#252830] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] text-xs font-bold shadow-sm transition flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#E63B00]" />
                <span className="hidden sm:inline">Итоги</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
