# Notification System Architecture

## Component Hierarchy

```
App.tsx
│
├─ ErrorBoundary (Catches React errors)
│  │
│  └─ ToastProvider (Global toast state)
│     │
│     ├─ AppShell
│     │  │
│     │  └─ Your App Components
│     │     │
│     │     ├─ Import Dialog
│     │     │  ├─ uses useToast()
│     │     │  └─ ErrorModal (conditional)
│     │     │
│     │     ├─ Data Table
│     │     │  └─ uses useToast()
│     │     │
│     │     └─ Admin Panel
│     │        └─ FailedJobsPanel
│     │
│     └─ ToastContainer (Fixed position)
│        │
│        └─ Toast[] (Max 5 visible)
│           ├─ Toast (Success)
│           ├─ Toast (Error with action)
│           └─ Toast (Info)
│
└─ On Error: Shows ErrorBoundary fallback UI
```

## State Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      ToastContext                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ State: toasts: ToastProps[]                          │  │
│  │                                                       │  │
│  │ Actions:                                             │  │
│  │  - showToast(options) → string (toast ID)           │  │
│  │  - showSuccess(title, msg) → string                 │  │
│  │  - showError(title, msg, action) → string           │  │
│  │  - showWarning(title, msg) → string                 │  │
│  │  - showInfo(title, msg) → string                    │  │
│  │  - dismissToast(id) → void                          │  │
│  │  - dismissAll() → void                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ useToast()
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Your Component                            │
│                                                              │
│  const { showSuccess, showError } = useToast();             │
│                                                              │
│  try {                                                       │
│    await api.save();                                        │
│    showSuccess('Saved!');  ─────┐                          │
│  } catch (err) {                 │                          │
│    showError('Failed', err); ───┼──┐                       │
│  }                               │  │                        │
└──────────────────────────────────┼──┼────────────────────────┘
                                   │  │
                        Add to     │  │  Add to
                        toasts[]   │  │  toasts[]
                                   │  │
                                   ▼  ▼
                          ┌─────────────────┐
                          │ ToastContainer  │
                          │  renders all    │
                          │  toasts[]       │
                          └─────────────────┘
                                   │
                          ┌────────┴────────┐
                          ▼                 ▼
                    ┌─────────┐       ┌─────────┐
                    │ Toast   │       │ Toast   │
                    │ Success │       │ Error   │
                    └─────────┘       └─────────┘
```

## Error Handling Flow

```
User Action
    │
    ├─ Success
    │  └─ showSuccess() → Toast (green, 5s)
    │
    └─ Error
       │
       ├─ Validation Error (expected)
       │  └─ showWarning() → Toast (yellow, 6s)
       │
       ├─ Network Error (retryable)
       │  └─ showError() + Retry Action → Toast (red, 8s)
       │
       ├─ Critical Error (unexpected)
       │  └─ ErrorModal → Modal Dialog
       │     ├─ Stack Trace (collapsible)
       │     ├─ Context Info
       │     ├─ Retry Button
       │     ├─ Copy Details
       │     └─ Report Issue
       │
       └─ React Render Error
          └─ ErrorBoundary → Full Page Fallback
             ├─ Error Icon
             ├─ Error Message
             ├─ Stack Trace (collapsible)
             ├─ Reload Button
             ├─ Go Home Button
             └─ Copy Error Button
```

## Data Flow for Import Operation

```
User clicks "Import URL"
        │
        ├─ Show progress toast (no auto-dismiss)
        │  showInfo('Importing...', url, 0) → toastId
        │
        ├─ Call API: importAPI.import(url)
        │     │
        │     ├─ SUCCESS
        │     │  ├─ dismissToast(toastId)
        │     │  ├─ showSuccess('Import Complete')
        │     │  └─ if phase2.queued:
        │     │     └─ showInfo('Enrichment Queued')
        │     │
        │     └─ ERROR
        │        ├─ dismissToast(toastId)
        │        │
        │        ├─ if validation error:
        │        │  └─ showWarning('Invalid URL')
        │        │
        │        ├─ if network error:
        │        │  └─ showError('Network Error', msg, {
        │        │       label: 'Retry',
        │        │       onClick: retry
        │        │     })
        │        │
        │        └─ if unexpected error:
        │           └─ setErrorModal({
        │                title: 'Import Failed',
        │                error: err,
        │                retryable: true
        │              })
        │
        └─ Phase 2 enrichment (background)
           │
           ├─ SUCCESS
           │  └─ Update node metadata silently
           │
           └─ FAILURE
              └─ Add to Failed Jobs Panel
                 ├─ User can view in admin panel
                 ├─ Retry individual job
                 └─ Bulk retry selected jobs
```

## Component Communication

```
┌────────────────────────────────────────────────────────┐
│                    Global Level                         │
│                                                         │
│  ErrorBoundary ──────┬────── Catches all React errors  │
│  (Class Component)   │                                  │
│                      │                                  │
│  ToastProvider ──────┼────── Provides toast methods    │
│  (Context)           │                                  │
└──────────────────────┼─────────────────────────────────┘
                       │
                       │ Used by ↓
                       │
┌──────────────────────┼─────────────────────────────────┐
│                      │  Component Level                 │
│                      │                                  │
│  YourComponent ──────┴────── useToast() hook            │
│                      │                                  │
│                      ├────── Local ErrorModal state     │
│                      │       (for critical errors)      │
│                      │                                  │
│                      └────── Can throw error            │
│                              (caught by ErrorBoundary)  │
└─────────────────────────────────────────────────────────┘
                       │
                       │ Renders ↓
                       │
┌──────────────────────┼─────────────────────────────────┐
│                      │  UI Level                        │
│                      │                                  │
│  ToastContainer ─────┴────── Renders toasts[]          │
│  (Fixed position)                                       │
│                                                         │
│  ErrorModal ────────────────── Renders on error        │
│  (Modal overlay)                                        │
│                                                         │
│  FailedJobsPanel ───────────── Admin view              │
│  (Full component)                                       │
└─────────────────────────────────────────────────────────┘
```

## File Dependencies

```
App.tsx
├── imports ErrorBoundary
├── imports ToastProvider
└── imports ToastContainer
    └── imports Toast

YourComponent.tsx
├── imports useToast (from hooks/useToast.ts)
│   └── re-exports from context/ToastContext.tsx
├── imports ErrorModal (optional)
└── imports FailedJobsPanel (admin only)

Toast.tsx
├── imports Toast.css
└── standalone component

ToastContainer.tsx
├── imports ToastContainer.css
├── imports Toast
└── manages toast array

ErrorModal.tsx
├── imports ErrorModal.css
└── standalone modal

FailedJobsPanel.tsx
├── imports FailedJobsPanel.css
└── standalone admin component

ErrorBoundary.tsx
├── imports ErrorBoundary.css
└── React.Component (class)
```

## Event Timeline

```
Time  │ Event                              │ Component          │ Action
──────┼────────────────────────────────────┼────────────────────┼─────────────
0ms   │ User clicks "Save"                 │ EditForm           │ Call handleSave()
      │                                    │                    │
10ms  │ Validation passes                  │ EditForm           │ Call api.save()
      │                                    │                    │
500ms │ Network request sent               │ API                │ POST /api/nodes
      │                                    │                    │
1500ms│ Response received (success)        │ API                │ Return data
      │                                    │                    │
1510ms│ Show success toast                 │ EditForm           │ showSuccess()
      │                                    │ ToastContext       │ Add to toasts[]
      │                                    │                    │
1520ms│ Toast renders                      │ ToastContainer     │ Render Toast
      │                                    │ Toast              │ Show animation
      │                                    │                    │
1530ms│ Start auto-dismiss timer           │ Toast              │ setTimeout(5000)
      │                                    │                    │
6530ms│ Auto-dismiss                       │ Toast              │ Exit animation
      │                                    │                    │
6830ms│ Remove from DOM                    │ Toast              │ onDismiss()
      │                                    │ ToastContext       │ Remove from toasts[]

Alternative: Error Case
──────┼────────────────────────────────────┼────────────────────┼─────────────
1500ms│ Response received (error 500)      │ API                │ Throw error
      │                                    │                    │
1510ms│ Catch error                        │ EditForm           │ catch (err)
      │                                    │                    │
1520ms│ Determine error type               │ EditForm           │ if (critical)
      │                                    │                    │
1530ms│ Set error modal state              │ EditForm           │ setError({...})
      │                                    │                    │
1540ms│ Error modal renders                │ ErrorModal         │ Show modal
      │                                    │                    │
5000ms│ User clicks "Retry"                │ ErrorModal         │ onRetry()
      │                                    │                    │
5010ms│ Retry operation                    │ EditForm           │ Call api.save()
      │                                    │                    │
6000ms│ Success                            │ API                │ Return data
      │                                    │                    │
6010ms│ Close modal, show success toast    │ EditForm           │ Modal close +
      │                                    │                    │ showSuccess()
```

## Memory Management

```
Toast Lifecycle
┌────────────────────────────────────────────────────────────┐
│ Created → Rendered → Visible → Auto-dismiss → Exit → Clean │
│    ↓         ↓         ↓           ↓          ↓       ↓    │
│   Add to  Animate  Progress    setTimeout   Animate Remove │
│  toasts[]    in      bar         (5000ms)     out   from   │
│                                                      array  │
└────────────────────────────────────────────────────────────┘

Max toasts = 5
├─ New toast added when stack is full
│  └─ Oldest toast is auto-dismissed
│
└─ On component unmount
   └─ All toasts dismissed (if created by component)

Error Modal Lifecycle
┌────────────────────────────────────────────┐
│ Triggered → Rendered → Visible → Dismissed │
│     ↓          ↓         ↓          ↓      │
│  setState   Mount    User sees   Unmount   │
│  (error)   modal     details   (cleanup)   │
└────────────────────────────────────────────┘

Only rendered when error state is set
└─ No memory leak - conditional render
```

## Performance Characteristics

| Component        | Render Time | Memory    | Re-renders        |
|------------------|-------------|-----------|-------------------|
| Toast            | <16ms       | ~50KB     | On timer update   |
| ToastContainer   | <10ms       | ~10KB     | On toasts[] change|
| ErrorModal       | <50ms       | ~100KB    | On open/close     |
| FailedJobsPanel  | <100ms      | ~200KB    | On data change    |
| ErrorBoundary    | <5ms        | ~20KB     | On error only     |

All components use:
- React.memo() for optimization
- useCallback() for event handlers
- useMemo() for computed values
- CSS transforms (GPU accelerated)
