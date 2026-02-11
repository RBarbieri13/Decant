// ============================================================
// Decant App Root Component
// ============================================================

import React from 'react';
import DecantDemo from './decant-demo/DecantDemo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './context/ToastContext';
import { AppProvider } from './context/AppContext';

/**
 * Main App Component
 * Full Decant application with colorful table UI and batch import functionality
 */
function App(): React.ReactElement {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App Error:', error, errorInfo);
        // In production, send to error tracking service
      }}
    >
      <AppProvider>
        <ToastProvider>
          <DecantDemo />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
