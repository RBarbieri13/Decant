/**
 * QuickCapture - URL input component for quick content capture
 *
 * Provides a persistent input field for pasting URLs, with support
 * for drag-and-drop and batch import.
 */

import { h, Fragment } from 'preact';
import { useState, useCallback, useRef } from 'preact/hooks';

interface QuickCaptureProps {
    onCapture: (url: string) => Promise<void>;
    onBatchImport: () => void;
    disabled?: boolean;
}

type CaptureState = 'idle' | 'processing' | 'success' | 'error';

export function QuickCapture({
    onCapture,
    onBatchImport,
    disabled = false,
}: QuickCaptureProps) {
    const [inputValue, setInputValue] = useState('');
    const [state, setState] = useState<CaptureState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const isValidUrl = useCallback((str: string): boolean => {
        try {
            const url = new URL(str.trim());
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }, []);

    const handleCapture = useCallback(async (url: string) => {
        const trimmedUrl = url.trim();

        if (!trimmedUrl) return;

        if (!isValidUrl(trimmedUrl)) {
            setError('Please enter a valid URL');
            setState('error');
            setTimeout(() => {
                setState('idle');
                setError(null);
            }, 2000);
            return;
        }

        setState('processing');
        setError(null);

        try {
            await onCapture(trimmedUrl);
            setState('success');
            setInputValue('');
            setTimeout(() => setState('idle'), 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to capture');
            setState('error');
            setTimeout(() => {
                setState('idle');
                setError(null);
            }, 3000);
        }
    }, [isValidUrl, onCapture]);

    const handleSubmit = useCallback((e: Event) => {
        e.preventDefault();
        handleCapture(inputValue);
    }, [inputValue, handleCapture]);

    const handlePaste = useCallback((e: ClipboardEvent) => {
        const pastedText = e.clipboardData?.getData('text');
        if (pastedText && isValidUrl(pastedText)) {
            e.preventDefault();
            setInputValue(pastedText);
            // Auto-submit if pasting a valid URL
            handleCapture(pastedText);
        }
    }, [isValidUrl, handleCapture]);

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const text = e.dataTransfer?.getData('text/plain') ||
                     e.dataTransfer?.getData('text/uri-list');

        if (text) {
            // Handle multiple URLs (one per line)
            const urls = text.split('\n').filter(line => isValidUrl(line.trim()));
            if (urls.length === 1) {
                handleCapture(urls[0]);
            } else if (urls.length > 1) {
                // For multiple URLs, trigger batch import
                setInputValue(urls.join('\n'));
                onBatchImport();
            }
        }
    }, [isValidUrl, handleCapture, onBatchImport]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setInputValue('');
            inputRef.current?.blur();
        }
    }, []);

    const stateClasses = [
        'quick-capture',
        state !== 'idle' && `state-${state}`,
        isDragOver && 'drag-over',
        disabled && 'disabled',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={stateClasses}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <form onSubmit={handleSubmit} className="capture-form">
                <div className="capture-icon">
                    {state === 'processing' ? (
                        <i className="bx bx-loader-alt spinning" />
                    ) : state === 'success' ? (
                        <i className="bx bx-check" />
                    ) : state === 'error' ? (
                        <i className="bx bx-x" />
                    ) : (
                        <i className="bx bx-link" />
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    className="capture-input"
                    placeholder="Paste a URL to capture (⌘K)"
                    value={inputValue}
                    onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || state === 'processing'}
                    autoComplete="off"
                    spellCheck={false}
                />

                {inputValue && (
                    <button
                        type="button"
                        className="capture-clear"
                        onClick={() => setInputValue('')}
                        title="Clear"
                    >
                        <i className="bx bx-x" />
                    </button>
                )}

                <button
                    type="submit"
                    className="capture-submit"
                    disabled={!inputValue || disabled || state === 'processing'}
                >
                    {state === 'processing' ? 'Saving...' : 'Save'}
                </button>

                <button
                    type="button"
                    className="capture-batch"
                    onClick={onBatchImport}
                    title="Import multiple URLs"
                >
                    <i className="bx bx-import" />
                </button>
            </form>

            {error && (
                <div className="capture-error">
                    {error}
                </div>
            )}

            {isDragOver && (
                <div className="capture-drop-overlay">
                    <i className="bx bx-link-external" />
                    <span>Drop to capture</span>
                </div>
            )}
        </div>
    );
}

export default QuickCapture;
