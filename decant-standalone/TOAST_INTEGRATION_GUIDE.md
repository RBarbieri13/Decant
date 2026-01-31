# Toast Notification System - Integration Guide

## Overview

The Decant application includes a fully integrated toast notification system that provides real-time feedback for user actions, import operations, enrichment updates, and error states.

## Architecture

### Components

1. **ToastContext** (`src/renderer/context/ToastContext.tsx`)
   - Global state management for toasts
   - Provider component wraps the entire app
   - Exports `useToast` hook for accessing toast methods

2. **Toast Component** (`src/renderer/components/notifications/Toast.tsx`)
   - Individual toast notification with animations
   - Auto-dismiss timer with progress bar
   - Support for action buttons
   - Four types: success, error, warning, info

3. **ToastContainer** (`src/renderer/components/notifications/ToastContainer.tsx`)
   - Manages toast stack positioning
   - Configurable position (bottom-right by default)
   - Limits visible toasts (max 5)

4. **Toast Utilities** (`src/renderer/utils/toasts.ts`)
   - Pre-configured toast functions for common operations
   - Consistent messaging patterns across the app

## Setup

### 1. Provider Setup (Already Done)

The toast provider is set up in `src/renderer/App.tsx`:

```tsx
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/notifications/ToastContainer';

function AppShell() {
  const { toasts } = useToast();

  return (
    <>
      <YourApp />
      <ToastContainer toasts={toasts} position="bottom-right" maxToasts={5} />
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
```

### 2. Using Toasts in Components

```tsx
import { useToast } from '../context/ToastContext';
import { showImportSuccess, showImportError } from '../utils/toasts';

function MyComponent() {
  const toast = useToast();

  const handleImport = async () => {
    try {
      const result = await importUrl(url);
      showImportSuccess(toast, result.title, () => viewNode(result.nodeId));
    } catch (error) {
      showImportError(toast, error, () => retryImport());
    }
  };

  return <button onClick={handleImport}>Import</button>;
}
```

## Toast Types and Patterns

### Success Toasts

**Import Success**
```tsx
showImportSuccess(toast, 'Article Title', () => viewNode());
// Shows: "Import Successful" - "Article Title has been imported and classified"
// With "View" action button
```

**Node Saved**
```tsx
showNodeSaved(toast, 'My Document');
// Shows: "Changes Saved" - "Changes to My Document have been saved"
```

**Node Deleted (with Undo)**
```tsx
showNodeDeleted(toast, 'Old Note', () => undoDelete());
// Shows: "Node Deleted" - "Old Note has been deleted"
// With "Undo" action button
```

**Settings Saved**
```tsx
showSettingsSaved(toast, 'Theme changed to dark mode');
// Shows: "Settings Updated" - "Theme changed to dark mode"
```

**API Key Configured**
```tsx
showApiKeyConfigured(toast);
// Shows: "API Key Configured" - "Your OpenAI API key has been saved and verified"
```

**Enrichment Complete**
```tsx
showEnrichmentComplete(toast, 'Research Paper', () => viewNode());
// Shows: "Enrichment Complete" - "Enhanced data is now available for Research Paper"
// With "View" action button
```

**Export Success**
```tsx
showExportSuccess(toast, 42);
// Shows: "Export Complete" - "Successfully exported 42 items"
```

**Import Data Success**
```tsx
showImportDataSuccess(toast, 15);
// Shows: "Import Complete" - "Successfully imported 15 items"
```

**Copy Success**
```tsx
showCopySuccess(toast, 'Text copied');
// Shows: "Copied to Clipboard" - "Text copied" (2s duration)
```

### Error Toasts

**Import Error**
```tsx
showImportError(toast, new Error('Network timeout'), () => retryImport());
// Shows: "Import Failed" - "Network timeout"
// With "Retry" action button
```

**Enrichment Failed**
```tsx
showEnrichmentFailed(toast, 'Document', 'Rate limit exceeded', () => retryEnrichment());
// Shows: "Enrichment Failed" - "Rate limit exceeded"
// With optional "Retry" action button
```

**Connection Error**
```tsx
showConnectionError(toast, () => reconnect());
// Shows: "Connection Error" - "Unable to connect to server"
// With "Retry" action button
```

**Generic Error**
```tsx
showGenericError(toast, 'Something went wrong');
// Shows: "Error" - "Something went wrong"
```

**Validation Error**
```tsx
showValidationError(toast, 'Email');
// Shows: "Validation Error" - "Please check the Email field"
```

### Warning Toasts

**Network Offline**
```tsx
showNetworkOffline(toast);
// Shows: "No Internet Connection" - "Some features may be unavailable while offline"
// (10s duration)
```

### Info Toasts

**Network Online**
```tsx
showNetworkOnline(toast);
// Shows: "Connection Restored" - "You are back online"
```

## Direct Toast Methods

You can also use the toast context methods directly:

```tsx
const toast = useToast();

// Success
toast.showSuccess('Success!', 'Operation completed', 5000);

// Error with action
toast.showError('Error!', 'Something went wrong',
  { label: 'Retry', onClick: () => retry() },
  8000
);

// Warning
toast.showWarning('Warning!', 'Please check your input');

// Info
toast.showInfo('Info', 'Did you know?');

// Custom toast
toast.showToast({
  type: 'success',
  title: 'Custom Toast',
  message: 'With full control',
  duration: 5000,
  action: { label: 'Action', onClick: () => {} }
});

// Dismiss specific toast
toast.dismissToast(toastId);

// Dismiss all toasts
toast.dismissAll();
```

## SSE Integration for Real-Time Updates

The toast system is integrated with Server-Sent Events (SSE) for real-time enrichment notifications:

```tsx
import { createIntegratedSSEClient } from '../services/realtimeService';
import { showEnrichmentComplete, showEnrichmentFailed } from '../utils/toasts';

useEffect(() => {
  const sseClient = createIntegratedSSEClient(
    // On node refresh
    (nodeId) => {
      refreshNode(nodeId);
    },
    // On enrichment complete (shows toast)
    (event) => {
      if (event.success) {
        showEnrichmentComplete(toast, nodeTitle, () => viewNode(event.nodeId));
      } else {
        showEnrichmentFailed(toast, nodeTitle, event.errorMessage);
      }
    },
    // On connection state change
    (state) => {
      console.log('SSE connection state:', state);
    }
  );

  return () => sseClient.disconnect();
}, []);
```

## Integrated Locations

Toasts are already integrated in the following components:

### 1. **SettingsDialog** (`src/renderer/components/settings/SettingsDialog.tsx`)
- API key saved/cleared
- Theme changes
- Data export/import

### 2. **ImportDialog** (`src/renderer/components/import/ImportDialog.tsx`)
- Import success with "View" action
- Import errors with "Retry" action

### 3. **AppShell** (`src/renderer/components/layout/AppShell.tsx`)
- SSE integration for enrichment notifications
- Real-time enrichment complete/failed toasts

## Styling

Toast styles are defined in:
- `src/renderer/components/notifications/Toast.css`
- `src/renderer/components/notifications/ToastContainer.css`

Color scheme:
- **Success**: Green (`#22c55e`)
- **Error**: Red (`#ef4444`)
- **Warning**: Orange (`#f59e0b`)
- **Info**: Blue (`#3b82f6`)

## Accessibility

- All toasts have proper `role="alert"`
- `aria-live` regions for screen readers
- Keyboard navigation support (close on Escape)
- Focus management

## Testing

See `src/renderer/examples/ToastIntegrationExample.tsx` for:
- Live examples of all toast types
- Integration patterns
- Real-world scenarios
- Testing utilities

## Best Practices

1. **Use utility functions** for common operations (consistent UX)
2. **Include action buttons** for errors (allow retry)
3. **Keep messages concise** (title + optional message)
4. **Set appropriate durations**:
   - Success: 5s (default)
   - Error: 8s (longer to read + take action)
   - Warning: 6s
   - Info: 5s
   - Quick actions (copy): 2s
5. **Avoid toast spam** - don't show multiple toasts for the same action
6. **Use specific titles** - "Import Failed" not "Error"
7. **Provide context** in messages - include what failed/succeeded

## Common Patterns

### Import Workflow
```tsx
// Start
toast.showInfo('Import Started', 'Importing URL...');

// Success
showImportSuccess(toast, title, () => viewNode());

// Enrichment queued
toast.showInfo('Enrichment Queued', 'Processing in background...');

// Enrichment complete (via SSE)
showEnrichmentComplete(toast, title, () => viewNode());
```

### Settings Save
```tsx
// Start
toast.showInfo('Saving Settings', 'Updating configuration...');

// Success
showSettingsSaved(toast, 'Theme changed to dark mode');
```

### Error Handling
```tsx
try {
  await riskyOperation();
  toast.showSuccess('Success', 'Operation completed');
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    showConnectionError(toast, () => retry());
  } else {
    showGenericError(toast, error.message);
  }
}
```

## Files Reference

- **Context**: `src/renderer/context/ToastContext.tsx`
- **Components**:
  - `src/renderer/components/notifications/Toast.tsx`
  - `src/renderer/components/notifications/ToastContainer.tsx`
- **Utilities**: `src/renderer/utils/toasts.ts`
- **Styles**:
  - `src/renderer/components/notifications/Toast.css`
  - `src/renderer/components/notifications/ToastContainer.css`
- **Examples**: `src/renderer/examples/ToastIntegrationExample.tsx`
- **SSE Integration**: `src/renderer/services/realtimeService.ts`

## API Reference

### ToastContextValue

```typescript
interface ToastContextValue {
  toasts: ToastProps[];
  showToast: (options: ToastOptions) => string;
  showSuccess: (title: string, message?: string, duration?: number) => string;
  showError: (title: string, message?: string, action?: ToastAction, duration?: number) => string;
  showWarning: (title: string, message?: string, duration?: number) => string;
  showInfo: (title: string, message?: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}
```

### ToastOptions

```typescript
interface ToastOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 = no auto-dismiss
  action?: ToastAction;
}
```

### ToastAction

```typescript
interface ToastAction {
  label: string;
  onClick: () => void;
}
```

---

**Last Updated**: January 2026
**Version**: 1.0.0
