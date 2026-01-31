// ============================================================
// Decant App Root Component
// ============================================================

import React from 'react';
import DecantDemo from './decant-demo/DecantDemo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/notifications/ToastContainer';
import { useToast } from './context/ToastContext';

/**
 * App Shell with Toast Container
 * Wraps the demo with toast notifications
 */
function AppShell(): React.ReactElement {
  const { toasts } = useToast();

  return (
    <>
      <DecantDemo />
      <ToastContainer toasts={toasts} position="bottom-right" maxToasts={5} />
    </>
  );
}

/**
 * Main App Component
 * Shows the Decant UI Demo with error boundary and toast notifications
 */
function App(): React.ReactElement {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App Error:', error, errorInfo);
        // In production, send to error tracking service
      }}
    >
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
