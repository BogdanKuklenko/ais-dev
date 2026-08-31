import React, { useState } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RotateCcw, 
  X, 
  Check
} from 'lucide-react';
import { Recipe, RecipeComponent } from '../types';

interface RecipeManagerModalProps {
  recipes: Recipe[];
  onSaveRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onResetDefaults: () => void;
  onClose: () => void;
}

export const RecipeManagerModal: React.FC<RecipeManagerModalProps> = ({
  recipes,
  onSaveRecipe,
  onDeleteRecipe,
  onResetDefaults,
  onClose,
}) => {
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const startCreateNew = () => {
    const newRec: Recipe = {
      id: `custom_rec_${Date.now()}`,
      code: 'С-',
      name: 'Новая рецептура смеси',
      category: 'Штукатурка',
      description: 'Индивидуальный рецептурный состав',
      targetTotalWeightKg: 1500,
      updatedAt: new Date().toISOString(),
      isCustom: true,
      components: [
        {
          id: `comp_${Date.now()}_1`,
          name: 'Цемент',
          fraction: 'П-500 (ЦЕМ I 42.5)',
          targetWeightKg: 400,
          unit: 'кг',
          tolerancePercent: 1.5,
        },
        {
          id: `comp_${Date.now()}_2`,
          name: 'Песок сухой',
          fraction: 'фр. 0–0.6 мм',
          targetWeightKg: 400,
          unit: 'кг',
          tolerancePercent: 2.0,
        },
        {
          id: `comp_${Date.now()}_3`,
          name: 'Песок сухой',
          fraction: 'фр. 1.0–2.0 мм',
          targetWeightKg: 600,
          unit: 'кг',
          tolerancePercent: 2.0,
        },
        {
          id: `comp_${Date.now()}_4`,
          name: 'Мучка доломитовая',
          fraction: 'тонкий помол',
          targetWeightKg: 80,
          unit: 'кг',
          tolerancePercent: 3.0,
        },
        {
          id: `comp_${Date.now()}_5`,
          name: 'Добавка комплексная',
          fraction: 'модификатор',
          targetWeightKg: 20,
          unit: 'кг',
          tolerancePercent: 5.0,
        },
      ],
    };
    setEditingRecipe(newRec);
    setIsCreatingNew(true);
  };

  const handleComponentChange = (
    compId: string,
    field: keyof RecipeComponent,
    value: string | number
  ) => {
    if (!editingRecipe) return;
    const updated = editingRecipe.components.map((c) => {
      if (c.id !== compId) return c;
      return { ...c, [field]: value };
    });

    const newTotal = updated.reduce((sum, c) => sum + (Number(c.targetWeightKg) || 0), 0);

    setEditingRecipe({
      ...editingRecipe,
      components: updated,
      targetTotalWeightKg: newTotal,
    });
  };

  const addComponent = () => {
    if (!editingRecipe) return;
    const newComp: RecipeComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: 'Новый компонент',
      fraction: 'стандарт',
      targetWeightKg: 50,
      unit: 'кг',
      tolerancePercent: 2.0,
    };
    const updated = [...editingRecipe.components, newComp];
    const newTotal = updated.reduce((sum, c) => sum + (Number(c.targetWeightKg) || 0), 0);
    setEditingRecipe({
      ...editingRecipe,
      components: updated,
      targetTotalWeightKg: newTotal,
    });
  };

  const removeComponent = (compId: string) => {
    if (!editingRecipe) return;
    if (editingRecipe.components.length <= 1) {
      alert('В рецепте должен оставаться хотя бы один компонент!');
      return;
    }
    const updated = editingRecipe.components.filter((c) => c.id !== compId);
    const newTotal = updated.reduce((sum, c) => sum + (Number(c.targetWeightKg) || 0), 0);
    setEditingRecipe({
      ...editingRecipe,
      components: updated,
      targetTotalWeightKg: newTotal,
    });
  };

  const handleSave = () => {
    if (!editingRecipe) return;
    if (!editingRecipe.code.trim()) {
      alert('Укажите код смеси (например С-41)!');
      return;
    }
    if (!editingRecipe.name.trim()) {
      alert('Укажите наименование смеси!');
      return;
    }

    onSaveRecipe({
      ...editingRecipe,
      updatedAt: new Date().toISOString(),
    });
    setEditingRecipe(null);
    setIsCreatingNew(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div 
        id="recipe-manager-modal"
        className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#111215] dark:text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EBEBE6] dark:border-[#26282E] flex items-center justify-between sticky top-0 bg-white dark:bg-[#15171C] z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-bold">
              <Layers className="w-4 h-4 text-[#E63B00]" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#111215] dark:text-white">
                Редактор технологических формул
              </h2>
              <p className="text-xs text-[#717684] dark:text-[#8E95A5]">
                Управление нормами расхода компонентов смесей завода ООО «АЛЕКС»
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!editingRecipe && (
              <button
                onClick={startCreateNew}
                id="btn-create-recipe-modal"
                className="px-3 py-1.5 rounded-lg bg-[#111215] hover:bg-[#272A33] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] text-xs font-bold flex items-center gap-1.5 shadow transition"
              >
                <Plus className="w-3.5 h-3.5 text-[#E63B00]" />
                <span>Новая формула</span>
              </button>
            )}
            <button
              onClick={onClose}
              id="btn-close-recipe-manager"
              className="p-1.5 rounded-lg hover:bg-[#F0F0EB] dark:hover:bg-[#202229] text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {editingRecipe ? (
            <div className="space-y-5">
              <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-4 rounded-xl border border-[#E5E5E0] dark:border-[#26282E] space-y-4">
                <div className="flex items-center justify-between border-b border-[#EBEBE6] dark:border-[#26282E] pb-3">
                  <h3 className="font-extrabold text-[#111215] dark:text-white text-sm">
                    {isCreatingNew ? 'Новая рецептура' : `Редактирование «${editingRecipe.code}»`}
                  </h3>
                  <span className="text-xs font-mono font-bold text-[#111215] dark:text-white">
                    Норма замеса: {editingRecipe.targetTotalWeightKg} кг
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-[#717684] uppercase font-bold block mb-1">
                      Код формулы *
                    </label>
                    <input
                      type="text"
                      value={editingRecipe.code}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, code: e.target.value })}
                      placeholder="С-41"
                      className="w-full px-3 py-2 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-lg text-[#111215] dark:text-white font-mono font-bold focus:outline-none focus:border-[#E63B00]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#717684] uppercase font-bold block mb-1">
                      Категория смеси
                    </label>
                    <select
                      value={editingRecipe.category}
                      onChange={(e) =>
                        setEditingRecipe({
                          ...editingRecipe,
                          category: e.target.value as Recipe['category'],
                        })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-lg text-[#111215] dark:text-white font-medium focus:outline-none focus:border-[#E63B00]"
                    >
                      <option value="Штукатурка">Штукатурка</option>
                      <option value="Клей">Клей</option>
                      <option value="Кладочные">Кладочные</option>
                      <option value="Бетоны и Стяжки">Бетоны и Стяжки</option>
                      <option value="Специальные">Специальные</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#717684] uppercase font-bold block mb-1">
                      Полное наименование *
                    </label>
                    <input
                      type="text"
                      value={editingRecipe.name}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, name: e.target.value })}
                      placeholder="Штукатурка цементная..."
                      className="w-full px-3 py-2 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-lg text-[#111215] dark:text-white font-medium focus:outline-none focus:border-[#E63B00]"
                    />
                  </div>
                </div>
              </div>

              {/* Component Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-mono uppercase font-bold text-[#717684] tracking-wider">
                    Норма сырья на 1 замес (кг):
                  </h4>
                  <button
                    onClick={addComponent}
                    type="button"
                    className="text-xs font-semibold text-[#111215] dark:text-white hover:text-[#E63B00] flex items-center gap-1 bg-[#F4F4F0] dark:bg-[#202229] px-2.5 py-1 rounded-lg border border-[#E0E0D9] dark:border-[#2D3039]"
                  >
                    <Plus className="w-3 h-3 text-[#E63B00]" />
                    Добавить строку
                  </button>
                </div>

                <div className="space-y-1.5">
                  {editingRecipe.components.map((comp, idx) => (
                    <div
                      key={comp.id}
                      className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-2.5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
                    >
                      <div className="sm:col-span-1 font-mono font-bold text-[#717684] text-center">
                        #{idx + 1}
                      </div>

                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          value={comp.name}
                          onChange={(e) => handleComponentChange(comp.id, 'name', e.target.value)}
                          placeholder="Название компонента"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-lg text-[#111215] dark:text-white font-medium focus:outline-none focus:border-[#E63B00]"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          value={comp.fraction || ''}
                          onChange={(e) => handleComponentChange(comp.id, 'fraction', e.target.value)}
                          placeholder="Фракция / Марка"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-lg text-[#5E6472] dark:text-[#8E95A5] font-mono focus:outline-none focus:border-[#E63B00]"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <div className="relative">
                          <input
                            type="number"
                            value={comp.targetWeightKg}
                            onChange={(e) =>
                              handleComponentChange(
                                comp.id,
                                'targetWeightKg',
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-lg text-[#111215] dark:text-white font-mono font-bold pr-7 text-right focus:outline-none focus:border-[#E63B00]"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#9CA3AF]">
                            кг
                          </span>
                        </div>
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeComponent(comp.id)}
                          className="p-1.5 rounded hover:bg-rose-50 text-[#9CA3AF] hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EBEBE6] dark:border-[#26282E]">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecipe(null);
                    setIsCreatingNew(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#EBEBE6] hover:bg-[#DFDFD8] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  id="btn-save-recipe-changes"
                  className="px-5 py-2 rounded-xl bg-[#111215] hover:bg-[#272A33] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5 text-[#E63B00]" />
                  <span>Сохранить формулу</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#717684]">
                <span>Всего рецептур: <strong className="text-[#111215] dark:text-white font-mono">{recipes.length}</strong></span>
                <button
                  onClick={() => {
                    if (window.confirm('Сбросить базу рецептур до заводских стандартных?')) {
                      onResetDefaults();
                    }
                  }}
                  className="text-[#717684] hover:text-[#E63B00] flex items-center gap-1 text-[11px] font-mono transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  Сбросить к заводским
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recipes.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-[#111215] dark:hover:border-white transition"
                  >
                    <div>
                      <div className="flex items-center justify-between font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#111215] dark:text-white text-base">
                            {r.code}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#F0F0EB] dark:bg-[#202229] text-[#5E6472] dark:text-[#8E95A5]">
                            {r.category}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-[#111215] dark:text-white">
                          {r.targetTotalWeightKg} кг / замес
                        </span>
                      </div>

                      <h4 className="font-bold text-[#111215] dark:text-white text-sm mt-1">{r.name}</h4>
                      {r.description && (
                        <p className="text-xs text-[#717684] dark:text-[#8E95A5] mt-0.5 line-clamp-1">
                          {r.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EBEBE6] dark:border-[#22242B]">
                      <button
                        onClick={() => {
                          setEditingRecipe({ ...r });
                          setIsCreatingNew(false);
                        }}
                        className="px-2.5 py-1 rounded bg-[#F0F0EB] hover:bg-[#E4E4DE] dark:bg-[#202229] dark:hover:bg-[#2A2D36] text-[#111215] dark:text-white text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <Edit3 className="w-3 h-3 text-[#E63B00]" />
                        Изменить
                      </button>

                      {recipes.length > 1 && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Удалить рецепт «${r.code}»?`)) {
                              onDeleteRecipe(r.id);
                            }
                          }}
                          className="p-1 rounded hover:bg-rose-50 text-[#9CA3AF] hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
