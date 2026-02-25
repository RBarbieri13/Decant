// ============================================================
// Extension Settings (chrome.storage)
// ============================================================

export type ConnectionTarget = 'local' | 'live';

export interface ExtensionSettings {
  target: ConnectionTarget;
  liveBaseUrl: string;
  accessToken: string;
}

const DEFAULTS: ExtensionSettings = {
  target: 'local',
  liveBaseUrl: '',
  accessToken: '',
};

function storageGet<T extends object>(defaults: T): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaults, (items) => resolve(items as T));
  });
}

function storageSet(items: Partial<ExtensionSettings>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(items, () => resolve());
  });
}

export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export async function getExtensionSettings(): Promise<ExtensionSettings> {
  const s = await storageGet(DEFAULTS);
  return {
    target: s.target === 'live' ? 'live' : 'local',
    liveBaseUrl: normalizeBaseUrl(s.liveBaseUrl || ''),
    accessToken: (s.accessToken || '').trim(),
  };
}

export async function setExtensionSettings(next: Partial<ExtensionSettings>): Promise<void> {
  const normalized: Partial<ExtensionSettings> = { ...next };
  if (typeof normalized.liveBaseUrl === 'string') {
    normalized.liveBaseUrl = normalizeBaseUrl(normalized.liveBaseUrl);
  }
  if (typeof normalized.accessToken === 'string') {
    normalized.accessToken = normalized.accessToken.trim();
  }
  await storageSet(normalized);
}

export function getActiveApiBase(settings: ExtensionSettings): string {
  return settings.target === 'live'
    ? settings.liveBaseUrl
    : 'http://localhost:3000';
}
