// ============================================================
// BatchUrlInput Component
// Left panel with URL textarea and line numbers
// ============================================================

import React, { useRef, useEffect } from 'react';

interface BatchUrlInputProps {
  urlText: string;
  onUrlTextChange: (text: string) => void;
  validUrlCount: number;
  disabled: boolean;
}

export function BatchUrlInput({
  urlText,
  onUrlTextChange,
  validUrlCount,
  disabled,
}: BatchUrlInputProps): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount when not disabled
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // Calculate line numbers
  const lines = urlText.split('\n');
  const lineCount = Math.max(lines.length, 5); // Minimum 5 lines

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onUrlTextChange(urlText + (urlText && !urlText.endsWith('\n') ? '\n' : '') + text);
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
  };

  const handleClear = () => {
    onUrlTextChange('');
  };

  return (
    <div className="batch-url-input">
      <div className="batch-url-input-header">
        <label className="batch-url-input-label">URLs to Import</label>
        <div className="batch-url-input-actions">
          <button
            type="button"
            className="batch-url-action-btn"
            onClick={handleClear}
            disabled={disabled || !urlText}
            title="Clear all"
          >
            Clear
          </button>
          <button
            type="button"
            className="batch-url-action-btn batch-url-action-btn--primary"
            onClick={handlePaste}
            disabled={disabled}
            title="Paste from clipboard"
          >
            Add more
          </button>
        </div>
      </div>

      <div className="batch-url-input-container">
        {/* Line numbers */}
        <div className="batch-url-line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="batch-url-line-number">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="batch-url-textarea"
          value={urlText}
          onChange={(e) => onUrlTextChange(e.target.value)}
          placeholder={`Paste URLs here, one per line...

https://github.com/example/repo
https://docs.example.com/guide
https://medium.com/@author/article`}
          disabled={disabled}
          spellCheck={false}
          aria-label="URLs to import, one per line"
        />
      </div>

      <div className="batch-url-input-footer">
        <span className={`batch-url-count ${validUrlCount > 0 ? 'valid' : ''}`}>
          {validUrlCount > 0 ? (
            <>
              <CheckIcon /> {validUrlCount} valid URL{validUrlCount !== 1 ? 's' : ''}
            </>
          ) : (
            'No valid URLs detected'
          )}
        </span>
      </div>

      <style>{`
        .batch-url-input {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 300px;
        }

        .batch-url-input-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-sm) 0;
          margin-bottom: var(--space-sm);
        }

        .batch-url-input-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          color: var(--gum-black);
        }

        .batch-url-input-actions {
          display: flex;
          gap: var(--space-xs);
        }

        .batch-url-action-btn {
          padding: var(--space-xs) var(--space-sm);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          border: 1px solid var(--gum-gray-300);
          border-radius: var(--border-radius);
          background: var(--gum-white);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .batch-url-action-btn:hover:not(:disabled) {
          background: var(--gum-gray-100);
        }

        .batch-url-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .batch-url-action-btn--primary {
          background: var(--gum-green);
          border-color: var(--gum-black);
          color: var(--gum-black);
        }

        .batch-url-action-btn--primary:hover:not(:disabled) {
          background: #1db85f;
        }

        .batch-url-input-container {
          flex: 1;
          display: flex;
          border: var(--border-width) solid var(--gum-black);
          border-radius: var(--border-radius);
          overflow: hidden;
          background: var(--gum-white);
          min-height: 200px;
        }

        .batch-url-line-numbers {
          width: 40px;
          padding: var(--space-sm) var(--space-xs);
          background: var(--gum-gray-100);
          border-right: 1px solid var(--gum-gray-200);
          font-family: var(--font-mono);
          font-size: var(--font-size-sm);
          color: var(--gum-gray-500);
          user-select: none;
          overflow: hidden;
        }

        .batch-url-line-number {
          height: 1.5em;
          line-height: 1.5em;
          text-align: right;
          padding-right: var(--space-xs);
        }

        .batch-url-textarea {
          flex: 1;
          padding: var(--space-sm);
          border: none;
          outline: none;
          font-family: var(--font-mono);
          font-size: var(--font-size-sm);
          line-height: 1.5em;
          resize: none;
          background: var(--gum-white);
          color: var(--gum-black);
        }

        .batch-url-textarea::placeholder {
          color: var(--gum-gray-400);
        }

        .batch-url-textarea:disabled {
          background: var(--gum-gray-50);
          color: var(--gum-gray-600);
        }

        .batch-url-input-footer {
          padding: var(--space-sm) 0;
          margin-top: var(--space-sm);
        }

        .batch-url-count {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          font-size: var(--font-size-sm);
          color: var(--gum-gray-500);
        }

        .batch-url-count.valid {
          color: var(--gum-green);
        }

        .batch-url-count svg {
          width: 14px;
          height: 14px;
        }
      `}</style>
    </div>
  );
}

// Check icon component
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default BatchUrlInput;
