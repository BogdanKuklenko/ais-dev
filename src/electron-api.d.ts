export interface AlexBuildInfo {
  gitSha: string;
  version: string;
  builtAt: string;
  channel: string;
}

export interface CodeUpdateProgress {
  received: number;
  total: number;
  percent: number;
}

export interface CodeUpdateCheckResult {
  ok: boolean;
  desktop: boolean;
  hasUpdate: boolean;
  currentSha?: string;
  remoteSha?: string;
  version?: string;
  sizeBytes?: number;
  builtAt?: string;
  title?: string;
  error?: string;
}

export interface CodeUpdateActionResult {
  ok: boolean;
  error?: string;
}

export interface AlexDesktopApi {
  isDesktop: true;
  getBuildInfo: () => Promise<AlexBuildInfo>;
  checkCodeUpdate: () => Promise<CodeUpdateCheckResult>;
  downloadCodeUpdate: () => Promise<CodeUpdateActionResult>;
  applyCodeUpdate: () => Promise<CodeUpdateActionResult>;
  onDownloadProgress: (cb: (p: CodeUpdateProgress) => void) => () => void;
}

declare global {
  interface Window {
    alexDesktop?: AlexDesktopApi;
  }
}

export {};
