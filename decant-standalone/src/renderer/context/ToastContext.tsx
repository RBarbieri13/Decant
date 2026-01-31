// ============================================================
// Toast Context - Global toast notification management
// ============================================================

import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastProps, ToastAction } from '../components/notifications/Toast';

export interface ToastOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: ToastAction;
}

export interface ToastContextValue {
  toasts: ToastProps[];
  showToast: (options: ToastOptions) => string;
  showSuccess: (title: string, message?: string, duration?: number) => string;
  showError: (title: string, message?: string, action?: ToastAction, duration?: number) => string;
  showWarning: (title: string, message?: string, duration?: number) => string;
  showInfo: (title: string, message?: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

/**
 * Toast Provider Component
 *
 * Provides toast notification functionality to the entire app.
 * Manages toast state and provides helper methods for common toast types.
 *
 * @example
 * // Wrap your app
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 *
 * // Use in components
 * const { showSuccess, showError } = useToast();
 * showSuccess('Success!', 'Operation completed');
 * showError('Error!', 'Something went wrong', { label: 'Retry', onClick: retry });
 */
export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions): string => {
    const id = `toast-${++toastIdCounter}`;

    const toast: ToastProps = {
      id,
      type: options.type,
      title: options.title,
      message: options.message,
      duration: options.duration ?? 5000,
      action: options.action,
      onDismiss: () => dismissToast(id),
    };

    setToasts((prev) => [...prev, toast]);
    return id;
  }, [dismissToast]);

  const showSuccess = useCallback((title: string, message?: string, duration = 5000): string => {
    return showToast({ type: 'success', title, message, duration });
  }, [showToast]);

  const showError = useCallback((
    title: string,
    message?: string,
    action?: ToastAction,
    duration = 8000 // Errors stay longer by default
  ): string => {
    return showToast({ type: 'error', title, message, action, duration });
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string, duration = 6000): string => {
    return showToast({ type: 'warning', title, message, duration });
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string, duration = 5000): string => {
    return showToast({ type: 'info', title, message, duration });
  }, [showToast]);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value: ToastContextValue = {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissToast,
    dismissAll,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * useToast Hook
 *
 * Hook to access toast notification methods from any component.
 *
 * @example
 * const { showSuccess, showError, showWarning, showInfo } = useToast();
 *
 * // Show success
 * showSuccess('Saved!', 'Your changes have been saved');
 *
 * // Show error with retry action
 * showError('Failed to save', 'Network error', {
 *   label: 'Retry',
 *   onClick: () => saveAgain()
 * });
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
