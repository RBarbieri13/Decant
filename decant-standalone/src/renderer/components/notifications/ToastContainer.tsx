// ============================================================
// Toast Container - Manages toast stack
// ============================================================

import React from 'react';
import { Toast, ToastProps } from './Toast';
import './ToastContainer.css';

export interface ToastContainerProps {
  toasts: ToastProps[];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxToasts?: number;
}

/**
 * Toast Container Component
 *
 * Container that manages the display and positioning of multiple toast notifications.
 * Supports different positioning and limits the number of visible toasts.
 *
 * @example
 * <ToastContainer
 *   toasts={toasts}
 *   position="bottom-right"
 *   maxToasts={5}
 * />
 */
export function ToastContainer({
  toasts,
  position = 'bottom-right',
  maxToasts = 5,
}: ToastContainerProps): React.ReactElement {
  // Limit number of visible toasts
  const visibleToasts = toasts.slice(-maxToasts);

  if (visibleToasts.length === 0) {
    return <></>;
  }

  return (
    <div
      className={`decant-toast-container decant-toast-container--${position}`}
      aria-live="polite"
      aria-atomic="false"
    >
      {visibleToasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}
