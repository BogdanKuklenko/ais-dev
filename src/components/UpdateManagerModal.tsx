import React, { useState, useRef, useEffect } from 'react';
import { 
  Globe, 
  FileUp, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  DownloadCloud, 
  RefreshCw, 
  Upload, 
  FileCheck, 
  ShieldCheck, 
  Server, 
  Check, 
  Lock,
  ArrowRight,
  Cpu
} from 'lucide-react';
import { 
  Recipe, 
  AppSettings, 
  AlexPatchPackage, 
  UpdateManifest
} from '../types';
import { 
  SAMPLE_PATCHES, 
  validatePatchJson, 
  applyAlexPatch, 
  checkNetworkUpdates,
  calculateChecksum,
  downloadSslPatchPackage,
  getEffectiveAppVersion,
} from '../lib/patchEngine';
import { 
  getStoredUpdateServerUrl, 
  saveStoredUpdateServerUrl, 
  playBeep 
} from '../lib/storage';
import {
  isAlexDesktop,
  checkDesktopCodePatch,
  installDesktopCodePatch,
  checkDesktopCodeUpdate,
  downloadDesktopCodeUpdate,
  applyDesktopCodeUpdate,
  formatBytes,
} from '../lib/codeUpdateClient';
import type { CodeUpdateCheckResult } from '../electron-api';

interface UpdateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  settings: AppSettings;
  currentRecipeId: string | null;
  onUpdateState: (updatedRecipes: Recipe[], updatedSettings: AppSettings, updatedRecipeId?: string | null) => void;
  onTriggerForcedUpdateTest?: () => void;
}

type UpdateTab = 'code' | 'network' | 'file';

export const UpdateManagerModal: React.FC<UpdateManagerModalProps> = ({
  isOpen,
  onClose,
  recipes,
  settings,
  currentRecipeId,
  onUpdateState,
}) => {
  const [activeTab, setActiveTab] = useState<UpdateTab>('code');
  
  // 1. Network / SSL Update State
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const [networkManifest, setNetworkManifest] = useState<UpdateManifest | null>(null);
  const [networkCheckError, setNetworkCheckError] = useState<string | null>(null);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);
  const [updateSource, setUpdateSource] = useState<'remote' | 'bundled' | null>(null);
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [isSslVerified, setIsSslVerified] = useState<boolean>(true);
  const [isInstallingNetwork, setIsInstallingNetwork] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [networkHasUpdate, setNetworkHasUpdate] = useState<boolean | null>(null);
  const [serverUrl, setServerUrl] = useState(() => getStoredUpdateServerUrl());
  const [isEditingServerUrl, setIsEditingServerUrl] = useState(false);

  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeCheck, setCodeCheck] = useState<CodeUpdateCheckResult | null>(null);
  const [isInstallingPatch, setIsInstallingPatch] = useState(false);
  const [codeDlPercent, setCodeDlPercent] = useState(0);
  const [kernelCheck, setKernelCheck] = useState<CodeUpdateCheckResult | null>(null);
  const [isCheckingKernel, setIsCheckingKernel] = useState(false);
  const [isDownloadingKernel, setIsDownloadingKernel] = useState(false);
  const [kernelDlPercent, setKernelDlPercent] = useState(0);
  const [kernelReadyToApply, setKernelReadyToApply] = useState(false);
  const [isApplyingKernel, setIsApplyingKernel] = useState(false);

  // 2. File Patch State (.alex-patch / .json)
  const [uploadedPatch, setUploadedPatch] = useState<AlexPatchPackage | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [isApplyingPatch, setIsApplyingPatch] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Feedback State
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage(null);
    setPatchError(null);
    if (!isAlexDesktop()) return;
    let cancelled = false;
    setIsCheckingCode(true);
    void checkDesktopCodePatch()
      .then((result) => {
        if (!cancelled) setCodeCheck(result);
      })
      .catch(() => {
        if (!cancelled) {
          setCodeCheck({
            ok: false,
            desktop: true,
            kind: 'patch',
            hasUpdate: false,
            error: 'Не удалось проверить патч интерфейса',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsCheckingCode(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Handler: Real SSL Network Check
  const handleCheckNetwork = async () => {
    setIsCheckingNetwork(true);
    setNetworkCheckError(null);
    setNetworkWarning(null);
    setNetworkManifest(null);
    setNetworkHasUpdate(null);
    setUpdateSource(null);
    setStatusMessage(null);

    try {
      const result = await checkNetworkUpdates(serverUrl);
      setNetworkLatency(result.latencyMs ?? null);
      setIsSslVerified(result.sslVerified);
      setUpdateSource(result.source);
      setNetworkHasUpdate(result.hasUpdate);

      if (result.manifest) {
        setNetworkManifest(result.manifest);
        if (result.warning) setNetworkWarning(result.warning);
        if (settings.soundEnabled) playBeep('success');
      } else if (result.error) {
        setNetworkCheckError(result.error);
        if (settings.soundEnabled) playBeep('error');
      }
    } catch {
      setNetworkCheckError('Не удалось связаться с сервером обновлений по протоколу SSL/HTTPS');
      if (settings.soundEnabled) playBeep('error');
    } finally {
      setIsCheckingNetwork(false);
    }
  };

  // Handler: Install Real Network Update
  const handleInstallNetworkUpdate = async () => {
    if (!networkManifest) return;
    setIsInstallingNetwork(true);
    setInstallProgress(15);

    try {
      const loaded = await downloadSslPatchPackage(networkManifest, serverUrl);
      setInstallProgress(55);
      if (!loaded.patch) {
        setStatusMessage({ text: loaded.error || 'Патч не получен с сервера', type: 'error' });
        if (settings.soundEnabled) playBeep('error');
        return;
      }

      await new Promise((r) => setTimeout(r, 150));
      setInstallProgress(85);

      const res = applyAlexPatch(loaded.patch, recipes, settings, currentRecipeId);
      setInstallProgress(100);
      if (res.success) {
        onUpdateState(res.updatedRecipes, res.updatedSettings);
        const channel = loaded.viaSsl ? 'по защищенному каналу HTTPS/SSL' : 'из встроенного заводского пакета';
        setNetworkHasUpdate(false);
        setStatusMessage({
          text: `Полное обновление v${res.summary.version} установлено ${channel}. Рецептур добавлено/обновлено: ${res.summary.recipesAdded + res.summary.recipesUpdated}. Окна и подписи этим каналом не меняются — для кода нужен «Патч программы».`,
          type: 'success',
        });
        if (settings.soundEnabled) playBeep('success');
      } else {
        setStatusMessage({ text: res.error || 'Ошибка применения обновления', type: 'error' });
        if (settings.soundEnabled) playBeep('error');
      }
    } catch {
      setStatusMessage({ text: 'Сбой при наложении обновления', type: 'error' });
      if (settings.soundEnabled) playBeep('error');
    } finally {
      setIsInstallingNetwork(false);
      setInstallProgress(0);
    }
  };

  const handleCheckCode = async () => {
    setIsCheckingCode(true);
    setCodeDlPercent(0);
    setStatusMessage(null);
    try {
      const result = await checkDesktopCodePatch();
      setCodeCheck(result);
      if (result.ok && settings.soundEnabled) playBeep('success');
      if (!result.ok && settings.soundEnabled) playBeep('error');
    } catch {
      setCodeCheck({
        ok: false,
        desktop: isAlexDesktop(),
        kind: 'patch',
        hasUpdate: false,
        error: 'Не удалось проверить патч интерфейса',
      });
      if (settings.soundEnabled) playBeep('error');
    } finally {
      setIsCheckingCode(false);
    }
  };

  const handleInstallPatch = async () => {
    setIsInstallingPatch(true);
    setCodeDlPercent(0);
    setStatusMessage(null);
    try {
      const result = await installDesktopCodePatch((p) => setCodeDlPercent(p.percent));
      if (result.ok) {
        setStatusMessage({
          text: 'Патч установлен. Интерфейс перезагружается — exe не заменяется.',
          type: 'success',
        });
        setCodeCheck((prev) => (prev ? { ...prev, hasUpdate: false } : prev));
        if (settings.soundEnabled) playBeep('success');
      } else {
        setStatusMessage({ text: result.error || 'Не удалось установить патч', type: 'error' });
        if (settings.soundEnabled) playBeep('error');
      }
    } catch {
      setStatusMessage({ text: 'Сбой установки патча', type: 'error' });
      if (settings.soundEnabled) playBeep('error');
    } finally {
      setIsInstallingPatch(false);
    }
  };

  const handleCheckKernel = async () => {
    setIsCheckingKernel(true);
    setKernelReadyToApply(false);
    setKernelDlPercent(0);
    setStatusMessage(null);
    try {
      const result = await checkDesktopCodeUpdate();
      setKernelCheck(result);
      if (result.ok && settings.soundEnabled) playBeep('success');
      if (!result.ok && settings.soundEnabled) playBeep('error');
    } catch {
      setKernelCheck({
        ok: false,
        desktop: isAlexDesktop(),
        kind: 'exe',
        hasUpdate: false,
        error: 'Не удалось проверить ядро Electron',
      });
      if (settings.soundEnabled) playBeep('error');
    } finally {
      setIsCheckingKernel(false);
    }
  };

  const handleDownloadCode = async () => {
    setIsDownloadingKernel(true);
    setKernelDlPercent(0);
    setKernelReadyToApply(false);
    setStatusMessage(null);
    try {
      const result = await downloadDesktopCodeUpdate((p) => setKernelDlPercent(p.percent));
      if (result.ok) {
        setKernelReadyToApply(true);
        setStatusMessage({
          text: 'Exe ядра скачан и проверен. Нажмите «Установить и перезапустить». Нужен только если менялся Electron, не окна.',
          type: 'success',
        });
        if (settings.soundEnabled) playBeep('success');
      } else {
        setStatusMessage({ text: result.error || 'Не удалось скачать exe', type: 'error' });
        if (settings.soundEnabled) playBeep('error');
      }
    } catch {
      setStatusMessage({ text: 'Сбой загрузки exe', type: 'error' });
      if (settings.soundEnabled) playBeep('error');
    } finally {
      setIsDownloadingKernel(false);
    }
  };

  const handleApplyCode = async () => {
    setIsApplyingKernel(true);
    try {
      const result = await applyDesktopCodeUpdate();
      if (!result.ok) {
        setStatusMessage({ text: result.error || 'Не удалось запустить установщик', type: 'error' });
        if (settings.soundEnabled) playBeep('error');
      }
    } catch {
      setStatusMessage({ text: 'Сбой установки программы', type: 'error' });
      if (settings.soundEnabled) playBeep('error');
    } finally {
      setIsApplyingKernel(false);
    }
  };

  // Handler: File Upload Drag & Drop
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setPatchError(null);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const validation = validatePatchJson(content);
      if (validation.valid && validation.patch) {
        setUploadedPatch(validation.patch);
        if (settings.soundEnabled) playBeep('success');
      } else {
        setUploadedPatch(null);
        setPatchError(validation.error || 'Неверный формат файла патча. Требуется .alex-patch или .json');
        if (settings.soundEnabled) playBeep('error');
      }
    };
    reader.onerror = () => {
      setPatchError('Ошибка чтения файла');
      if (settings.soundEnabled) playBeep('error');
    };
    reader.readAsText(file);
  };

  // Handler: Apply File Patch
  const handleApplyUploadedPatch = (patchToApply?: AlexPatchPackage) => {
    const target = patchToApply || uploadedPatch;
    if (!target) return;

    setIsApplyingPatch(true);
    try {
      const res = applyAlexPatch(target, recipes, settings, currentRecipeId);
      if (res.success) {
        onUpdateState(res.updatedRecipes, res.updatedSettings);
        setStatusMessage({
          text: `Патч «${target.title}» (v${target.version}) успешно наложен! Рецептур добавлено: ${res.summary.recipesAdded}, обновлено: ${res.summary.recipesUpdated}.`,
          type: 'success',
        });
        if (settings.soundEnabled) playBeep('success');
      } else {
        setStatusMessage({ text: res.error || 'Ошибка применения патча', type: 'error' });
        if (settings.soundEnabled) playBeep('error');
      }
    } catch {
      setStatusMessage({ text: 'Сбой при наложении патча', type: 'error' });
      if (settings.soundEnabled) playBeep('error');
    } finally {
      setIsApplyingPatch(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white dark:bg-[#15171C] border border-[#E5E5E0] dark:border-[#26282E] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#111215] dark:text-white transition-colors">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E5E0] dark:border-[#26282E] flex items-center justify-between gap-3 bg-[#FBFBFA] dark:bg-[#181A20]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center shadow-xs shrink-0">
              <RefreshCw className="w-5 h-5 text-[#E63B00]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Обновление пульта «АЛЕКС»
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#F0F0EB] dark:bg-[#252830] text-[#5E6472] dark:text-[#8E95A5] font-mono text-xs font-bold border border-[#E0E0D9] dark:border-[#2D3039]">
                  v{getEffectiveAppVersion()}
                </span>
              </div>
              <p className="text-xs text-[#717684] dark:text-[#8E95A5] mt-0.5">
                Выберите способ обновления: прямое по сети (SSL/HTTPS) или локальный файл (.alex-patch)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="btn-close-update-modal"
            className="p-2 rounded-xl hover:bg-[#EBEBE6] dark:hover:bg-[#252830] text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Banner */}
        {statusMessage && (
          <div className={`px-5 py-3 text-xs font-semibold flex items-center justify-between border-b ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50' 
              : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/50'
          }`}>
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3 Tabs */}
        <div className="px-4 sm:px-6 pt-3 border-b border-[#E5E5E0] dark:border-[#26282E] flex gap-3 bg-white dark:bg-[#15171C] overflow-x-auto">
          <button
            onClick={() => setActiveTab('code')}
            id="tab-btn-update-code"
            className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'code'
                ? 'border-[#E63B00] text-[#E63B00]'
                : 'border-transparent text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>1. Патч программы</span>
          </button>

          <button
            onClick={() => setActiveTab('network')}
            id="tab-btn-update-network"
            className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'network'
                ? 'border-[#E63B00] text-[#E63B00]'
                : 'border-transparent text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>2. Рецептуры (JSON)</span>
          </button>

          <button
            onClick={() => setActiveTab('file')}
            id="tab-btn-update-file"
            className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'file'
                ? 'border-[#E63B00] text-[#E63B00]'
                : 'border-transparent text-[#717684] dark:text-[#8E95A5] hover:text-[#111215] dark:hover:text-white'
            }`}
          >
            <FileUp className="w-4 h-4" />
            <span>3. Файл патча</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {activeTab === 'code' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#111215] to-[#1A1C22] text-white border border-[#2D3039] shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-orange-400 block">
                        Точечный патч интерфейса
                      </span>
                      <p className="text-xs text-[#A0A6B5] mt-0.5 max-w-xl">
                        Пульт сам сравнивает себя с GitHub и при отличии качает интерфейс (~1–2 МБ), не exe. Проверка начинается при открытии этого окна.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCheckCode}
                    disabled={isCheckingCode || isInstallingPatch}
                    className="px-4 py-2 rounded-xl bg-[#E63B00] hover:bg-[#CC3400] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCheckingCode ? 'animate-spin' : ''}`} />
                    <span>{isCheckingCode ? 'Проверка…' : 'Проверить патч'}</span>
                  </button>
                </div>
              </div>

              {!isAlexDesktop() && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <span>Сейчас открыт браузерный предпросмотр. Патч интерфейса ставится только в exe (Start_ALEX.bat).</span>
                </div>
              )}

              {codeCheck && !codeCheck.ok && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 text-xs sm:text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Патч на GitHub ещё не опубликован или сеть недоступна</span>
                    <span>{codeCheck.error}</span>
                  </div>
                </div>
              )}

              {codeCheck?.ok && !codeCheck.hasUpdate && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm space-y-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Интерфейс совпадает с патчем GitHub</span>
                      <span className="font-mono">
                        {codeCheck.remoteSha ? codeCheck.remoteSha.slice(0, 12) : '—'}
                        {codeCheck.fileCount != null ? ` • ${codeCheck.fileCount} файл(ов)` : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleInstallPatch}
                    disabled={isInstallingPatch}
                    className="px-4 py-2 rounded-xl bg-[#111215] dark:bg-white text-white dark:text-[#111215] text-xs font-bold disabled:opacity-50"
                  >
                    {isInstallingPatch ? `Загрузка ${codeDlPercent}%` : 'Скачать интерфейс с GitHub заново'}
                  </button>
                </div>
              )}

              {codeCheck?.ok && codeCheck.hasUpdate && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#FBFBFA] to-[#F1F1EB] dark:from-[#1A1C22] dark:to-[#14161B] border-2 border-orange-500/40 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#E63B00] text-white">
                        Нужно скачать интерфейс
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-[#111215] dark:text-white mt-1">
                        {codeCheck.title || 'Обновление интерфейса'}
                      </h3>
                      <p className="text-xs text-[#717684] dark:text-[#8E95A5] mt-1">
                        Сейчас: {codeCheck.currentSha ? codeCheck.currentSha.slice(0, 10) : '—'}
                        {' → GitHub: '}
                        {codeCheck.remoteSha ? codeCheck.remoteSha.slice(0, 10) : '—'}
                        {codeCheck.sizeBytes ? ` • ${formatBytes(codeCheck.sizeBytes)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={handleInstallPatch}
                      disabled={isInstallingPatch}
                      className="px-4 py-2.5 rounded-xl bg-[#111215] dark:bg-white text-white dark:text-[#111215] text-xs sm:text-sm font-black flex items-center gap-2 disabled:opacity-50"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      <span>{isInstallingPatch ? `Загрузка ${codeDlPercent}%` : 'Скачать интерфейс с GitHub'}</span>
                    </button>
                  </div>
                  {isInstallingPatch && (
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-[#E63B00] transition-all" style={{ width: `${codeDlPercent}%` }} />
                    </div>
                  )}
                </div>
              )}

              <details className="rounded-xl border border-[#E5E5E0] dark:border-[#26282E] bg-white dark:bg-[#15171C] p-4">
                <summary className="cursor-pointer text-xs sm:text-sm font-bold text-[#717684] dark:text-[#8E95A5]">
                  Ядро Electron (полный exe ~80 МБ) — только если менялся сам Electron
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-[#717684] dark:text-[#8E95A5]">
                    Для новых окон и десятка слов в интерфейсе это не нужно. Качает весь portable exe и перезапускает процесс.
                  </p>
                  <button
                    onClick={handleCheckKernel}
                    disabled={isCheckingKernel || isDownloadingKernel || isApplyingKernel}
                    className="px-3 py-1.5 rounded-lg bg-[#111215] dark:bg-[#2D3039] text-white text-xs font-bold disabled:opacity-50"
                  >
                    {isCheckingKernel ? 'Проверка ядра…' : 'Проверить ядро'}
                  </button>
                  {kernelCheck && !kernelCheck.ok && (
                    <p className="text-xs text-red-600">{kernelCheck.error}</p>
                  )}
                  {kernelCheck?.ok && !kernelCheck.hasUpdate && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-mono">
                      Ядро совпадает {kernelCheck.currentSha ? kernelCheck.currentSha.slice(0, 12) : ''}
                    </p>
                  )}
                  {kernelCheck?.ok && kernelCheck.hasUpdate && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-mono text-[#717684]">
                        {formatBytes(kernelCheck.sizeBytes)} · {kernelCheck.remoteSha?.slice(0, 10)}
                      </span>
                      <button
                        onClick={handleDownloadCode}
                        disabled={isDownloadingKernel || isApplyingKernel}
                        className="px-3 py-1.5 rounded-lg bg-[#111215] text-white text-xs font-bold disabled:opacity-50"
                      >
                        {isDownloadingKernel ? `${kernelDlPercent}%` : 'Скачать exe'}
                      </button>
                      <button
                        onClick={handleApplyCode}
                        disabled={!kernelReadyToApply || isApplyingKernel}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {isApplyingKernel ? 'Перезапуск…' : 'Установить и перезапустить'}
                      </button>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* TAB 1: Network / SSL Update */}
          {activeTab === 'network' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* SSL Channel Indicator */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#111215] to-[#1A1C22] text-white border border-[#2D3039] shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                          Защищенный SSL/HTTPS протокол связи (TLS 1.3)
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {isSslVerified ? 'Verified SSL' : 'HTTP'}
                        </span>
                      </div>
                      <div className="text-xs text-[#A0A6B5] font-mono mt-0.5 flex flex-wrap items-center gap-2">
                        <span>Сервер: <strong className="text-white">{serverUrl.replace(/\/update-manifest\.json.*$/, '')}</strong></span>
                        {networkLatency !== null && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400">Пинг: {networkLatency} мс</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCheckNetwork}
                      disabled={isCheckingNetwork}
                      id="btn-check-ssl-updates"
                      className="px-4 py-2 rounded-xl bg-[#E63B00] hover:bg-[#CC3400] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isCheckingNetwork ? 'animate-spin' : ''}`} />
                      <span>{isCheckingNetwork ? 'Проверка соединения...' : 'Проверить обновление по сети'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Server URL Config Strip */}
              <div className="p-3.5 rounded-xl bg-[#F8F8F5] dark:bg-[#1A1C22] border border-[#E5E5E0] dark:border-[#26282E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-[#5E6472] dark:text-[#8E95A5]" />
                  <span className="text-[#5E6472] dark:text-[#8E95A5]">Адрес манифеста сервера:</span>
                  <strong className="font-mono text-[#111215] dark:text-white truncate max-w-sm">{serverUrl}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingServerUrl(!isEditingServerUrl)}
                    className="px-2.5 py-1 rounded-lg bg-[#EFEFEA] hover:bg-[#E4E4DE] dark:bg-[#252830] dark:hover:bg-[#2F323D] text-[11px] font-semibold text-[#5E6472] dark:text-[#8E95A5] transition"
                  >
                    {isEditingServerUrl ? 'Скрыть URL' : 'Изменить URL'}
                  </button>
                </div>
              </div>

              {/* Edit URL Form */}
              {isEditingServerUrl && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    Укажите прямой HTTPS URL манифеста обновлений:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="https://raw.githubusercontent.com/BogdanKuklenko/ais-dev/main/public/update-manifest.json"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#15171C] border border-[#CBD5E1] dark:border-[#334155] font-mono text-xs text-[#111215] dark:text-white"
                    />
                    <button
                      onClick={() => {
                        saveStoredUpdateServerUrl(serverUrl);
                        setIsEditingServerUrl(false);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#111215] dark:bg-white text-white dark:text-[#111215] font-bold"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              )}

              {networkWarning && networkManifest && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {updateSource === 'bundled' ? 'Облачный SSL-сервер недоступен' : 'Предупреждение канала обновления'}
                    </span>
                    <span>{networkWarning} Показан заводской пакет из программы — его можно применить как полный патч. Когда сервер начнёт отдавать манифест по HTTPS, проверка пойдёт по SSL.</span>
                  </div>
                </div>
              )}

              {/* Network Check Error */}
              {networkCheckError && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 text-xs sm:text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Связь с сервером не установлена:</span>
                    <span>{networkCheckError}</span>
                  </div>
                </div>
              )}

              {networkManifest && networkHasUpdate === false && updateSource === 'remote' && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Этот пакет уже установлен (v{getEffectiveAppVersion()})</span>
                    <span>
                      Канал SSL подтягивает только рецептуры и параметры из <span className="font-mono">update-manifest.json</span>.
                      Правки кода на GitHub (интерфейс, шрифты, новые окна) в уже установленный exe не приезжают — нужна пересборка программы.
                      Чтобы снова появилась кнопка обновления рецептур, в манифесте смените <span className="font-mono">latestVersion</span> и <span className="font-mono">patchId</span>.
                    </span>
                  </div>
                </div>
              )}

              {/* Network Update Available Card */}
              {networkManifest && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#FBFBFA] to-[#F1F1EB] dark:from-[#1A1C22] dark:to-[#14161B] border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-lg font-mono">
                        v{networkManifest.latestVersion}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                            Официальный релиз завода
                          </span>
                          <span className="text-xs text-[#717684] dark:text-[#8E95A5] font-mono">
                            Дата: {networkManifest.releaseDate} • {networkManifest.serverProtocol || 'HTTPS'}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-[#111215] dark:text-white mt-1">
                          {networkManifest.title}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={handleInstallNetworkUpdate}
                      disabled={isInstallingNetwork}
                      id="btn-install-network-update"
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-xs transition disabled:opacity-50"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      <span>{isInstallingNetwork ? `Установка... ${installProgress}%` : (networkHasUpdate === false ? 'Повторно наложить тот же пакет' : 'Загрузить и применить обновление')}</span>
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                    {networkManifest.description}
                  </p>

                  {/* Changelog list */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#121316] border border-[#E5E5E0] dark:border-[#26282E] space-y-2">
                    <span className="text-xs font-bold text-[#717684] dark:text-[#8E95A5] uppercase block">
                      Состав пакета и изменения:
                    </span>
                    <ul className="space-y-1.5 text-xs text-[#111215] dark:text-slate-200">
                      {networkManifest.changelog.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Progress Bar during install */}
                  {isInstallingNetwork && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono font-bold text-emerald-600">
                        <span>Загрузка данных и проверка SHA-256...</span>
                        <span>{installProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-600 transition-all duration-300" 
                          style={{ width: `${installProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Initial hint if no check was performed yet */}
              {!networkManifest && !networkCheckError && !isCheckingNetwork && (
                <div className="p-6 text-center bg-[#F8F8F5] dark:bg-[#1A1C22] rounded-2xl border border-[#E5E5E0] dark:border-[#26282E] space-y-2">
                  <ShieldCheck className="w-8 h-8 mx-auto text-emerald-600" />
                  <h4 className="font-bold text-sm text-[#111215] dark:text-white">
                    Прямая синхронизация с облачным сервером по SSL
                  </h4>
                  <p className="text-xs text-[#717684] dark:text-[#8E95A5] max-w-md mx-auto">
                    Нажмите кнопку «Проверить обновление по сети», чтобы запросить актуальный релиз с сервера и безопасно обновить рецептуры и параметры без потери текущей смены.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: File Patch Update (.alex-patch / .json) */}
          {activeTab === 'file' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  dragActive 
                    ? 'border-[#E63B00] bg-[#E63B00]/5' 
                    : 'border-[#CBD5E1] dark:border-[#334155] hover:border-[#E63B00] bg-[#FBFBFA] dark:bg-[#181A20]'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".alex-patch,.patch,.json"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-[#EFEFEA] dark:bg-[#252830] text-[#E63B00] flex items-center justify-center shadow-inner">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-[#111215] dark:text-white">
                    Перетащите файл патча (.alex-patch, .patch или .json) сюда
                  </h4>
                  <p className="text-xs text-[#717684] dark:text-[#8E95A5] mt-1">
                    или нажмите для выбора с диска / флеш-накопителя
                  </p>
                </div>
              </div>

              {/* Error box */}
              {patchError && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 text-xs sm:text-sm flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{patchError}</span>
                </div>
              )}

              {/* Ready Packages Catalog */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#717684] dark:text-[#8E95A5] uppercase">
                    Заводские пакеты в каталоге:
                  </span>
                  <span className="text-[11px] text-[#717684] dark:text-[#8E95A5]">
                    Нажмите для мгновенного наложения
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SAMPLE_PATCHES.map((sample) => (
                    <div 
                      key={sample.patchId}
                      className="p-3.5 rounded-xl bg-[#F8F8F5] dark:bg-[#1A1C22] border border-[#E5E5E0] dark:border-[#26282E] flex flex-col justify-between gap-2.5 hover:border-slate-400 dark:hover:border-slate-600 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#111215] text-white dark:bg-white dark:text-[#111215]">
                            v{sample.version}
                          </span>
                          <span className="text-[10px] text-[#717684] dark:text-[#8E95A5]">
                            {sample.releaseDate}
                          </span>
                        </div>
                        <h5 className="font-bold text-xs sm:text-sm text-[#111215] dark:text-white mt-1.5 line-clamp-1">
                          {sample.title}
                        </h5>
                        <p className="text-[11px] text-[#5E6472] dark:text-[#8E95A5] mt-1 line-clamp-2">
                          {sample.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E0] dark:border-[#26282E]">
                        <span className="text-[10px] font-mono text-[#717684]">
                          {sample.payload.recipesToAddOrUpdate?.length || 0} рецептур
                        </span>
                        <button
                          onClick={() => {
                            setUploadedPatch(sample);
                            handleApplyUploadedPatch(sample);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1"
                        >
                          <span>Применить</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Uploaded Patch Diff & Inspection Card */}
              {uploadedPatch && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#15171C] border-2 border-[#111215] dark:border-white shadow-xl space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E5E5E0] dark:border-[#26282E]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#111215] dark:bg-white text-white dark:text-[#111215] flex items-center justify-center font-bold">
                        <FileCheck className="w-5 h-5 text-[#E63B00]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#F0F0EB] dark:bg-[#252830]">
                            v{uploadedPatch.version}
                          </span>
                          <span className="text-xs text-[#717684] dark:text-[#8E95A5]">
                            Автор: <strong>{uploadedPatch.author}</strong>
                          </span>
                        </div>
                        <h3 className="text-base font-black text-[#111215] dark:text-white mt-0.5">
                          {uploadedPatch.title}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApplyUploadedPatch()}
                      disabled={isApplyingPatch}
                      id="btn-apply-uploaded-patch"
                      className="px-5 py-2.5 rounded-xl bg-[#111215] hover:bg-[#272A33] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#111215] text-xs sm:text-sm font-black flex items-center gap-2 shadow transition disabled:opacity-50"
                    >
                      <Check className="w-4 h-4 text-[#E63B00]" />
                      <span>{isApplyingPatch ? 'Применение...' : 'Применить файл к системе'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-[#5E6472] dark:text-[#8E95A5]">
                    {uploadedPatch.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#F8F8F5] dark:bg-[#1A1C22] border border-[#E5E5E0] dark:border-[#26282E]">
                      <span className="font-bold text-[#717684] dark:text-[#8E95A5] block uppercase mb-1.5">
                        Рецептуры в составе патча ({uploadedPatch.payload.recipesToAddOrUpdate?.length || 0}):
                      </span>
                      <ul className="space-y-1 font-mono">
                        {uploadedPatch.payload.recipesToAddOrUpdate?.map((r) => (
                          <li key={r.code} className="flex justify-between items-center text-slate-800 dark:text-slate-200">
                            <strong>{r.code} ({r.name.slice(0, 18)})</strong>
                            <span className="text-[10px] text-slate-500">{r.components.length} комп. / {r.targetTotalWeightKg} кг</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F8F8F5] dark:bg-[#1A1C22] border border-[#E5E5E0] dark:border-[#26282E] flex flex-col justify-between">
                      <div>
                        <span className="font-bold text-[#717684] dark:text-[#8E95A5] block uppercase mb-1.5">
                          Контрольная сумма пакета:
                        </span>
                        <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">
                          Checksum: {uploadedPatch.checksum || calculateChecksum(uploadedPatch.payload)}
                        </div>
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-2 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Безопасная валидация структуры данных</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#E5E5E0] dark:border-[#26282E] bg-[#FBFBFA] dark:bg-[#181A20] flex items-center justify-between text-xs text-[#717684] dark:text-[#8E95A5]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Текущая версия программы: <strong className="font-mono text-[#111215] dark:text-white">v{getEffectiveAppVersion()}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#EFEFEA] hover:bg-[#E4E4DE] dark:bg-[#252830] dark:hover:bg-[#2F323D] text-[#111215] dark:text-white font-bold transition"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
