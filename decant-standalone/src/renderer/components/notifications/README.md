# Decant Notification System

A comprehensive user-facing error notification system for the Decant application.

## Components Overview

### 1. Toast Notifications (`Toast.tsx`, `ToastContainer.tsx`)
Non-intrusive notifications that appear in the corner of the screen.

**Features:**
- 4 types: success, error, warning, info
- Auto-dismiss with customizable duration
- Manual dismiss with close button
- Optional action buttons
- Progress bar showing time until auto-dismiss
- Slide-in/out animations
- Stacked display (max 5 visible)

**Files:**
- `src/renderer/components/notifications/Toast.tsx` - Individual toast component
- `src/renderer/components/notifications/Toast.css` - Toast styles
- `src/renderer/components/notifications/ToastContainer.tsx` - Container managing toast stack
- `src/renderer/components/notifications/ToastContainer.css` - Container positioning

### 2. Toast Context (`ToastContext.tsx`)
Global state management for toasts with convenience methods.

**Features:**
- Provider component for app-wide access
- Helper methods: `showSuccess`, `showError`, `showWarning`, `showInfo`
- Custom toast options with `showToast`
- Programmatic dismiss: `dismissToast(id)`, `dismissAll()`
- TypeScript support with full type safety

**Files:**
- `src/renderer/context/ToastContext.tsx` - Context provider and hook
- `src/renderer/hooks/useToast.ts` - Convenience hook export

### 3. Error Modal (`ErrorModal.tsx`)
Detailed error display for critical errors requiring user attention.

**Features:**
- Full error details with stack trace
- Collapsible stack trace section
- Copy error details to clipboard
- Retry button for recoverable errors
- Report issue button (opens GitHub)
- Context information display
- Accessible modal dialog

**Files:**
- `src/renderer/components/dialogs/ErrorModal.tsx` - Error modal component
- `src/renderer/components/dialogs/ErrorModal.css` - Error modal styles

### 4. Failed Jobs Panel (`FailedJobsPanel.tsx`)
Admin dashboard for managing failed Phase 2 enrichment jobs.

**Features:**
- List all failed enrichment jobs
- Individual job retry
- Bulk retry selected jobs
- Filter by status (all, retryable, max retries exceeded)
- Clear individual or all failed jobs
- Job metadata display (phase, retry count, timestamp)
- Checkbox selection with "select all"

**Files:**
- `src/renderer/components/admin/FailedJobsPanel.tsx` - Failed jobs panel
- `src/renderer/components/admin/FailedJobsPanel.css` - Panel styles

### 5. Error Boundary (`ErrorBoundary.tsx`)
Global error catching for React rendering errors.

**Features:**
- Catches all uncaught React errors
- Prevents full app crashes
- Displays friendly error UI
- Options to reload or go home
- Logs errors to backend
- Copy error details
- Custom fallback UI support

**Files:**
- `src/renderer/components/ErrorBoundary.tsx` - Error boundary component
- `src/renderer/components/ErrorBoundary.css` - Error boundary styles

## File Structure

```
src/renderer/
├── components/
│   ├── notifications/
│   │   ├── Toast.tsx                    # Individual toast component
│   │   ├── Toast.css                    # Toast styles
│   │   ├── ToastContainer.tsx           # Toast container
│   │   ├── ToastContainer.css           # Container styles
│   │   ├── NotificationDemo.tsx         # Demo component
│   │   ├── index.ts                     # Barrel exports
│   │   ├── USAGE.md                     # Detailed usage guide
│   │   └── README.md                    # This file
│   ├── dialogs/
│   │   ├── ErrorModal.tsx               # Error modal component
│   │   └── ErrorModal.css               # Error modal styles
│   ├── admin/
│   │   ├── FailedJobsPanel.tsx          # Failed jobs dashboard
│   │   └── FailedJobsPanel.css          # Dashboard styles
│   └── ErrorBoundary.tsx                # Global error boundary
│       └── ErrorBoundary.css            # Error boundary styles
├── context/
│   └── ToastContext.tsx                 # Toast state management
└── hooks/
    └── useToast.ts                      # Toast hook export
```

## Quick Start

### 1. Setup (Already done in App.tsx)

The notification system is already integrated in the app:

```tsx
// src/renderer/App.tsx
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/notifications/ToastContainer';

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ErrorBoundary>
  );
}
```

### 2. Use Toasts

```tsx
import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const { showSuccess, showError } = useToast();

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

### 3. Use Error Modal

```tsx
import { ErrorModal, ErrorDetails } from '@/components/dialogs/ErrorModal';

function MyComponent() {
  const [error, setError] = useState<ErrorDetails | null>(null);

  const handleRiskyOperation = async () => {
    try {
      await riskyOperation();
    } catch (err) {
      setError({
        title: 'Operation Failed',
        message: err.message,
        error: err,
        retryable: true,
        onRetry: () => riskyOperation()
      });
    }
  };

  return (
    <>
      <button onClick={handleRiskyOperation}>Start</button>
      <ErrorModal
        isOpen={!!error}
        error={error}
        onClose={() => setError(null)}
      />
    </>
  );
}
```

### 4. Use Failed Jobs Panel

```tsx
import { FailedJobsPanel } from '@/components/admin/FailedJobsPanel';

function AdminPanel() {
  return (
    <FailedJobsPanel
      onRetryJob={async (id) => await api.retryJob(id)}
      onRetrySelected={async (ids) => await api.retryBulk(ids)}
      onClearJob={(id) => api.clearJob(id)}
      onClearAll={() => api.clearAll()}
      onRefresh={async () => await api.loadJobs()}
    />
  );
}
```

## Demo

View the notification demo at:
```tsx
import { NotificationDemo } from '@/components/notifications/NotificationDemo';

// Render in your app to see all features
<NotificationDemo />
```

## API Reference

### useToast Hook

```typescript
const {
  toasts,              // ToastProps[] - Current toast stack
  showToast,           // (options: ToastOptions) => string - Show custom toast
  showSuccess,         // (title, message?, duration?) => string
  showError,           // (title, message?, action?, duration?) => string
  showWarning,         // (title, message?, duration?) => string
  showInfo,            // (title, message?, duration?) => string
  dismissToast,        // (id: string) => void - Dismiss specific toast
  dismissAll,          // () => void - Dismiss all toasts
} = useToast();
```

### Toast Types

```typescript
interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;  // 0 = no auto-dismiss
  action?: ToastAction;
}
```

### Error Details

```typescript
interface ErrorDetails {
  title: string;
  message: string;
  error?: Error;
  stackTrace?: string;
  context?: Record<string, any>;
  retryable?: boolean;
  onRetry?: () => void | Promise<void>;
}
```

## Styling

All components use CSS custom properties from the main app theme:

```css
--decant-green        /* Success color */
--decant-gray-*       /* Text and borders */
--decant-brand-*      /* Primary actions */
```

Components are fully responsive and work on mobile devices.

## Accessibility

- All interactive elements have proper ARIA labels
- Toasts use `aria-live` regions for screen readers
- Modals trap focus and can be closed with Escape key
- Keyboard navigation fully supported
- Color contrast meets WCAG AA standards

## Performance

- Toasts auto-dismiss to prevent memory leaks
- Max 5 toasts visible at once
- Animations use CSS transforms (GPU accelerated)
- Error boundaries prevent full app crashes
- Component lazy loading supported

## Testing

Example unit tests:

```tsx
import { render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '@/context/ToastContext';

test('shows success toast', () => {
  const TestComponent = () => {
    const { showSuccess } = useToast();
    return <button onClick={() => showSuccess('Test')}>Show</button>;
  };

  render(
    <ToastProvider>
      <TestComponent />
    </ToastProvider>
  );

  fireEvent.click(screen.getByText('Show'));
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## Contributing

When adding new notification features:

1. Follow existing component patterns
2. Add TypeScript types
3. Update USAGE.md with examples
4. Test on mobile viewports
5. Ensure accessibility compliance
6. Add to NotificationDemo component

## License

Part of the Decant application.
