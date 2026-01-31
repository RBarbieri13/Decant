// ============================================================
// Toast Utility Functions
// Centralized toast notification helpers for common actions
// ============================================================

import { ToastContextValue } from '../context/ToastContext';

/**
 * Import Success Toast
 * Shows when a URL is successfully imported
 */
export const showImportSuccess = (
  toast: ToastContextValue,
  title: string,
  onView?: () => void
): string => {
  return toast.showToast({
    type: 'success',
    title: 'Import Successful',
    message: `"${title}" has been imported and classified`,
    duration: 5000,
    action: onView ? { label: 'View', onClick: onView } : undefined,
  });
};

/**
 * Import Error Toast
 * Shows when import fails with retry action
 */
export const showImportError = (
  toast: ToastContextValue,
  error: Error | string,
  onRetry: () => void
): string => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  return toast.showError(
    'Import Failed',
    errorMessage,
    { label: 'Retry', onClick: onRetry }
  );
};

/**
 * Node Saved Toast
 * Shows when node changes are saved
 */
export const showNodeSaved = (
  toast: ToastContextValue,
  nodeTitle?: string
): string => {
  return toast.showSuccess(
    'Changes Saved',
    nodeTitle ? `Changes to "${nodeTitle}" have been saved` : undefined
  );
};

/**
 * Node Deleted Toast
 * Shows when a node is deleted with undo action
 */
export const showNodeDeleted = (
  toast: ToastContextValue,
  title: string,
  onUndo: () => void
): string => {
  return toast.showToast({
    type: 'success',
    title: 'Node Deleted',
    message: `"${title}" has been deleted`,
    duration: 5000,
    action: { label: 'Undo', onClick: onUndo },
  });
};

/**
 * Settings Saved Toast
 * Shows when application settings are updated
 */
export const showSettingsSaved = (
  toast: ToastContextValue,
  message?: string
): string => {
  return toast.showSuccess(
    'Settings Updated',
    message || 'Your settings have been saved'
  );
};

/**
 * API Key Configured Toast
 * Shows when API key is saved and verified
 */
export const showApiKeyConfigured = (
  toast: ToastContextValue
): string => {
  return toast.showSuccess(
    'API Key Configured',
    'Your OpenAI API key has been saved and verified'
  );
};

/**
 * Enrichment Complete Toast
 * Shows when Phase 2 enrichment completes
 */
export const showEnrichmentComplete = (
  toast: ToastContextValue,
  title: string,
  onView?: () => void
): string => {
  return toast.showToast({
    type: 'success',
    title: 'Enrichment Complete',
    message: `Enhanced data is now available for "${title}"`,
    duration: 5000,
    action: onView ? { label: 'View', onClick: onView } : undefined,
  });
};

/**
 * Enrichment Failed Toast
 * Shows when enrichment fails
 */
export const showEnrichmentFailed = (
  toast: ToastContextValue,
  title: string,
  error?: string,
  onRetry?: () => void
): string => {
  return toast.showError(
    'Enrichment Failed',
    error || `Failed to enrich "${title}"`,
    onRetry ? { label: 'Retry', onClick: onRetry } : undefined
  );
};

/**
 * Connection Error Toast
 * Shows when there's a network or connection issue
 */
export const showConnectionError = (
  toast: ToastContextValue,
  onRetry?: () => void
): string => {
  return toast.showError(
    'Connection Error',
    'Unable to connect to server',
    onRetry ? { label: 'Retry', onClick: onRetry } : undefined
  );
};

/**
 * Export Success Toast
 * Shows when data export completes
 */
export const showExportSuccess = (
  toast: ToastContextValue,
  itemCount: number
): string => {
  return toast.showSuccess(
    'Export Complete',
    `Successfully exported ${itemCount} item${itemCount !== 1 ? 's' : ''}`
  );
};

/**
 * Import Data Success Toast
 * Shows when data import completes
 */
export const showImportDataSuccess = (
  toast: ToastContextValue,
  itemCount: number
): string => {
  return toast.showSuccess(
    'Import Complete',
    `Successfully imported ${itemCount} item${itemCount !== 1 ? 's' : ''}`
  );
};

/**
 * Generic Error Toast
 * Shows a generic error message
 */
export const showGenericError = (
  toast: ToastContextValue,
  message?: string
): string => {
  return toast.showError(
    'Error',
    message || 'Something went wrong. Please try again.'
  );
};

/**
 * Network Offline Toast
 * Shows when the app goes offline
 */
export const showNetworkOffline = (
  toast: ToastContextValue
): string => {
  return toast.showWarning(
    'No Internet Connection',
    'Some features may be unavailable while offline',
    10000 // Show longer for offline state
  );
};

/**
 * Network Online Toast
 * Shows when connection is restored
 */
export const showNetworkOnline = (
  toast: ToastContextValue
): string => {
  return toast.showSuccess(
    'Connection Restored',
    'You are back online',
    3000
  );
};

/**
 * Validation Error Toast
 * Shows when form validation fails
 */
export const showValidationError = (
  toast: ToastContextValue,
  fieldName: string
): string => {
  return toast.showWarning(
    'Validation Error',
    `Please check the ${fieldName} field`
  );
};

/**
 * Copy Success Toast
 * Shows when content is copied to clipboard
 */
export const showCopySuccess = (
  toast: ToastContextValue,
  content?: string
): string => {
  return toast.showSuccess(
    'Copied to Clipboard',
    content || 'Content copied successfully',
    2000 // Short duration for copy actions
  );
};
