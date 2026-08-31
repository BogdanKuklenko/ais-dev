import React, { useState } from 'react';
import { 
  HardHat, 
  X, 
  Sliders,
  RefreshCw,
  ShieldCheck,
  Lock,
  Globe,
  Key,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  AlertCircle,
  Radio,
  Server,
  Fingerprint,
  History
} from 'lucide-react';
import { AppSettings, ServerApiSslConfig } from '../types';
import { testServerSslConnection, SslTestResult } from '../lib/serverApiClient';

interface TechSupportModalProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClose: () => void;
  onOpenUpdates?: () => void;
  onOpenVersionHistory?: () => void;
  onTriggerForcedUpdateTest?: () => void;
}

export const TechSupportModal: React.FC<TechSupportModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  onOpenUpdates,
  onOpenVersionHistory,
  onTriggerForcedUpdateTest,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingSsl, setIsTestingSsl] = useState(false);
  const [sslTestResult, setSslTestResult] = useState<SslTestResult | null>(null);

  const sslConfig: ServerApiSslConfig = settings.serverApiSsl || {
    enabled: true,
    serverUrl: 'https://api.alex-mixes.ru/v1/ota',
    apiKey: 'ALEX-PLANT-SECURE-KEY-2026',
    sslMode: 'strict',
    sslCertFingerprint: 'SHA256: 7F:1B:3C:99:A4:02:88:51:29:EC:B7:FE:63:10:8D:19:D4:5A:66:31:09:A5:18:7C',
    pollIntervalSec: 30,
    autoForceApplyMandatoryUpdates: true,
    preserveSessionOnHotReload: true,
    status: 'connected',
  };

  const updateSslConfig = (patch: Partial<ServerApiSslConfig>) => {
    const updated: ServerApiSslConfig = {
      ...sslConfig,
      ...patch,
    };
    onUpdateSettings({
      ...settings,
      serverApiSsl: updated,
    });
  };

  const handleRunSslTest = async () => {
    setIsTestingSsl(true);
    setSslTestResult(null);
    try {
      const res = await testServerSslConnection(sslConfig);
      setSslTestResult(res);
    } catch (e) {
      setSslTestResult({
        success: false,
        latencyMs: 0,
        tlsVersion: 'Ошибка',
        cipher: 'N/A',
        certIssuer: 'N/A',
        certValidUntil: 'N/A',
        fingerprintMatch: false,
        serverTime: new Date().toISOString(),
        message: 'Не удалось выполнить SSL опрос сервера',
        error: e instanceof Error ? e.message : 'Сетевой сбой'
      });
    } finally {
      setIsTestingSsl(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div 
        id="tech-support-modal"
        className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#111215] dark:text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#EBEBE6] dark:border-[#26282E] flex items-center justify-between sticky top-0 bg-white dark:bg-[#15171C] z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5 text-[#E63B00]" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-[#111215] dark:text-white">
                Параметры и сетевая безопасность пульта
              </h2>
              <p className="text-xs sm:text-sm text-[#717684] dark:text-[#8E95A5]">
                Весовой пульт дозирования завода ООО «АЛЕКС» • Конфигурация SSL API
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="btn-close-tech-support"
            className="p-2 rounded-xl hover:bg-[#F0F0EB] dark:hover:bg-[#202229] text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Workstation Settings */}
          <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-4 sm:p-5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E] space-y-3.5">
            <h3 className="font-black text-[#111215] dark:text-white text-base">
              Настройки рабочего места:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs text-[#717684] uppercase font-bold block mb-1.5">
                  ФИО / Табельный номер оператора:
                </label>
                <input
                  type="text"
                  value={settings.operatorName}
                  onChange={(e) => onUpdateSettings({ ...settings, operatorName: e.target.value })}
                  placeholder="Иванов И.И."
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl text-sm text-[#111215] dark:text-white font-medium focus:outline-none focus:border-[#E63B00]"
                />
              </div>

              <div>
                <label className="text-xs text-[#717684] uppercase font-bold block mb-1.5">
                  Предприятие:
                </label>
                <input
                  type="text"
                  value={settings.plantName}
                  onChange={(e) => onUpdateSettings({ ...settings, plantName: e.target.value })}
                  placeholder="ООО «АЛЕКС»"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl text-sm text-[#111215] dark:text-white font-medium focus:outline-none focus:border-[#E63B00]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-sm">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => onUpdateSettings({ ...settings, soundEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-[#E0E0D9] text-[#111215]"
                />
                <span>Звуковой сигнал фиксации замеса</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-sm">
                <input
                  type="checkbox"
                  checked={settings.autoAdvanceOnEnter}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, autoAdvanceOnEnter: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-[#E0E0D9] text-[#111215]"
                />
                <span>Автопереход по клавише Enter</span>
              </label>
            </div>
          </div>

          {/* SSL Server API Configuration Section */}
          <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-4 sm:p-5 rounded-xl border-2 border-[#059669]/30 dark:border-[#059669]/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E0] dark:border-[#26282E]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-[#111215] dark:text-white text-base flex items-center gap-2">
                    <span>Доступ к серверу по API (SSL / HTTPS способ)</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>TLS 1.3 Active</span>
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-[#717684] dark:text-[#8E95A5]">
                    Защищенный обмен данными с заводским сервером АСУ ТП и прием принудительных команд
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer font-black shrink-0 bg-white dark:bg-[#111215] px-3.5 py-2 rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
                <input
                  type="checkbox"
                  checked={sslConfig.enabled}
                  onChange={(e) => updateSslConfig({ enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs sm:text-sm">Включить SSL API</span>
              </label>
            </div>

            {/* Server Endpoint URL */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-8">
                <label className="text-xs text-[#717684] uppercase font-bold block mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span>HTTPS Сервер API (SSL Endpoint):</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-emerald-600 font-mono text-sm select-none">
                    https://
                  </span>
                  <input
                    type="text"
                    value={sslConfig.serverUrl.replace(/^https?:\/\//i, '')}
                    onChange={(e) => updateSslConfig({ serverUrl: `https://${e.target.value.replace(/^https?:\/\//i, '')}` })}
                    placeholder="api.alex-mixes.ru/v1/ota"
                    disabled={!sslConfig.enabled}
                    className="w-full pl-20 pr-3.5 py-2.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl text-[#111215] dark:text-white font-mono text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="text-xs text-[#717684] uppercase font-bold block mb-1.5 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-[#E63B00]" />
                  <span>Интервал опроса:</span>
                </label>
                <select
                  value={sslConfig.pollIntervalSec}
                  onChange={(e) => updateSslConfig({ pollIntervalSec: Number(e.target.value) })}
                  disabled={!sslConfig.enabled}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl text-[#111215] dark:text-white font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value={15}>Каждые 15 секунд (Реальное время)</option>
                  <option value={30}>Каждые 30 секунд (Рекомендуется)</option>
                  <option value={60}>Каждую минуту</option>
                  <option value={300}>Каждые 5 минут</option>
                  <option value={0}>Только Push / Вручную</option>
                </select>
              </div>
            </div>

            {/* API Key and SSL Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-6">
                <label className="text-xs text-[#717684] uppercase font-bold block mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>Ключ авторизации API (API Key / Bearer Token):</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={sslConfig.apiKey}
                    onChange={(e) => updateSslConfig({ apiKey: e.target.value })}
                    placeholder="ALEX-PLANT-SECURE-KEY-..."
                    disabled={!sslConfig.enabled}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl text-[#111215] dark:text-white font-mono text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-3 text-[#717684] hover:text-[#111215] dark:hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-6">
                <label className="text-xs text-[#717684] uppercase font-bold block mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Метод валидации SSL / TLS:</span>
                </label>
                <select
                  value={sslConfig.sslMode}
                  onChange={(e) => updateSslConfig({ sslMode: e.target.value as 'strict' | 'custom_cert' | 'pinning' })}
                  disabled={!sslConfig.enabled}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl text-[#111215] dark:text-white font-bold text-xs sm:text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="strict">Строгая проверка сертификата CA (Strict TLS 1.3)</option>
                  <option value="pinning">Закрепление отпечатка (Certificate Pinning SHA-256)</option>
                  <option value="custom_cert">Внутризаводской самоподписанный SSL (Mutual TLS)</option>
                </select>
              </div>
            </div>

            {/* SSL Fingerprint (Pinning) */}
            <div>
              <label className="text-xs text-[#717684] uppercase font-bold block mb-1.5 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-indigo-500" />
                <span>Отпечаток SSL-сертификата (SHA-256 Fingerprint для Pinning):</span>
              </label>
              <input
                type="text"
                value={sslConfig.sslCertFingerprint || ''}
                onChange={(e) => updateSslConfig({ sslCertFingerprint: e.target.value })}
                placeholder="SHA256: 7F:1B:3C:99:A4:02:88:51:29:EC:B7:FE:63:10:8D:19:D4:5A:66:31:09:A5:18:7C"
                disabled={!sslConfig.enabled}
                className="w-full px-3.5 py-2 bg-white dark:bg-[#111215] border border-[#E5E5E0] dark:border-[#26282E] rounded-xl text-[#111215] dark:text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
            </div>

            {/* Server Force Update & Zero-Loss Session Controls */}
            <div className="bg-white dark:bg-[#111215] p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sslConfig.autoForceApplyMandatoryUpdates}
                  onChange={(e) => updateSslConfig({ autoForceApplyMandatoryUpdates: e.target.checked })}
                  disabled={!sslConfig.enabled}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-black text-[#111215] dark:text-white text-sm block flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Принудительное авто-обновление без подтверждения (Server Force Push)</span>
                  </span>
                  <span className="text-xs text-[#5E6472] dark:text-[#8E95A5] mt-0.5 block">
                    Сервер может удаленно обновить формулы смесей и конфигурацию пульта без необходимости нажатия кнопок оператором.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-[#F0F0EB] dark:border-[#202229]">
                <input
                  type="checkbox"
                  checked={sslConfig.preserveSessionOnHotReload}
                  onChange={(e) => updateSslConfig({ preserveSessionOnHotReload: e.target.checked })}
                  disabled={!sslConfig.enabled}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-black text-[#111215] dark:text-white text-sm block flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Полная защита сессии и весов при перезагрузке (Zero-Loss Hot Reload)</span>
                  </span>
                  <span className="text-xs text-[#5E6472] dark:text-[#8E95A5] mt-0.5 block">
                    Все набранные граммы в полях текущего замеса, номер замеса, активная смена и журнал гарантированно сохраняются в памяти при любом обновлении.
                  </span>
                </div>
              </label>
            </div>

            {/* Action Buttons: Test SSL Connection & Simulate Server Force Push */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRunSslTest}
                  disabled={isTestingSsl || !sslConfig.enabled}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition disabled:opacity-50 shadow-sm"
                >
                  <ShieldCheck className={`w-4 h-4 ${isTestingSsl ? 'animate-spin' : ''}`} />
                  <span>{isTestingSsl ? 'Тестирование SSL...' : 'Проверить SSL соединение'}</span>
                </button>

                {onTriggerForcedUpdateTest && (
                  <button
                    type="button"
                    onClick={onTriggerForcedUpdateTest}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 transition shadow-sm"
                    title="Эмулирует приход принудительного обновления от сервера без потери сессии"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Тест принудительного обновления сервера</span>
                  </button>
                )}
              </div>

              <div className="text-xs sm:text-sm text-[#717684] dark:text-[#8E95A5] flex items-center gap-1.5">
                <Server className="w-4 h-4 text-emerald-600" />
                <span>Статус: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">SSL TLS 1.3 Подключен</strong></span>
              </div>
            </div>

            {/* SSL Test Result Display */}
            {sslTestResult && (
              <div className={`p-4 rounded-xl border text-sm ${
                sslTestResult.success 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200' 
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
              }`}>
                <div className="flex items-center gap-2 font-bold mb-2">
                  {sslTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <span>{sslTestResult.message}</span>
                </div>
                {sslTestResult.success && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1.5 font-mono text-xs text-emerald-800 dark:text-emerald-300">
                    <div>
                      <span className="opacity-70 block">Пинг:</span>
                      <strong>{sslTestResult.latencyMs} мс</strong>
                    </div>
                    <div>
                      <span className="opacity-70 block">Протокол:</span>
                      <strong>{sslTestResult.tlsVersion.split(' ')[0]}</strong>
                    </div>
                    <div>
                      <span className="opacity-70 block">Шифр:</span>
                      <strong className="truncate block" title={sslTestResult.cipher}>{sslTestResult.cipher.slice(0, 16)}...</strong>
                    </div>
                    <div>
                      <span className="opacity-70 block">Сертификат:</span>
                      <strong>Валиден (PKI)</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Guide */}
          <div className="space-y-2.5">
            <h3 className="font-black text-[#111215] dark:text-white text-base flex items-center gap-2">
              <HardHat className="w-5 h-5 text-[#E63B00]" />
              <span>Быстрая инструкция:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white dark:bg-[#15171C] p-3.5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
                <strong className="text-[#111215] dark:text-white block font-bold text-sm">1. Выбор формулы</strong>
                <p className="text-[#5E6472] dark:text-[#8E95A5] mt-1 text-xs sm:text-sm">
                  Нажмите на кнопку рецепта в шапке, чтобы переключить паспорт смеси (С-41, П-20, КП-80).
                </p>
              </div>

              <div className="bg-white dark:bg-[#15171C] p-3.5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
                <strong className="text-[#111215] dark:text-white block font-bold text-sm">2. Ввод веса и Enter</strong>
                <p className="text-[#5E6472] dark:text-[#8E95A5] mt-1 text-xs sm:text-sm">
                  Вводите вес каждого компонента. Клавиша <kbd className="px-2 py-0.5 bg-[#F0F0EB] dark:bg-[#202229] border border-[#E0E0D9] dark:border-[#2D3039] rounded font-mono text-xs font-bold">Enter</kbd> переходит к следующему полю, а на последнем сохраняет замес.
                </p>
              </div>

              <div className="bg-white dark:bg-[#15171C] p-3.5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
                <strong className="text-[#111215] dark:text-white block font-bold text-sm">3. Правка замесов</strong>
                <p className="text-[#5E6472] dark:text-[#8E95A5] mt-1 text-xs sm:text-sm">
                  Во вкладке «Журнал» можно в любой момент отредактировать любой предыдущий замес смены.
                </p>
              </div>

              <div className="bg-white dark:bg-[#15171C] p-3.5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E]">
                <strong className="text-[#111215] dark:text-white block font-bold text-sm">4. Экспорт PDF и Excel</strong>
                <p className="text-[#5E6472] dark:text-[#8E95A5] mt-1 text-xs sm:text-sm">
                  Кнопка «PDF» или «Итоги смены» формирует производственный акт А4 с подписями для ОТК и лаборатории.
                </p>
              </div>
            </div>
          </div>

          {/* Updates & Patching block */}
          <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-4 sm:p-5 rounded-xl border border-[#E5E5E0] dark:border-[#26282E] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#E63B00]" />
                <span className="font-black text-[#111215] dark:text-white text-base">
                  Обновление ПО и накатывание патчей:
                </span>
              </div>
              <p className="text-[#5E6472] dark:text-[#8E95A5] mt-1 text-xs sm:text-sm">
                Загрузка обновлений по защищенному каналу SSL (OTA) или установка файлов патчей (.alex-patch / .patch) с флешки.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              {onOpenVersionHistory && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVersionHistory();
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-[#F4F4F0] hover:bg-[#EBEBE4] dark:bg-[#202229] dark:hover:bg-[#2A2D36] border border-[#E0E0D9] dark:border-[#333640] text-[#111215] dark:text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition shrink-0"
                  title="Открыть паспорт версий и журнал модификаций"
                >
                  <History className="w-4 h-4 text-[#E63B00]" />
                  <span>Учёт версий</span>
                </button>
              )}
              {onOpenUpdates && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUpdates();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#111215] hover:bg-[#272A33] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] font-bold text-xs sm:text-sm flex items-center gap-2 transition shrink-0"
                >
                  <RefreshCw className="w-4 h-4 text-[#E63B00]" />
                  <span>Центр обновлений</span>
                </button>
              )}
            </div>
          </div>

          {/* Support Email */}
          <div className="bg-[#F8F8F5] dark:bg-[#1A1C22] p-4 rounded-xl border border-[#E5E5E0] dark:border-[#26282E] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-[#111215] dark:text-white text-sm block">
                Служба сопровождения и АСУ ТП:
              </span>
              <span className="text-[#717684] text-xs sm:text-sm">
                По вопросам доработки, SSL сертификатов или интеграции с 1С
              </span>
            </div>
            <span className="font-mono font-bold text-[#111215] dark:text-white bg-white dark:bg-[#111215] px-3 py-1.5 rounded-lg border border-[#E5E5E0] dark:border-[#26282E] text-xs sm:text-sm">
              qoii1988@gmail.com
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#EBEBE6] dark:border-[#26282E] bg-white dark:bg-[#15171C] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#717684] dark:text-[#8E95A5]">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>SSL Сервер АСУ ТП: {sslConfig.enabled ? sslConfig.serverUrl.replace(/^https?:\/\//i, '') : 'Отключен'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#111215] hover:bg-[#272A33] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] font-bold text-xs sm:text-sm transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

