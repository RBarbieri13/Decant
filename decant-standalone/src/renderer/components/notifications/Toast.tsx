// ============================================================
// Toast Component - Individual notification
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import './Toast.css';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // Auto-dismiss time in ms (0 = no auto-dismiss)
  action?: ToastAction;
  onDismiss: () => void;
}

/**
 * Toast Component
 *
 * Individual notification with auto-dismiss timer, icon, and optional action button.
 * Supports four types: success, error, warning, info
 *
 * @example
 * <Toast
 *   id="toast-1"
 *   type="success"
 *   title="Import successful"
 *   message="React Component Library imported"
 *   duration={5000}
 *   onDismiss={() => handleDismiss('toast-1')}
 * />
 */
export function Toast({
  id,
  type,
  title,
  message,
  duration = 5000,
  action,
  onDismiss,
}: ToastProps): React.ReactElement {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration > 0) {
      // Start progress bar animation
      const startTime = Date.now();
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setProgress(remaining);
      }, 16); // ~60fps

      // Set auto-dismiss timer
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    // Wait for exit animation before calling onDismiss
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const handleActionClick = () => {
    if (action) {
      action.onClick();
      handleDismiss();
    }
  };

  // Icon mapping
  const icons = {
    success: 'bx-check-circle',
    error: 'bx-error-circle',
    warning: 'bx-error',
    info: 'bx-info-circle',
  };

  return (
    <div
      className={`decant-toast decant-toast--${type} ${isExiting ? 'decant-toast--exiting' : ''}`}
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      {/* Icon */}
      <div className={`decant-toast__icon decant-toast__icon--${type}`}>
        <i className={`bx ${icons[type]}`} />
      </div>

      {/* Content */}
      <div className="decant-toast__content">
        <div className="decant-toast__title">{title}</div>
        {message && <div className="decant-toast__message">{message}</div>}
      </div>

      {/* Action button (optional) */}
      {action && (
        <button
          className="decant-toast__action"
          onClick={handleActionClick}
          type="button"
        >
          {action.label}
        </button>
      )}

      {/* Close button */}
      <button
        className="decant-toast__close"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        type="button"
      >
        <i className="bx bx-x" />
      </button>

      {/* Progress bar for auto-dismiss */}
      {duration > 0 && (
        <div className="decant-toast__progress">
          <div
            className="decant-toast__progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
