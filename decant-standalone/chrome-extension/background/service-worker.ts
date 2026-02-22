// ============================================================
// Background Service Worker
// Handles keyboard shortcut for quick single-tab add
// ============================================================

import { importUrl, checkConnection } from '../services/decant-api.js';

// ============================================================
// Filtered URL prefixes — these cannot be imported
// ============================================================

const FILTERED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'about:',
  'edge://',
  'brave://',
  'vivaldi://',
  'opera://',
  'moz-extension://',
  'devtools://',
  'view-source:',
  'data:',
  'blob:',
  'javascript:',
  'file://',
];

export function isFilteredUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return FILTERED_PREFIXES.some(prefix => lower.startsWith(prefix));
}

// ============================================================
// Keyboard shortcut: Cmd/Ctrl+Shift+D
// ============================================================

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'quick-add-current') return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      setBadgeError('No active tab found');
      return;
    }

    if (isFilteredUrl(tab.url)) {
      setBadgeError('Page cannot be imported');
      return;
    }

    const connection = await checkConnection();
    if (!connection.connected) {
      setBadgeError('Decant not running');
      return;
    }

    setBadgeLoading();

    const result = await importUrl(
      tab.url,
      tab.title || undefined,
      tab.favIconUrl || undefined
    );

    if (result.success) {
      setBadgeSuccess();
    } else {
      setBadgeError(result.error || 'Import failed');
    }
  } catch (error: unknown) {
    setBadgeError(error instanceof Error ? error.message : 'Error');
  }
});

// ============================================================
// Badge helpers
// ============================================================

function setBadgeSuccess(): void {
  chrome.action.setBadgeText({ text: '✓' });
  chrome.action.setBadgeBackgroundColor({ color: '#27AE60' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
}

function setBadgeLoading(): void {
  chrome.action.setBadgeText({ text: '…' });
  chrome.action.setBadgeBackgroundColor({ color: '#8B9A7D' });
}

function setBadgeError(message: string): void {
  console.warn('[Decant Extension]', message);
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#E74C3C' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
}
