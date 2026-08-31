import type { CodeUpdateCheckResult, CodeUpdateProgress } from '../electron-api';

export function isAlexDesktop(): boolean {
  return Boolean(window.alexDesktop?.isDesktop);
}

export async function checkDesktopCodeUpdate(): Promise<CodeUpdateCheckResult> {
  if (!window.alexDesktop) {
    return {
      ok: false,
      desktop: false,
      hasUpdate: false,
      error: 'Полное обновление кода доступно только в установленном exe, не в браузере.',
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
