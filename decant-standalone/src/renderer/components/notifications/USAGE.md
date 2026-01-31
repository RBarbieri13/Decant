# Toast Notification System - Usage Guide

## Overview

The Decant notification system provides a comprehensive error handling and user feedback solution with:

- **Toast Notifications** - Non-intrusive notifications for success, errors, warnings, and info
- **Error Modal** - Detailed error display with recovery options
- **Failed Jobs Dashboard** - Admin panel for managing failed enrichment jobs
- **Error Boundary** - Global error catching for React rendering errors

## Components

### 1. Toast Notifications

#### Basic Usage

```tsx
import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Saved!', 'Your changes have been saved');
    } catch (error) {
      showError('Save Failed', error.message);
    }
  };

  return <button onClick={handleSave}>Save</button>;
}
```

#### Toast Types

```tsx
// Success - Green, 5s duration
showSuccess('Import Complete', 'React Component Library imported successfully');

// Error - Red, 8s duration, with action button
showError(
  'Import Failed',
  'Network timeout',
  {
    label: 'Retry',
    onClick: () => retryImport()
  }
);

// Warning - Yellow, 6s duration
showWarning('API Key Missing', 'Please configure your OpenAI API key');

// Info - Blue, 5s duration
showInfo('Update Available', 'A new version is ready to install');
```

#### Custom Duration

```tsx
// No auto-dismiss
showSuccess('Manual Dismiss', 'Click X to close', 0);

// Custom duration (10 seconds)
showError('Critical Error', 'Please contact support', undefined, 10000);
```

#### Advanced Usage

```tsx
import { useToast } from '@/hooks/useToast';

function AdvancedExample() {
  const { showToast, dismissToast, dismissAll } = useToast();

  const handleCustomToast = () => {
    const id = showToast({
      type: 'info',
      title: 'Processing...',
      message: 'This may take a while',
      duration: 0, // Won't auto-dismiss
      action: {
        label: 'Cancel',
        onClick: () => {
          cancelOperation();
          dismissToast(id);
        }
      }
    });

    // Dismiss programmatically after operation
    performOperation().then(() => {
      dismissToast(id);
      showSuccess('Complete!');
    });
  };

  return (
    <>
      <button onClick={handleCustomToast}>Start</button>
      <button onClick={dismissAll}>Clear All Notifications</button>
    </>
  );
}
```

### 2. Error Modal

#### Basic Usage

```tsx
import { ErrorModal, ErrorDetails } from '@/components/dialogs/ErrorModal';

function MyComponent() {
  const [error, setError] = useState<ErrorDetails | null>(null);

  const handleOperation = async () => {
    try {
      await riskyOperation();
    } catch (err) {
      setError({
        title: 'Operation Failed',
        message: 'Unable to complete the operation',
        error: err as Error,
        stackTrace: (err as Error).stack,
        context: {
          operation: 'riskyOperation',
          timestamp: new Date().toISOString(),
        },
        retryable: true,
        onRetry: async () => {
          await riskyOperation();
          setError(null);
        }
      });
    }
  };

  return (
    <>
      <button onClick={handleOperation}>Start</button>
      <ErrorModal
        isOpen={!!error}
        error={error}
        onClose={() => setError(null)}
      />
    </>
  );
}
```

#### Error Modal Features

- **Collapsible Stack Trace** - Full error stack for debugging
- **Context Information** - Additional metadata about the error
- **Retry Button** - For recoverable errors
- **Copy Details** - Copy error info to clipboard
- **Report Issue** - Opens GitHub issue with pre-filled error details

### 3. Failed Jobs Dashboard

#### Basic Usage

```tsx
import { FailedJobsPanel } from '@/components/admin/FailedJobsPanel';

function AdminPanel() {
  const handleRetryJob = async (jobId: string) => {
    await api.retryEnrichment(jobId);
  };

  const handleRetrySelected = async (jobIds: string[]) => {
    await Promise.all(jobIds.map(id => api.retryEnrichment(id)));
  };

  const handleClearJob = (jobId: string) => {
    api.clearFailedJob(jobId);
  };

  const handleClearAll = () => {
    api.clearAllFailedJobs();
  };

  const handleRefresh = async () => {
    await api.loadFailedJobs();
  };

  return (
    <FailedJobsPanel
      onRetryJob={handleRetryJob}
      onRetrySelected={handleRetrySelected}
      onClearJob={handleClearJob}
      onClearAll={handleClearAll}
      onRefresh={handleRefresh}
    />
  );
}
```

#### Features

- **Bulk Operations** - Select multiple jobs and retry them together
- **Filtering** - View all jobs, retryable only, or max retries exceeded
- **Job Details** - See error message, timestamp, phase, and retry count
- **Auto-refresh** - Keep the list up to date

### 4. Error Boundary

The Error Boundary is already integrated in `App.tsx` and will catch all React rendering errors:

```tsx
// Already set up in App.tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    console.error('App Error:', error, errorInfo);
    // Send to error tracking service
  }}
>
  <App />
</ErrorBoundary>
```

#### Custom Fallback

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function MyComponent() {
  return (
    <ErrorBoundary
      fallback={(error, errorInfo, reset) => (
        <div>
          <h1>Custom Error UI</h1>
          <p>{error.message}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}
    >
      <MyApp />
    </ErrorBoundary>
  );
}
```

## Integration Examples

### Example 1: Import Flow with Notifications

```tsx
import { useToast } from '@/hooks/useToast';

function ImportDialog() {
  const { showSuccess, showError, showInfo } = useToast();

  const handleImport = async (url: string) => {
    // Show progress
    const toastId = showInfo('Importing...', 'Fetching content from URL', 0);

    try {
      const result = await importAPI.importUrl(url);

      // Dismiss progress toast
      dismissToast(toastId);

      if (result.success) {
        showSuccess(
          'Import Complete',
          `${result.nodeTitle} has been imported`,
          5000
        );

        if (result.phase2?.queued) {
          showInfo(
            'Enrichment Queued',
            'Advanced metadata will be added in the background'
          );
        }
      } else {
        showError(
          'Import Failed',
          result.error || 'Unknown error',
          {
            label: 'Retry',
            onClick: () => handleImport(url)
          }
        );
      }
    } catch (error) {
      dismissToast(toastId);
      showError('Import Error', error.message);
    }
  };

  return <ImportForm onSubmit={handleImport} />;
}
```

### Example 2: Error Handling in Data Operations

```tsx
import { useToast } from '@/hooks/useToast';
import { useState } from 'react';
import { ErrorModal, ErrorDetails } from '@/components/dialogs/ErrorModal';

function DataManager() {
  const { showSuccess, showWarning } = useToast();
  const [criticalError, setCriticalError] = useState<ErrorDetails | null>(null);

  const handleUpdate = async (id: string, data: any) => {
    try {
      await api.update(id, data);
      showSuccess('Updated', 'Changes saved successfully');
    } catch (error) {
      // For minor errors, use toast
      if (error.code === 'VALIDATION_ERROR') {
        showWarning('Invalid Data', error.message);
        return;
      }

      // For critical errors, use modal
      setCriticalError({
        title: 'Update Failed',
        message: 'Unable to save changes',
        error: error as Error,
        context: { itemId: id, operation: 'update' },
        retryable: true,
        onRetry: async () => {
          await api.update(id, data);
          setCriticalError(null);
          showSuccess('Updated', 'Changes saved successfully');
        }
      });
    }
  };

  return (
    <>
      <DataForm onSubmit={handleUpdate} />
      <ErrorModal
        isOpen={!!criticalError}
        error={criticalError}
        onClose={() => setCriticalError(null)}
      />
    </>
  );
}
```

### Example 3: Admin Dashboard with Failed Jobs

```tsx
import { FailedJobsPanel } from '@/components/admin/FailedJobsPanel';
import { useToast } from '@/hooks/useToast';

function AdminDashboard() {
  const { showSuccess, showError } = useToast();

  const handleRetryJob = async (jobId: string) => {
    try {
      await enrichmentAPI.retry(jobId);
      showSuccess('Job Retried', 'Enrichment has been queued');
    } catch (error) {
      showError('Retry Failed', error.message);
    }
  };

  const handleRetrySelected = async (jobIds: string[]) => {
    try {
      await enrichmentAPI.retryBulk(jobIds);
      showSuccess(
        'Jobs Queued',
        `${jobIds.length} jobs have been queued for retry`
      );
    } catch (error) {
      showError('Bulk Retry Failed', error.message);
    }
  };

  return (
    <FailedJobsPanel
      onRetryJob={handleRetryJob}
      onRetrySelected={handleRetrySelected}
      onClearJob={(id) => enrichmentAPI.clearFailed(id)}
      onClearAll={() => enrichmentAPI.clearAllFailed()}
      onRefresh={async () => await enrichmentAPI.loadFailed()}
    />
  );
}
```

## Best Practices

### 1. Choose the Right Notification Type

- **Toast Success** - Quick confirmations (save, delete, import)
- **Toast Error** - Recoverable errors with retry option
- **Toast Warning** - Non-critical issues (validation, missing data)
- **Toast Info** - Background operations, updates
- **Error Modal** - Critical errors needing user attention
- **Error Boundary** - Unexpected app crashes

### 2. Provide Actionable Information

```tsx
// Good - Clear message with action
showError(
  'Save Failed',
  'Network connection lost',
  { label: 'Retry', onClick: retry }
);

// Bad - Vague error
showError('Error', 'Something went wrong');
```

### 3. Set Appropriate Durations

```tsx
// Quick success - 3-5 seconds
showSuccess('Saved', undefined, 3000);

// Errors - 8+ seconds or manual dismiss
showError('Critical Error', message, undefined, 10000);

// Background tasks - No auto-dismiss
showInfo('Processing...', 'Large import in progress', 0);
```

### 4. Limit Toast Stack

The container limits toasts to 5 by default. For high-frequency notifications, consider batching:

```tsx
let toastId: string | null = null;

const updateProgress = (message: string) => {
  if (toastId) {
    dismissToast(toastId);
  }
  toastId = showInfo('Progress', message, 0);
};
```

## Accessibility

All components are built with accessibility in mind:

- **ARIA labels** on interactive elements
- **aria-live** regions for screen readers
- **Keyboard navigation** support
- **Focus management** in modals
- **Color contrast** meets WCAG AA standards

## Performance Considerations

- Toasts auto-dismiss to prevent memory leaks
- Error boundaries prevent full app crashes
- Failed jobs panel uses virtual scrolling for large lists
- Stack traces are collapsible to reduce initial render cost
