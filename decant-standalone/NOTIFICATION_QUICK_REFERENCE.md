# Notification System - Quick Reference

## Import Statements

```tsx
// Toast notifications
import { useToast } from '@/hooks/useToast';

// Error modal
import { ErrorModal, ErrorDetails } from '@/components/dialogs/ErrorModal';

// Failed jobs panel
import { FailedJobsPanel } from '@/components/admin/FailedJobsPanel';

// Error boundary (already in App.tsx)
import { ErrorBoundary } from '@/components/ErrorBoundary';
```

## Toast Notifications

### Basic Usage
```tsx
const { showSuccess, showError, showWarning, showInfo } = useToast();

// Success (green, 5s)
showSuccess('Title', 'Optional message');

// Error (red, 8s)
showError('Title', 'Message');

// Warning (yellow, 6s)
showWarning('Title', 'Message');

// Info (blue, 5s)
showInfo('Title', 'Message');
```

### With Action Button
```tsx
showError('Failed', 'Could not save', {
  label: 'Retry',
  onClick: () => retrySave()
});
```

### Custom Duration
```tsx
// No auto-dismiss
showSuccess('Title', 'Message', 0);

// 10 seconds
showError('Title', 'Message', undefined, 10000);
```

### Manual Control
```tsx
const { showToast, dismissToast, dismissAll } = useToast();

// Show and get ID
const id = showToast({
  type: 'info',
  title: 'Processing...',
  duration: 0
});

// Dismiss specific
dismissToast(id);

// Dismiss all
dismissAll();
```

## Error Modal

### Basic Usage
```tsx
const [error, setError] = useState<ErrorDetails | null>(null);

// Show error
setError({
  title: 'Error Title',
  message: 'Error description',
  error: new Error('...')
});

// Render modal
<ErrorModal
  isOpen={!!error}
  error={error}
  onClose={() => setError(null)}
/>
```

### With Retry
```tsx
setError({
  title: 'Failed',
  message: 'Could not complete',
  error: err,
  retryable: true,
  onRetry: async () => {
    await retry();
    setError(null); // Close on success
  }
});
```

### With Context
```tsx
setError({
  title: 'Import Failed',
  message: err.message,
  error: err,
  stackTrace: err.stack,
  context: {
    url: importUrl,
    timestamp: new Date().toISOString(),
    userId: currentUser.id
  }
});
```

## Failed Jobs Panel

### Basic Setup
```tsx
<FailedJobsPanel
  onRetryJob={async (id) => await api.retry(id)}
  onRetrySelected={async (ids) => await api.retryBulk(ids)}
  onClearJob={(id) => api.clear(id)}
  onClearAll={() => api.clearAll()}
  onRefresh={async () => await api.loadJobs()}
/>
```

## Common Patterns

### Import Flow
```tsx
const handleImport = async (url: string) => {
  const progressId = showInfo('Importing...', url, 0);
  try {
    const result = await importAPI.import(url);
    dismissToast(progressId);
    showSuccess('Import Complete', result.title);
  } catch (err) {
    dismissToast(progressId);
    showError('Import Failed', err.message, {
      label: 'Retry',
      onClick: () => handleImport(url)
    });
  }
};
```

### Save with Validation
```tsx
const handleSave = async (data: any) => {
  // Validation errors -> Warning toast
  if (!data.title) {
    showWarning('Invalid Data', 'Title is required');
    return;
  }

  try {
    await api.save(data);
    showSuccess('Saved', 'Changes saved successfully');
  } catch (err) {
    // Network errors -> Error toast with retry
    if (err.code === 'NETWORK_ERROR') {
      showError('Save Failed', 'Network error', {
        label: 'Retry',
        onClick: () => handleSave(data)
      });
    } else {
      // Critical errors -> Error modal
      setError({
        title: 'Save Error',
        message: err.message,
        error: err,
        retryable: true,
        onRetry: () => handleSave(data)
      });
    }
  }
};
```

### Background Task
```tsx
const handleProcessing = async () => {
  const id = showInfo('Processing...', 'This may take a while', 0);

  try {
    await longRunningTask();
    dismissToast(id);
    showSuccess('Complete', 'Processing finished');
  } catch (err) {
    dismissToast(id);
    showError('Processing Failed', err.message);
  }
};
```

## Decision Tree

**When to use what?**

```
User action succeeds
├─ Quick confirmation needed? → Success Toast
└─ No feedback needed? → Nothing

User action fails
├─ Minor/validation error? → Warning Toast
├─ Network/retryable error? → Error Toast + Retry action
├─ Critical/unexpected error? → Error Modal
└─ App crash? → Error Boundary (automatic)

Background job fails
└─ Show in Failed Jobs Panel

Long-running operation
├─ Started → Info Toast (no auto-dismiss)
├─ Complete → Dismiss + Success Toast
└─ Failed → Dismiss + Error Toast/Modal
```

## Styling

All components use theme variables:

```css
--decant-green        /* Success */
--decant-gray-*       /* Text/borders */
--decant-brand-*      /* Primary actions */
```

## Keyboard Shortcuts

- **Escape** - Close modals/toasts
- **Tab** - Navigate modal buttons
- **Enter** - Activate focused button
- **X button** - Dismiss toast

## Accessibility

- All components have ARIA labels
- Toasts use `aria-live` regions
- Modals trap focus
- Keyboard navigation supported
- WCAG AA compliant

## Performance Tips

1. **Limit toasts** - Max 5 shown at once
2. **Use auto-dismiss** - Prevent memory leaks
3. **Batch notifications** - Group similar messages
4. **Lazy load modals** - Only render when open
5. **Dismiss on unmount** - Clean up in useEffect

```tsx
useEffect(() => {
  const id = showInfo('Component loaded');
  return () => dismissToast(id);
}, []);
```

## Testing

```tsx
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@/context/ToastContext';

test('shows toast', () => {
  const Component = () => {
    const { showSuccess } = useToast();
    return <button onClick={() => showSuccess('Test')}>Click</button>;
  };

  render(
    <ToastProvider>
      <Component />
    </ToastProvider>
  );

  fireEvent.click(screen.getByText('Click'));
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

## Examples

See these files for complete examples:
- `NotificationDemo.tsx` - Interactive demo
- `NotificationIntegration.tsx` - AppContext integration
- `USAGE.md` - Detailed guide

## Files Created

| Component | Path |
|-----------|------|
| Toast | `src/renderer/components/notifications/Toast.tsx` |
| Toast Container | `src/renderer/components/notifications/ToastContainer.tsx` |
| Toast Context | `src/renderer/context/ToastContext.tsx` |
| Error Modal | `src/renderer/components/dialogs/ErrorModal.tsx` |
| Failed Jobs | `src/renderer/components/admin/FailedJobsPanel.tsx` |
| Error Boundary | `src/renderer/components/ErrorBoundary.tsx` |
| Hook | `src/renderer/hooks/useToast.ts` |

## Support

For detailed documentation, see:
- `README.md` - Component overview
- `USAGE.md` - Usage guide
- `NOTIFICATION_SYSTEM_SUMMARY.md` - Implementation summary
