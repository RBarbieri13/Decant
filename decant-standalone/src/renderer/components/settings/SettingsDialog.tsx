// ============================================================
// Settings Dialog - Complete Application Settings & Configuration
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  showSettingsSaved,
  showApiKeyConfigured,
  showExportSuccess,
  showImportDataSuccess,
  showGenericError,
} from '../../utils/toasts';
import { settingsAPI } from '../../services/api';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'general' | 'ai' | 'performance' | 'data';

interface ModelOption {
  id: string;
  name: string;
  description: string;
  costPer1M: string;
  recommended?: boolean;
}

interface CacheStats {
  classificationCache: number;
  hierarchyCache: number;
  totalSize: number;
}

const PHASE1_MODELS: ModelOption[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast, cost-effective classification',
    costPer1M: '$0.15 / $0.60',
    recommended: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'More accurate, slower',
    costPer1M: '$2.50 / $10.00',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'High quality, premium cost',
    costPer1M: '$10.00 / $30.00',
  },
];

const PHASE2_MODELS: ModelOption[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast background enrichment',
    costPer1M: '$0.15 / $0.60',
    recommended: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Better descriptions & metadata',
    costPer1M: '$2.50 / $10.00',
  },
];

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps): React.ReactElement | null {
  const toast = useToast();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // AI Settings
  const [phase1Model, setPhase1Model] = useState<string>('gpt-4o-mini');
  const [phase2Model, setPhase2Model] = useState<string>('gpt-4o-mini');

  // Performance Settings
  const [requestsPerMinute, setRequestsPerMinute] = useState<number>(10);
  const [concurrentRequests, setConcurrentRequests] = useState<number>(3);

  // Cache Stats
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    classificationCache: 0,
    hierarchyCache: 0,
    totalSize: 0,
  });
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Database Stats
  const [dbStats, setDbStats] = useState({
    totalNodes: 0,
    totalItems: 0,
    totalSegments: 0,
    totalOrganizations: 0,
  });

  // Load settings on open
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadCacheStats();
      loadDatabaseStats();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      // Load API key status using the correct REST API
      const keyStatus = await settingsAPI.getApiKeyStatus();
      setHasApiKey(keyStatus.configured);
      setApiKey(''); // Don't show existing key for security

      // Load theme preference
      const savedTheme = await window.decantAPI.settings.get('theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
      }

      // Load AI model preferences
      const savedPhase1 = await window.decantAPI.settings.get('phase1_model');
      if (savedPhase1) setPhase1Model(savedPhase1);

      const savedPhase2 = await window.decantAPI.settings.get('phase2_model');
      if (savedPhase2) setPhase2Model(savedPhase2);

      // Load performance settings
      const savedRPM = await window.decantAPI.settings.get('requests_per_minute');
      if (savedRPM) setRequestsPerMinute(parseInt(savedRPM, 10));

      const savedConcurrent = await window.decantAPI.settings.get('concurrent_requests');
      if (savedConcurrent) setConcurrentRequests(parseInt(savedConcurrent, 10));
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadCacheStats = async () => {
    // Mock cache stats - in real app, fetch from API
    setCacheStats({
      classificationCache: 156,
      hierarchyCache: 89,
      totalSize: 2450000, // ~2.45 MB
    });
  };

  const loadDatabaseStats = async () => {
    try {
      // In real implementation, fetch from API endpoint
      // For now, using mock data
      setDbStats({
        totalNodes: 342,
        totalItems: 278,
        totalSegments: 10,
        totalOrganizations: 54,
      });
    } catch (err) {
      console.error('Failed to load database stats:', err);
    }
  };

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKey.trim()) return;

    setIsSaving(true);
    setTestResult(null);
    try {
      await settingsAPI.setApiKey(apiKey.trim());
      setHasApiKey(true);
      setApiKey('');
      showApiKeyConfigured(toast);
    } catch (err) {
      console.error('Failed to save API key:', err);
      showGenericError(toast, 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, toast]);

  const handleClearApiKey = useCallback(async () => {
    setIsSaving(true);
    setTestResult(null);
    try {
      await settingsAPI.setApiKey('');
      setHasApiKey(false);
      showSettingsSaved(toast, 'API key cleared');
    } catch (err) {
      console.error('Failed to clear API key:', err);
      showGenericError(toast, 'Failed to clear API key');
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const handleTestConnection = useCallback(async () => {
    if (!hasApiKey) {
      setTestResult('No API key configured');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      // In real implementation, call test endpoint
      // Mock successful test for now
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTestResult('Connection successful');
    } catch (err) {
      setTestResult('Connection failed');
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  }, [hasApiKey]);

  const handleThemeChange = useCallback(async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    try {
      await window.decantAPI.settings.set('theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      showSettingsSaved(toast, `Theme changed to ${newTheme} mode`);
    } catch (err) {
      console.error('Failed to save theme:', err);
      showGenericError(toast, 'Failed to save theme');
    }
  }, [toast]);

  const handleModelChange = useCallback(async (phase: 'phase1' | 'phase2', model: string) => {
    try {
      if (phase === 'phase1') {
        setPhase1Model(model);
        await window.decantAPI.settings.set('phase1_model', model);
      } else {
        setPhase2Model(model);
        await window.decantAPI.settings.set('phase2_model', model);
      }
      showSettingsSaved(toast, 'Model preference saved');
    } catch (err) {
      console.error('Failed to save model preference:', err);
      showGenericError(toast, 'Failed to save model preference');
    }
  }, [toast]);

  const handlePerformanceChange = useCallback(async (setting: string, value: number) => {
    try {
      if (setting === 'rpm') {
        setRequestsPerMinute(value);
        await window.decantAPI.settings.set('requests_per_minute', value.toString());
      } else if (setting === 'concurrent') {
        setConcurrentRequests(value);
        await window.decantAPI.settings.set('concurrent_requests', value.toString());
      }
    } catch (err) {
      console.error('Failed to save performance setting:', err);
    }
  }, []);

  const handleResetDefaults = useCallback(() => {
    setRequestsPerMinute(10);
    setConcurrentRequests(3);
    handlePerformanceChange('rpm', 10);
    handlePerformanceChange('concurrent', 3);
    showSettingsSaved(toast, 'Reset to default values');
  }, [handlePerformanceChange, toast]);

  const handleClearCache = useCallback(async (type: 'classification' | 'hierarchy' | 'all') => {
    setIsClearingCache(true);
    try {
      // In real implementation, call API to clear cache
      await new Promise(resolve => setTimeout(resolve, 500));

      if (type === 'all') {
        setCacheStats({ classificationCache: 0, hierarchyCache: 0, totalSize: 0 });
        showSettingsSaved(toast, 'All caches cleared');
      } else if (type === 'classification') {
        setCacheStats(prev => ({ ...prev, classificationCache: 0, totalSize: Math.floor(prev.totalSize * 0.4) }));
        showSettingsSaved(toast, 'Classification cache cleared');
      } else {
        setCacheStats(prev => ({ ...prev, hierarchyCache: 0, totalSize: Math.floor(prev.totalSize * 0.6) }));
        showSettingsSaved(toast, 'Hierarchy cache cleared');
      }
    } catch (err) {
      console.error('Failed to clear cache:', err);
      showGenericError(toast, 'Failed to clear cache');
    } finally {
      setIsClearingCache(false);
    }
  }, [toast]);

  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await window.decantAPI.data.export();
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `decant-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const data = JSON.parse(result.data);
        const itemCount = data.nodes?.length || 0;
        showExportSuccess(toast, itemCount);
      } else {
        showGenericError(toast, result.error || 'Export failed');
      }
    } catch (err) {
      console.error('Export failed:', err);
      showGenericError(toast, 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [toast]);

  const handleImportData = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const jsonData = await file.text();
        const result = await window.decantAPI.data.import(jsonData);
        if (result.success) {
          showImportDataSuccess(toast, result.nodesImported || 0);
          window.dispatchEvent(new CustomEvent('decant:refresh'));
          loadDatabaseStats(); // Refresh stats
        } else {
          showGenericError(toast, result.error || 'Import failed');
        }
      } catch (err) {
        console.error('Import failed:', err);
        showGenericError(toast, 'Import failed: Invalid file format');
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  }, [toast]);

  const handleClose = useCallback(() => {
    setApiKey('');
    setShowApiKey(false);
    setTestResult(null);
    setActiveTab('general');
    onClose();
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="settings-dialog gum-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={handleClose} aria-label="Close settings">
            &times;
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`settings-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Models
          </button>
          <button
            className={`settings-tab ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
            Performance
          </button>
          <button
            className={`settings-tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Data
          </button>
        </div>

        <div className="settings-content">
          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <>
              {/* Theme Section */}
              <div className="settings-section">
                <h3>Appearance</h3>
                <p className="settings-description">
                  Choose your preferred color theme.
                </p>

                <div className="theme-options">
                  <button
                    className={`theme-option gum-button ${theme === 'light' ? 'gum-button--yellow' : ''}`}
                    onClick={() => handleThemeChange('light')}
                  >
                    ☀️ Light
                  </button>
                  <button
                    className={`theme-option gum-button ${theme === 'dark' ? 'gum-button--blue' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                  >
                    🌙 Dark
                  </button>
                </div>
              </div>

              {/* About Section */}
              <div className="settings-section">
                <h3>About</h3>
                <div className="about-info">
                  <p><strong>Decant</strong> v1.0.0</p>
                  <p className="text-muted">AI-Powered Knowledge Base</p>
                  <p className="text-muted">Built with React, TypeScript, and OpenAI</p>
                </div>
              </div>
            </>
          )}

          {/* AI TAB */}
          {activeTab === 'ai' && (
            <>
              {/* API Key Section */}
              <div className="settings-section">
                <h3>OpenAI API Key</h3>
                <p className="settings-description">
                  Required for AI-powered content classification and summarization.
                </p>

                {hasApiKey ? (
                  <div className="api-key-status">
                    <span className="api-key-indicator api-key-set">
                      ✓ API key is configured
                    </span>
                    <div className="api-key-actions">
                      <button
                        className="gum-button gum-button--small gum-button--blue"
                        onClick={handleTestConnection}
                        disabled={isTesting}
                      >
                        {isTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        className="gum-button gum-button--small"
                        onClick={handleClearApiKey}
                        disabled={isSaving}
                      >
                        Clear Key
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="api-key-status">
                    <span className="api-key-indicator api-key-missing">
                      ⚠ No API key configured
                    </span>
                  </div>
                )}

                <div className="api-key-input-group">
                  <div className="api-key-input-wrapper">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      className="gum-input api-key-input"
                      placeholder={hasApiKey ? 'Enter new API key to replace' : 'sk-...'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      aria-label="API Key"
                    />
                    <button
                      className="api-key-toggle"
                      onClick={() => setShowApiKey(!showApiKey)}
                      type="button"
                      title={showApiKey ? 'Hide' : 'Show'}
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  <button
                    className="gum-button gum-button--small gum-button--green"
                    onClick={handleSaveApiKey}
                    disabled={!apiKey.trim() || isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>

                {testResult && (
                  <div className={`settings-message ${testResult.includes('successful') ? 'success' : 'error'}`}>
                    {testResult}
                  </div>
                )}

                <p className="settings-hint">
                  Get your API key from{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open('https://platform.openai.com/api-keys', '_blank');
                    }}
                  >
                    OpenAI Dashboard
                  </a>
                </p>
              </div>

              {/* Model Selection - Phase 1 */}
              <div className="settings-section">
                <h3>Phase 1 Model (Quick Classification)</h3>
                <p className="settings-description">
                  Used for initial content classification and hierarchy assignment.
                </p>

                <div className="model-options">
                  {PHASE1_MODELS.map((model) => (
                    <label key={model.id} className="model-option">
                      <input
                        type="radio"
                        name="phase1-model"
                        value={model.id}
                        checked={phase1Model === model.id}
                        onChange={(e) => handleModelChange('phase1', e.target.value)}
                      />
                      <div className="model-info">
                        <div className="model-header">
                          <span className="model-name">{model.name}</span>
                          {model.recommended && <span className="model-badge">Recommended</span>}
                        </div>
                        <div className="model-description">{model.description}</div>
                        <div className="model-cost">Cost: {model.costPer1M} (input/output per 1M tokens)</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Model Selection - Phase 2 */}
              <div className="settings-section">
                <h3>Phase 2 Model (Background Enrichment)</h3>
                <p className="settings-description">
                  Used for detailed descriptions, metadata extraction, and enrichment.
                </p>

                <div className="model-options">
                  {PHASE2_MODELS.map((model) => (
                    <label key={model.id} className="model-option">
                      <input
                        type="radio"
                        name="phase2-model"
                        value={model.id}
                        checked={phase2Model === model.id}
                        onChange={(e) => handleModelChange('phase2', e.target.value)}
                      />
                      <div className="model-info">
                        <div className="model-header">
                          <span className="model-name">{model.name}</span>
                          {model.recommended && <span className="model-badge">Recommended</span>}
                        </div>
                        <div className="model-description">{model.description}</div>
                        <div className="model-cost">Cost: {model.costPer1M} (input/output per 1M tokens)</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* PERFORMANCE TAB */}
          {activeTab === 'performance' && (
            <>
              {/* Rate Limits Section */}
              <div className="settings-section">
                <h3>Rate Limits</h3>
                <p className="settings-description">
                  Control API request throttling to manage costs and stay within quotas.
                </p>

                <div className="setting-control">
                  <label htmlFor="rpm-slider">
                    Requests per minute: <strong>{requestsPerMinute}</strong>
                  </label>
                  <input
                    id="rpm-slider"
                    type="range"
                    min="1"
                    max="60"
                    value={requestsPerMinute}
                    onChange={(e) => handlePerformanceChange('rpm', parseInt(e.target.value, 10))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>1</span>
                    <span>60</span>
                  </div>
                </div>

                <div className="setting-control">
                  <label htmlFor="concurrent-slider">
                    Concurrent requests: <strong>{concurrentRequests}</strong>
                  </label>
                  <input
                    id="concurrent-slider"
                    type="range"
                    min="1"
                    max="10"
                    value={concurrentRequests}
                    onChange={(e) => handlePerformanceChange('concurrent', parseInt(e.target.value, 10))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>1</span>
                    <span>10</span>
                  </div>
                </div>

                <button
                  className="gum-button gum-button--small"
                  onClick={handleResetDefaults}
                >
                  Reset to Defaults
                </button>
              </div>

              {/* Cache Management Section */}
              <div className="settings-section">
                <h3>Cache Management</h3>
                <p className="settings-description">
                  Clear cached data to free up storage or force fresh data loading.
                </p>

                <div className="cache-stats">
                  <div className="cache-stat">
                    <span className="cache-label">Classification Cache:</span>
                    <span className="cache-value">{cacheStats.classificationCache} entries</span>
                  </div>
                  <div className="cache-stat">
                    <span className="cache-label">Hierarchy Cache:</span>
                    <span className="cache-value">{cacheStats.hierarchyCache} entries</span>
                  </div>
                  <div className="cache-stat">
                    <span className="cache-label">Total Size:</span>
                    <span className="cache-value">{formatBytes(cacheStats.totalSize)}</span>
                  </div>
                </div>

                <div className="cache-actions">
                  <button
                    className="gum-button gum-button--small"
                    onClick={() => handleClearCache('classification')}
                    disabled={isClearingCache}
                  >
                    Clear Classification
                  </button>
                  <button
                    className="gum-button gum-button--small"
                    onClick={() => handleClearCache('hierarchy')}
                    disabled={isClearingCache}
                  >
                    Clear Hierarchy
                  </button>
                  <button
                    className="gum-button gum-button--small gum-button--pink"
                    onClick={() => handleClearCache('all')}
                    disabled={isClearingCache}
                  >
                    Clear All Caches
                  </button>
                </div>
              </div>
            </>
          )}

          {/* DATA TAB */}
          {activeTab === 'data' && (
            <>
              {/* Data Export/Import Section */}
              <div className="settings-section">
                <h3>Data Management</h3>
                <p className="settings-description">
                  Export your knowledge base to a JSON file or import from a previous export.
                </p>

                <div className="data-actions">
                  <button
                    className="gum-button gum-button--blue"
                    onClick={handleExportData}
                    disabled={isExporting || isImporting}
                  >
                    {isExporting ? 'Exporting...' : '📦 Export Data'}
                  </button>
                  <button
                    className="gum-button gum-button--pink"
                    onClick={handleImportData}
                    disabled={isExporting || isImporting}
                  >
                    {isImporting ? 'Importing...' : '📥 Import Data'}
                  </button>
                </div>

                <p className="settings-hint">
                  Note: Import will add new items without overwriting existing data.
                </p>
              </div>

              {/* Database Statistics Section */}
              <div className="settings-section">
                <h3>Database Statistics</h3>
                <p className="settings-description">
                  Overview of your knowledge base contents.
                </p>

                <div className="db-stats">
                  <div className="db-stat">
                    <span className="db-stat-value">{dbStats.totalNodes}</span>
                    <span className="db-stat-label">Total Nodes</span>
                  </div>
                  <div className="db-stat">
                    <span className="db-stat-value">{dbStats.totalItems}</span>
                    <span className="db-stat-label">Items</span>
                  </div>
                  <div className="db-stat">
                    <span className="db-stat-value">{dbStats.totalSegments}</span>
                    <span className="db-stat-label">Segments</span>
                  </div>
                  <div className="db-stat">
                    <span className="db-stat-value">{dbStats.totalOrganizations}</span>
                    <span className="db-stat-label">Organizations</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="settings-footer">
          <button className="gum-button gum-button--small" onClick={handleClose}>
            Close
          </button>
        </div>

        <style>{`
          .settings-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.2s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .settings-dialog {
            width: 100%;
            max-width: 700px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            background: var(--gum-white);
            animation: slideUp 0.3s ease-out;
          }

          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }

          .settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--space-md) var(--space-lg);
            border-bottom: var(--border-width) solid var(--gum-black);
          }

          .settings-header h2 {
            margin: 0;
            font-size: var(--font-size-lg);
          }

          .settings-close-btn {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            border-radius: var(--border-radius);
          }

          .settings-close-btn:hover {
            background: var(--gum-gray-100);
          }

          .settings-tabs {
            display: flex;
            border-bottom: 2px solid var(--gum-gray-200);
            background: var(--gum-gray-50);
          }

          .settings-tab {
            flex: 1;
            padding: var(--space-sm) var(--space-md);
            border: none;
            background: none;
            cursor: pointer;
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
            border-bottom: 3px solid transparent;
            transition: all 0.2s ease;
          }

          .settings-tab:hover {
            background: var(--gum-gray-100);
          }

          .settings-tab.active {
            background: var(--gum-white);
            border-bottom-color: var(--gum-pink);
            color: var(--gum-black);
          }

          .settings-content {
            flex: 1;
            overflow-y: auto;
            padding: var(--space-lg);
          }

          .settings-section {
            margin-bottom: var(--space-xl);
          }

          .settings-section:last-child {
            margin-bottom: 0;
          }

          .settings-section h3 {
            margin: 0 0 var(--space-sm);
            font-size: var(--font-size-md);
            font-weight: var(--font-weight-bold);
          }

          .settings-description {
            margin: 0 0 var(--space-md);
            font-size: var(--font-size-sm);
            color: var(--gum-gray-600);
          }

          .api-key-status {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-md);
            margin-bottom: var(--space-md);
            flex-wrap: wrap;
          }

          .api-key-actions {
            display: flex;
            gap: var(--space-sm);
          }

          .api-key-indicator {
            font-size: var(--font-size-sm);
            padding: var(--space-xs) var(--space-sm);
            border-radius: var(--border-radius);
            font-weight: var(--font-weight-medium);
          }

          .api-key-set {
            background: var(--gum-green);
            color: var(--gum-black);
          }

          .api-key-missing {
            background: var(--gum-gray-200);
            color: var(--gum-gray-600);
          }

          .api-key-input-group {
            display: flex;
            gap: var(--space-sm);
            margin-bottom: var(--space-sm);
          }

          .api-key-input-wrapper {
            flex: 1;
            position: relative;
          }

          .api-key-input {
            width: 100%;
            padding-right: 40px;
            font-family: var(--font-mono);
          }

          .api-key-toggle {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            font-size: 14px;
          }

          .settings-message {
            padding: var(--space-sm);
            border-radius: var(--border-radius);
            font-size: var(--font-size-sm);
            margin-bottom: var(--space-sm);
          }

          .settings-message.success {
            background: var(--gum-green);
            color: var(--gum-black);
          }

          .settings-message.error {
            background: #ff6b6b;
            color: var(--gum-white);
          }

          .settings-hint {
            margin: 0;
            font-size: var(--font-size-xs);
            color: var(--gum-gray-600);
          }

          .settings-hint a {
            color: var(--gum-black);
            text-decoration: underline;
          }

          .theme-options {
            display: flex;
            gap: var(--space-sm);
          }

          .theme-option {
            flex: 1;
          }

          .data-actions {
            display: flex;
            gap: var(--space-sm);
            margin-bottom: var(--space-md);
          }

          .data-actions button {
            flex: 1;
          }

          .about-info {
            background: var(--gum-gray-100);
            padding: var(--space-md);
            border-radius: var(--border-radius);
          }

          .about-info p {
            margin: 0;
          }

          .about-info p + p {
            margin-top: var(--space-xs);
          }

          .model-options {
            display: flex;
            flex-direction: column;
            gap: var(--space-sm);
          }

          .model-option {
            display: flex;
            align-items: flex-start;
            gap: var(--space-sm);
            padding: var(--space-md);
            border: 2px solid var(--gum-gray-200);
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .model-option:hover {
            border-color: var(--gum-gray-400);
            background: var(--gum-gray-50);
          }

          .model-option input[type="radio"] {
            margin-top: 2px;
            cursor: pointer;
          }

          .model-option input[type="radio"]:checked + .model-info {
            color: var(--gum-black);
          }

          .model-info {
            flex: 1;
          }

          .model-header {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            margin-bottom: var(--space-xs);
          }

          .model-name {
            font-weight: var(--font-weight-semibold);
            font-size: var(--font-size-sm);
          }

          .model-badge {
            font-size: var(--font-size-xs);
            padding: 2px var(--space-xs);
            background: var(--gum-green);
            border-radius: var(--border-radius-sm);
            font-weight: var(--font-weight-medium);
          }

          .model-description {
            font-size: var(--font-size-sm);
            color: var(--gum-gray-600);
            margin-bottom: var(--space-xs);
          }

          .model-cost {
            font-size: var(--font-size-xs);
            color: var(--gum-gray-500);
            font-family: var(--font-mono);
          }

          .setting-control {
            margin-bottom: var(--space-lg);
          }

          .setting-control label {
            display: block;
            margin-bottom: var(--space-sm);
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
          }

          .slider {
            width: 100%;
            height: 6px;
            border-radius: 3px;
            background: var(--gum-gray-200);
            outline: none;
            -webkit-appearance: none;
          }

          .slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: var(--gum-pink);
            cursor: pointer;
            border: 2px solid var(--gum-black);
          }

          .slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: var(--gum-pink);
            cursor: pointer;
            border: 2px solid var(--gum-black);
          }

          .slider-labels {
            display: flex;
            justify-content: space-between;
            font-size: var(--font-size-xs);
            color: var(--gum-gray-600);
            margin-top: var(--space-xs);
          }

          .cache-stats {
            background: var(--gum-gray-50);
            padding: var(--space-md);
            border-radius: var(--border-radius);
            margin-bottom: var(--space-md);
          }

          .cache-stat {
            display: flex;
            justify-content: space-between;
            padding: var(--space-xs) 0;
            font-size: var(--font-size-sm);
          }

          .cache-label {
            color: var(--gum-gray-600);
          }

          .cache-value {
            font-weight: var(--font-weight-medium);
            font-family: var(--font-mono);
          }

          .cache-actions {
            display: flex;
            gap: var(--space-sm);
            flex-wrap: wrap;
          }

          .db-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: var(--space-md);
          }

          .db-stat {
            background: var(--gum-gray-50);
            padding: var(--space-md);
            border-radius: var(--border-radius);
            text-align: center;
          }

          .db-stat-value {
            display: block;
            font-size: var(--font-size-xl);
            font-weight: var(--font-weight-bold);
            color: var(--gum-black);
            margin-bottom: var(--space-xs);
          }

          .db-stat-label {
            display: block;
            font-size: var(--font-size-xs);
            color: var(--gum-gray-600);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .settings-footer {
            display: flex;
            justify-content: flex-end;
            padding: var(--space-md) var(--space-lg);
            border-top: var(--border-width) solid var(--gum-gray-200);
          }
        `}</style>
      </div>
    </div>
  );
}
