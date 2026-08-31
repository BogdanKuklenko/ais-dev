import React, { useState } from 'react';
import { 
  FlaskConical, 
  Search, 
  Check, 
  Plus, 
  Info, 
  ChevronRight,
  X
} from 'lucide-react';
import { Recipe } from '../types';

interface RecipeSelectorProps {
  recipes: Recipe[];
  currentRecipeId?: string;
  onSelectRecipe: (recipe: Recipe) => void;
  onClose: () => void;
  onOpenRecipeManager: () => void;
}

export const RecipeSelector: React.FC<RecipeSelectorProps> = ({
  recipes,
  currentRecipeId,
  onSelectRecipe,
  onClose,
  onOpenRecipeManager,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [previewRecipe, setPreviewRecipe] = useState<Recipe | null>(
    recipes.find((r) => r.id === currentRecipeId) || recipes[0] || null
  );

  const categories = ['Все', 'Штукатурка', 'Клей', 'Кладочные', 'Бетоны и Стяжки', 'Специальные'];

  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch =
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory === 'Все' || r.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div 
        id="recipe-selector-modal"
        className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#111215] dark:text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EBEBE6] dark:border-[#26282E] flex items-center justify-between sticky top-0 bg-white dark:bg-[#15171C]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-bold">
              <FlaskConical className="w-4 h-4 text-[#E63B00]" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#111215] dark:text-white">
                Каталог формул смеси
              </h2>
              <p className="text-xs text-[#717684] dark:text-[#8E95A5]">
                Выберите технологическую рецептуру для весового пульта завода ООО «АЛЕКС»
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenRecipeManager}
              id="btn-add-new-recipe-from-selector"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F4F0] hover:bg-[#EAEAE4] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white border border-[#E0E0D9] dark:border-[#2D3039] text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5 text-[#E63B00]" />
              <span>Редактор формул</span>
            </button>
            <button
              onClick={onClose}
              id="btn-close-recipe-selector"
              className="p-1.5 rounded-lg hover:bg-[#F0F0EB] dark:hover:bg-[#202229] text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="p-3.5 border-b border-[#EBEBE6] dark:border-[#26282E] bg-[#F8F8F5] dark:bg-[#181A20] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="recipe-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по марке (С-41, П-20, Мучка, Фасадная)..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-lg text-xs text-[#111215] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#E63B00]"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-[#111215] text-white dark:bg-white dark:text-[#111215]'
                    : 'bg-[#EDEDE8] text-[#5E6472] dark:bg-[#22242B] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Main 2-Column Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* List (Left) */}
          <div className="lg:col-span-7 p-4 overflow-y-auto max-h-[58vh] space-y-2 border-r border-[#EBEBE6] dark:border-[#26282E]">
            {filteredRecipes.length === 0 ? (
              <div className="text-center py-12 text-[#717684]">
                <Info className="w-6 h-6 mx-auto mb-2 opacity-40 text-[#E63B00]" />
                <p className="font-semibold text-xs text-[#111215] dark:text-white">Рецептура не найдена</p>
              </div>
            ) : (
              filteredRecipes.map((r) => {
                const isSelected = r.id === previewRecipe?.id;
                const isCurrentActive = r.id === currentRecipeId;

                return (
                  <div
                    key={r.id}
                    onClick={() => setPreviewRecipe(r)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#FFF6F3] dark:bg-[#241A17] border-[#E63B00] shadow-sm ring-1 ring-[#E63B00]/30'
                        : 'bg-white dark:bg-[#15171C] border-[#E5E5E0] dark:border-[#26282E] hover:border-[#111215] dark:hover:border-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-black text-[#111215] dark:text-white text-base">
                            {r.code}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#F0F0EB] dark:bg-[#202229] text-[#5E6472] dark:text-[#8E95A5]">
                            {r.category}
                          </span>
                          {isCurrentActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> На пульте
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-[#111215] dark:text-white text-xs sm:text-sm mt-0.5">
                          {r.name}
                        </h4>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-[10px] text-[#717684]">1 замес:</div>
                        <div className="font-black text-[#111215] dark:text-white text-sm">
                          {r.targetTotalWeightKg} кг
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#EBEBE6] dark:border-[#22242B] text-[11px] font-mono">
                      {r.components.map((c) => (
                        <span
                          key={c.id}
                          className="px-1.5 py-0.5 rounded bg-[#F8F8F5] dark:bg-[#1A1C22] text-[#5E6472] dark:text-[#8E95A5]"
                        >
                          {c.name}: <strong className="text-[#111215] dark:text-white">{c.targetWeightKg} кг</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Specification (Right) */}
          <div className="lg:col-span-5 bg-[#F8F8F5] dark:bg-[#181A20] p-4 sm:p-5 overflow-y-auto max-h-[58vh] flex flex-col justify-between">
            {previewRecipe ? (
              <div className="space-y-4">
                <div className="border-b border-[#EBEBE6] dark:border-[#26282E] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#E63B00] font-mono font-bold">
                      Паспорт рецептуры
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#EBEBE6] dark:bg-[#202229] text-[#5E6472] dark:text-[#8E95A5]">
                      {previewRecipe.category}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-[#111215] dark:text-white mt-1">
                    {previewRecipe.code} — {previewRecipe.name}
                  </h3>
                  <p className="text-xs text-[#717684] dark:text-[#8E95A5] mt-0.5">
                    {previewRecipe.description || 'Стандартная рецептура завода ООО «АЛЕКС»'}
                  </p>
                </div>

                <div className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl p-3 flex items-center justify-between font-mono">
                  <div>
                    <div className="text-[10px] text-[#717684] uppercase font-bold">Норма 1 замеса:</div>
                    <div className="text-lg font-black text-[#111215] dark:text-white">
                      {previewRecipe.targetTotalWeightKg} кг
                    </div>
                  </div>
                  <div className="text-right text-xs text-[#717684]">
                    Компонентов: <strong className="text-[#111215] dark:text-white">{previewRecipe.components.length}</strong>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-[#717684] tracking-wider">
                    Компоненты на 1 замес:
                  </div>
                  {previewRecipe.components.map((comp, idx) => (
                    <div
                      key={comp.id}
                      className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-lg p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#F0F0EB] dark:bg-[#202229] flex items-center justify-center font-mono text-[10px] text-[#5E6472] dark:text-[#8E95A5] font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-[#111215] dark:text-white">{comp.name}</div>
                          {comp.fraction && (
                            <div className="text-[10px] text-[#717684] font-mono">{comp.fraction}</div>
                          )}
                        </div>
                      </div>

                      <div className="font-mono font-bold text-[#111215] dark:text-white">
                        {comp.targetWeightKg} кг
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-[#717684]">Выберите рецептуру слева</div>
            )}

            {previewRecipe && (
              <div className="pt-4 border-t border-[#EBEBE6] dark:border-[#26282E] mt-4">
                <button
                  onClick={() => {
                    onSelectRecipe(previewRecipe);
                    onClose();
                  }}
                  id="btn-apply-selected-recipe"
                  className="w-full py-3 px-4 rounded-xl bg-[#111215] hover:bg-[#272A33] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] font-black font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow transition"
                >
                  <Check className="w-4 h-4 text-[#E63B00]" />
                  <span>Установить «{previewRecipe.code}» на пульт</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
