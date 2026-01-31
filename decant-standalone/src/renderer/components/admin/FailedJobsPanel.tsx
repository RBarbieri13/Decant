// ============================================================
// Failed Jobs Panel - Admin dashboard for failed enrichment jobs
// ============================================================

import React, { useState, useEffect } from 'react';
import './FailedJobsPanel.css';

export interface FailedJob {
  id: string;
  nodeId: string;
  nodeTitle: string;
  url?: string;
  errorMessage: string;
  timestamp: Date;
  phase: 'validation' | 'fetch' | 'classification' | 'enrichment' | 'save';
  retryCount: number;
  maxRetries: number;
}

export interface FailedJobsPanelProps {
  onRetryJob: (jobId: string) => Promise<void>;
  onRetrySelected: (jobIds: string[]) => Promise<void>;
  onClearJob: (jobId: string) => void;
  onClearAll: () => void;
  onRefresh: () => Promise<void>;
}

/**
 * Failed Jobs Panel Component
 *
 * Admin dashboard for viewing and managing failed Phase 2 enrichment jobs.
 * Supports individual retry, bulk retry, and clearing failed jobs.
 *
 * @example
 * <FailedJobsPanel
 *   onRetryJob={async (id) => await retryEnrichment(id)}
 *   onRetrySelected={async (ids) => await bulkRetry(ids)}
 *   onClearJob={(id) => removeFailedJob(id)}
 *   onClearAll={() => clearAllFailedJobs()}
 *   onRefresh={async () => await loadFailedJobs()}
 * />
 */
export function FailedJobsPanel({
  onRetryJob,
  onRetrySelected,
  onClearJob,
  onClearAll,
  onRefresh,
}: FailedJobsPanelProps): React.ReactElement {
  const [jobs, setJobs] = useState<FailedJob[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [retryingJobs, setRetryingJobs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'retryable' | 'exceeded'>('all');

  // Load failed jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      await onRefresh();
      // In a real implementation, this would fetch from an API
      // For now, using mock data
      setJobs(getMockFailedJobs());
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobs((prev) => new Set(prev).add(jobId));
    try {
      await onRetryJob(jobId);
      // Remove from list on success
      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      setSelectedJobs((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setRetryingJobs((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleRetrySelected = async () => {
    const jobIds = Array.from(selectedJobs);
    if (jobIds.length === 0) return;

    jobIds.forEach((id) => setRetryingJobs((prev) => new Set(prev).add(id)));
    try {
      await onRetrySelected(jobIds);
      // Remove from list on success
      setJobs((prev) => prev.filter((job) => !selectedJobs.has(job.id)));
      setSelectedJobs(new Set());
    } catch (err) {
      console.error('Bulk retry failed:', err);
    } finally {
      jobIds.forEach((id) => setRetryingJobs((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }));
    }
  };

  const handleToggleJob = (jobId: string) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedJobs.size === filteredJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(filteredJobs.map((job) => job.id)));
    }
  };

  const handleClearJob = (jobId: string) => {
    onClearJob(jobId);
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all failed jobs? This cannot be undone.')) {
      onClearAll();
      setJobs([]);
      setSelectedJobs(new Set());
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'retryable') return job.retryCount < job.maxRetries;
    if (filter === 'exceeded') return job.retryCount >= job.maxRetries;
    return true;
  });

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getPhaseLabel = (phase: string) => {
    const labels: Record<string, string> = {
      validation: 'Validation',
      fetch: 'Fetch Content',
      classification: 'Classification',
      enrichment: 'Enrichment',
      save: 'Save',
    };
    return labels[phase] || phase;
  };

  if (loading) {
    return (
      <div className="decant-failed-jobs">
        <div className="decant-failed-jobs__loading">
          <i className="bx bx-loader-alt bx-spin" />
          <span>Loading failed jobs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="decant-failed-jobs">
      {/* Header */}
      <div className="decant-failed-jobs__header">
        <div className="decant-failed-jobs__title-section">
          <h2 className="decant-failed-jobs__title">
            Failed Jobs
            <span className="decant-failed-jobs__count">{filteredJobs.length}</span>
          </h2>
          <p className="decant-failed-jobs__subtitle">
            Manage failed Phase 2 enrichment jobs
          </p>
        </div>
        <div className="decant-failed-jobs__actions">
          <button
            className="decant-failed-jobs__button"
            onClick={loadJobs}
            type="button"
          >
            <i className="bx bx-refresh" />
            Refresh
          </button>
          {jobs.length > 0 && (
            <button
              className="decant-failed-jobs__button decant-failed-jobs__button--danger"
              onClick={handleClearAll}
              type="button"
            >
              <i className="bx bx-trash" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {jobs.length > 0 && (
        <div className="decant-failed-jobs__filters">
          <div className="decant-failed-jobs__filter-group">
            <button
              className={`decant-failed-jobs__filter ${filter === 'all' ? 'decant-failed-jobs__filter--active' : ''}`}
              onClick={() => setFilter('all')}
              type="button"
            >
              All ({jobs.length})
            </button>
            <button
              className={`decant-failed-jobs__filter ${filter === 'retryable' ? 'decant-failed-jobs__filter--active' : ''}`}
              onClick={() => setFilter('retryable')}
              type="button"
            >
              Retryable ({jobs.filter((j) => j.retryCount < j.maxRetries).length})
            </button>
            <button
              className={`decant-failed-jobs__filter ${filter === 'exceeded' ? 'decant-failed-jobs__filter--active' : ''}`}
              onClick={() => setFilter('exceeded')}
              type="button"
            >
              Max Retries ({jobs.filter((j) => j.retryCount >= j.maxRetries).length})
            </button>
          </div>
          {selectedJobs.size > 0 && (
            <button
              className="decant-failed-jobs__button decant-failed-jobs__button--primary"
              onClick={handleRetrySelected}
              type="button"
            >
              <i className="bx bx-refresh" />
              Retry Selected ({selectedJobs.size})
            </button>
          )}
        </div>
      )}

      {/* Job List */}
      {filteredJobs.length === 0 ? (
        <div className="decant-failed-jobs__empty">
          <i className="bx bx-check-circle" />
          <h3>No Failed Jobs</h3>
          <p>All enrichment jobs completed successfully!</p>
        </div>
      ) : (
        <div className="decant-failed-jobs__list">
          {/* Select All Header */}
          <div className="decant-failed-jobs__list-header">
            <div
              className={`decant-checkbox ${selectedJobs.size === filteredJobs.length ? 'decant-checkbox--checked' : selectedJobs.size > 0 ? 'decant-checkbox--indeterminate' : ''}`}
              onClick={handleToggleAll}
            />
            <span className="decant-failed-jobs__list-header-text">
              {selectedJobs.size > 0 ? `${selectedJobs.size} selected` : 'Select all'}
            </span>
          </div>

          {/* Job Items */}
          {filteredJobs.map((job) => {
            const isRetrying = retryingJobs.has(job.id);
            const isSelected = selectedJobs.has(job.id);
            const canRetry = job.retryCount < job.maxRetries;

            return (
              <div
                key={job.id}
                className={`decant-failed-jobs__item ${isSelected ? 'decant-failed-jobs__item--selected' : ''}`}
              >
                <div
                  className={`decant-checkbox ${isSelected ? 'decant-checkbox--checked' : ''}`}
                  onClick={() => handleToggleJob(job.id)}
                />
                <div className="decant-failed-jobs__item-content">
                  <div className="decant-failed-jobs__item-header">
                    <h4 className="decant-failed-jobs__item-title">{job.nodeTitle}</h4>
                    <span className="decant-failed-jobs__item-time">
                      {formatTimestamp(job.timestamp)}
                    </span>
                  </div>
                  <div className="decant-failed-jobs__item-meta">
                    <span className={`decant-failed-jobs__badge decant-failed-jobs__badge--${job.phase}`}>
                      {getPhaseLabel(job.phase)}
                    </span>
                    <span className="decant-failed-jobs__retry-info">
                      Retry {job.retryCount}/{job.maxRetries}
                    </span>
                    {job.url && (
                      <span className="decant-failed-jobs__url" title={job.url}>
                        {new URL(job.url).hostname}
                      </span>
                    )}
                  </div>
                  <p className="decant-failed-jobs__error">{job.errorMessage}</p>
                </div>
                <div className="decant-failed-jobs__item-actions">
                  {canRetry && (
                    <button
                      className="decant-failed-jobs__item-button decant-failed-jobs__item-button--retry"
                      onClick={() => handleRetryJob(job.id)}
                      disabled={isRetrying}
                      type="button"
                      title="Retry job"
                    >
                      <i className={`bx ${isRetrying ? 'bx-loader-alt bx-spin' : 'bx-refresh'}`} />
                      {isRetrying ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                  <button
                    className="decant-failed-jobs__item-button"
                    onClick={() => handleClearJob(job.id)}
                    type="button"
                    title="Clear job"
                  >
                    <i className="bx bx-x" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Mock data for demonstration
function getMockFailedJobs(): FailedJob[] {
  return [
    {
      id: 'job-1',
      nodeId: 'node-123',
      nodeTitle: 'React Component Library',
      url: 'https://example.com/react-component-lib',
      errorMessage: 'Failed to fetch content: Network timeout after 30s',
      timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      phase: 'fetch',
      retryCount: 2,
      maxRetries: 3,
    },
    {
      id: 'job-2',
      nodeId: 'node-456',
      nodeTitle: 'Vue.js Framework',
      url: 'https://example.com/vuejs-docs',
      errorMessage: 'Classification failed: OpenAI API rate limit exceeded',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      phase: 'classification',
      retryCount: 3,
      maxRetries: 3,
    },
    {
      id: 'job-3',
      nodeId: 'node-789',
      nodeTitle: 'Tailwind CSS Documentation',
      errorMessage: 'Enrichment failed: Invalid response format from LLM',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
      phase: 'enrichment',
      retryCount: 1,
      maxRetries: 3,
    },
  ];
}
