import type { CodeUpdateCheckResult, CodeUpdateProgress } from '../electron-api';

export function isAlexDesktop(): boolean {
  return Boolean(window.alexDesktop?.isDesktop);
}

export async function checkDesktopCodePatch(): Promise<CodeUpdateCheckResult> {
  if (!window.alexDesktop?.checkCodePatch) {
    return {
      ok: false,
      desktop: false,
      kind: 'patch',
      hasUpdate: false,
      error: 'Патч интерфейса доступен только в установленном exe, не в браузере.',
    };
  }
  return window.alexDesktop.checkCodePatch();
}

export async function installDesktopCodePatch(
  onProgress?: (p: CodeUpdateProgress) => void
): Promise<{ ok: boolean; error?: string }> {
  if (!window.alexDesktop?.installCodePatch) {
    return { ok: false, error: 'Нет desktop API' };
  }
  const stop = onProgress ? window.alexDesktop.onDownloadProgress(onProgress) : () => undefined;
  try {
    return await window.alexDesktop.installCodePatch();
  } finally {
    stop();
  }
}

export async function checkDesktopCodeUpdate(): Promise<CodeUpdateCheckResult> {
  if (!window.alexDesktop) {
    return {
      ok: false,
      desktop: false,
      kind: 'exe',
      hasUpdate: false,
      error: 'Обновление ядра Electron доступно только в установленном exe, не в браузере.',
    };
  }
  return window.alexDesktop.checkCodeUpdate();
}

export async function downloadDesktopCodeUpdate(
  onProgress?: (p: CodeUpdateProgress) => void
): Promise<{ ok: boolean; error?: string }> {
  if (!window.alexDesktop) {
    return { ok: false, error: 'Нет desktop API' };
  }
  const stop = onProgress ? window.alexDesktop.onDownloadProgress(onProgress) : () => undefined;
  try {
    return await window.alexDesktop.downloadCodeUpdate();
  } finally {
    stop();
  }
}

export async function applyDesktopCodeUpdate(): Promise<{ ok: boolean; error?: string }> {
  if (!window.alexDesktop) {
    return { ok: false, error: 'Нет desktop API' };
  }
  return window.alexDesktop.applyCodeUpdate();
}

export function formatBytes(n?: number): string {
  if (n == null || !Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${Math.round(n)} Б`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}
