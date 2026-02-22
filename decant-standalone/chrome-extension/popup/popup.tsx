// ============================================================
// DecantPopup — Main popup component
// Tab checklist with select all/none/this-page, import button
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserTab, ConnectionState, TabImportStatus, SelectionMode } from '../types/index.js';
import { checkConnection, batchImport, importUrl } from '../services/decant-api.js';
import { isFilteredUrl } from '../background/service-worker.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { TabListItem } from './TabListItem.js';
import './popup.css';

// ============================================================
// Helpers
// ============================================================

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ============================================================
// Main Component
// ============================================================

export function DecantPopup() {
  const [connection, setConnection] = useState<ConnectionState>({
    connected: false,
    checking: true,
  });
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  // ----------------------------------------
  // Computed
  // ----------------------------------------

  const importableTabs = useMemo(
    () => tabs.filter(t => t.status !== 'filtered' && t.status !== 'duplicate'),
    [tabs]
  );

  const selectedTabs = useMemo(
    () => importableTabs.filter(t => t.selected),
    [importableTabs]
  );

  const selectedCount = selectedTabs.length;
  const totalImportable = importableTabs.length;
  const totalTabs = tabs.length;

  // ----------------------------------------
  // Initialize
  // ----------------------------------------

  useEffect(() => {
    initializePopup();
  }, []);

  const initializePopup = useCallback(async () => {
    const conn = await checkConnection();
    setConnection(conn);

    const chromeTabs = await chrome.tabs.query({ currentWindow: true });

    const browserTabs: BrowserTab[] = chromeTabs
      .filter(tab => tab.id !== undefined && tab.url !== undefined)
      .map(tab => ({
        id: tab.id!,
        url: tab.url!,
        title: tab.title || '',
        favIconUrl: tab.favIconUrl || '',
        domain: extractDomain(tab.url!),
        selected: !isFilteredUrl(tab.url!),
        status: isFilteredUrl(tab.url!)
          ? ('filtered' as TabImportStatus)
          : ('idle' as TabImportStatus),
      }));

    setTabs(browserTabs);
  }, []);

  // ----------------------------------------
  // Selection handlers
  // ----------------------------------------

  const handleToggleTab = useCallback((tabId: number) => {
    setTabs(prev =>
      prev.map(tab =>
        tab.id === tabId ? { ...tab, selected: !tab.selected } : tab
      )
    );
  }, []);

  const handleSelectMode = useCallback((mode: SelectionMode) => {
    if (mode === 'current') {
      // Select only the currently active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
        const activeTabId = activeTabs[0]?.id;
        setTabs(prev =>
          prev.map(tab => {
            if (tab.status === 'filtered' || tab.status === 'duplicate') return tab;
            return { ...tab, selected: tab.id === activeTabId };
          })
        );
      });
      return;
    }

    setTabs(prev =>
      prev.map(tab => {
        if (tab.status === 'filtered' || tab.status === 'duplicate') return tab;
        return { ...tab, selected: mode === 'all' };
      })
    );
  }, []);

  // ----------------------------------------
  // Import handler
  // ----------------------------------------

  const handleImport = useCallback(async () => {
    if (selectedCount === 0 || !connection.connected) return;

    setIsImporting(true);

    // Mark selected as importing
    setTabs(prev =>
      prev.map(tab =>
        tab.selected && tab.status === 'idle'
          ? { ...tab, status: 'importing' as TabImportStatus }
          : tab
      )
    );

    try {
      if (selectedTabs.length === 1) {
        // Single tab: use single import for better classification feedback
        const tab = selectedTabs[0];
        const result = await importUrl(tab.url, tab.title, tab.favIconUrl);

        setTabs(prev =>
          prev.map(t =>
            t.id === tab.id
              ? {
                  ...t,
                  status: result.success
                    ? ('success' as TabImportStatus)
                    : ('failed' as TabImportStatus),
                  error: result.success ? undefined : result.error,
                }
              : t
          )
        );

        if (result.success) setImportComplete(true);
      } else {
        // Multiple tabs: use batch import
        const result = await batchImport(selectedTabs, skipDuplicates);

        if (result.success) {
          setTabs(prev =>
            prev.map(tab =>
              tab.status === 'importing'
                ? { ...tab, status: 'success' as TabImportStatus }
                : tab
            )
          );
          setImportComplete(true);
        } else {
          setTabs(prev =>
            prev.map(tab =>
              tab.status === 'importing'
                ? { ...tab, status: 'failed' as TabImportStatus, error: result.error }
                : tab
            )
          );
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setTabs(prev =>
        prev.map(tab =>
          tab.status === 'importing'
            ? { ...tab, status: 'failed' as TabImportStatus, error: msg }
            : tab
        )
      );
    } finally {
      setIsImporting(false);
    }
  }, [selectedTabs, selectedCount, connection.connected, skipDuplicates]);

  // ----------------------------------------
  // Retry connection
  // ----------------------------------------

  const handleRetryConnection = useCallback(async () => {
    setConnection({ connected: false, checking: true });
    const conn = await checkConnection();
    setConnection(conn);
  }, []);

  // ----------------------------------------
  // Disconnected state
  // ----------------------------------------

  if (!connection.checking && !connection.connected) {
    return (
      <div className="ext-popup">
        <div className="ext-header">
          <div className="ext-header-left">
            <span className="ext-logo-text">⚗</span>
            <span className="ext-header-title">Decant</span>
          </div>
          <ConnectionStatus connection={connection} onRetry={handleRetryConnection} />
        </div>
        <div className="ext-separator" />
        <div className="ext-disconnected">
          <div className="ext-disconnected-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C0C0BC" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M8.46 15.54A6 6 0 1115.54 8.46" strokeLinecap="round" />
              <path d="M12 8v4l2 2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="ext-disconnected-title">Decant is not running</p>
          <p className="ext-disconnected-text">
            Open the Decant app and start the server, then try again.
          </p>
          <button className="ext-disconnected-retry" onClick={handleRetryConnection}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // Main popup
  // ----------------------------------------

  let buttonLabel = `Import Selected (${selectedCount})`;
  if (isImporting) buttonLabel = 'Importing...';
  if (importComplete) buttonLabel = `✓ Imported ${selectedCount}`;

  return (
    <div className="ext-popup">
      {/* HEADER */}
      <div className="ext-header">
        <div className="ext-header-left">
          <span className="ext-logo-text">⚗</span>
          <span className="ext-header-title">Decant</span>
          <span className="ext-tab-count">{totalTabs} tabs</span>
        </div>
        <ConnectionStatus connection={connection} onRetry={handleRetryConnection} />
      </div>

      <div className="ext-separator" />

      {/* SELECTION TOOLBAR */}
      <div className="ext-toolbar">
        <div className="ext-toolbar-select">
          <span className="ext-toolbar-label">Select:</span>
          <button
            className="ext-toolbar-link"
            onClick={() => handleSelectMode('all')}
            disabled={isImporting}
          >
            All
          </button>
          <span className="ext-toolbar-divider">|</span>
          <button
            className="ext-toolbar-link"
            onClick={() => handleSelectMode('none')}
            disabled={isImporting}
          >
            None
          </button>
          <span className="ext-toolbar-divider">|</span>
          <button
            className="ext-toolbar-link"
            onClick={() => handleSelectMode('current')}
            disabled={isImporting}
          >
            This Page
          </button>
        </div>
        <div className="ext-toolbar-filter" title="Filter options (coming soon)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        </div>
      </div>

      {/* TAB LIST */}
      <div className="ext-tab-list">
        {connection.checking ? (
          <div className="ext-loading">Loading tabs...</div>
        ) : (
          tabs.map(tab => (
            <TabListItem
              key={tab.id}
              tab={tab}
              onToggle={handleToggleTab}
              disabled={isImporting || importComplete}
            />
          ))
        )}
      </div>

      {/* SUMMARY BAR */}
      <div className="ext-summary">
        <span className="ext-summary-count">
          {selectedCount} of {totalImportable} tabs selected
        </span>
        <label className="ext-summary-option">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
            disabled={isImporting}
          />
          <span>Skip duplicates</span>
        </label>
      </div>

      {/* FOOTER / IMPORT BUTTON */}
      <div className="ext-footer">
        <button
          className={`ext-import-button${importComplete ? ' ext-import-button--success' : ''}`}
          onClick={handleImport}
          disabled={selectedCount === 0 || isImporting || importComplete || !connection.connected}
        >
          {isImporting && <span className="ext-import-spinner" />}
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
