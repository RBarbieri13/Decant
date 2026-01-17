/**
 * ImportModal - Batch URL import modal
 *
 * Allows users to import multiple URLs at once with space selection
 * and preview of detected content types.
 */

import { h, Fragment } from 'preact';
import { useState, useCallback, useMemo } from 'preact/hooks';
import type { Space, ContentType } from '../types';
import { CONTENT_TYPE_CONFIGS } from '../types/content';
import { isSystemSpace, SYSTEM_SPACES } from '../types/space';

interface ImportModalProps {
    onImport: (urls: string[], spaceId: string) => Promise<void>;
    onClose: () => void;
    spaces: Space[];
    defaultSpaceId: string;
}

interface ParsedUrl {
    url: string;
    valid: boolean;
    type: ContentType;
    domain: string;
}

export function ImportModal({
    onImport,
    onClose,
    spaces,
    defaultSpaceId,
}: ImportModalProps) {
    const [inputValue, setInputValue] = useState('');
    const [selectedSpaceId, setSelectedSpaceId] = useState(
        isSystemSpace(defaultSpaceId) ? '' : defaultSpaceId
    );
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Parse URLs from input
    const parsedUrls = useMemo((): ParsedUrl[] => {
        const lines = inputValue.split('\n').map(l => l.trim()).filter(Boolean);
        return lines.map(line => {
            try {
                const url = new URL(line);
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    throw new Error('Invalid protocol');
                }
                return {
                    url: url.href,
                    valid: true,
                    type: detectContentType(url.href),
                    domain: url.hostname.replace('www.', ''),
                };
            } catch {
                return {
                    url: line,
                    valid: false,
                    type: 'website' as ContentType,
                    domain: '',
                };
            }
        });
    }, [inputValue]);

    const validUrls = parsedUrls.filter(p => p.valid);
    const invalidUrls = parsedUrls.filter(p => !p.valid);

    // Count by type
    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        validUrls.forEach(p => {
            counts[p.type] = (counts[p.type] || 0) + 1;
        });
        return counts;
    }, [validUrls]);

    const handleImport = useCallback(async () => {
        if (validUrls.length === 0) return;

        setIsImporting(true);
        setError(null);

        try {
            const targetSpaceId = selectedSpaceId || SYSTEM_SPACES.INBOX;
            await onImport(
                validUrls.map(p => p.url),
                targetSpaceId
            );
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setIsImporting(false);
        }
    }, [validUrls, selectedSpaceId, onImport, onClose]);

    const handlePaste = useCallback((e: ClipboardEvent) => {
        // Allow default paste behavior
    }, []);

    // Close on escape
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    return (
        <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
            <div className="modal import-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <h2>
                        <i className="bx bx-import" /> Import URLs
                    </h2>
                    <button className="modal-close" onClick={onClose}>
                        <i className="bx bx-x" />
                    </button>
                </div>

                {/* Body */}
                <div className="modal-body">
                    {/* URL Input */}
                    <div className="import-input-section">
                        <label htmlFor="import-urls">
                            Paste URLs (one per line)
                        </label>
                        <textarea
                            id="import-urls"
                            className="import-textarea"
                            placeholder="https://example.com/article&#10;https://youtube.com/watch?v=...&#10;https://github.com/..."
                            value={inputValue}
                            onInput={(e) => setInputValue((e.target as HTMLTextAreaElement).value)}
                            onPaste={handlePaste}
                            rows={8}
                            autoFocus
                        />
                    </div>

                    {/* Space Selection */}
                    <div className="import-space-section">
                        <label htmlFor="import-space">Save to Space</label>
                        <select
                            id="import-space"
                            className="import-space-select"
                            value={selectedSpaceId}
                            onChange={(e) => setSelectedSpaceId((e.target as HTMLSelectElement).value)}
                        >
                            <option value="">Inbox</option>
                            {spaces.filter(s => !s.isArchived).map(space => (
                                <option key={space.id} value={space.id}>
                                    {space.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Preview */}
                    {parsedUrls.length > 0 && (
                        <div className="import-preview">
                            <h4>Preview ({validUrls.length} valid URLs)</h4>

                            {/* Type Summary */}
                            {Object.keys(typeCounts).length > 0 && (
                                <div className="type-summary">
                                    {Object.entries(typeCounts).map(([type, count]) => {
                                        const config = CONTENT_TYPE_CONFIGS[type as ContentType];
                                        return (
                                            <span
                                                key={type}
                                                className="type-badge"
                                                style={{ backgroundColor: config.color }}
                                            >
                                                <i className={`bx ${config.icon}`} />
                                                {count} {config.label}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {/* URL List */}
                            <div className="url-list">
                                {parsedUrls.slice(0, 10).map((p, i) => (
                                    <div
                                        key={i}
                                        className={`url-item ${p.valid ? 'valid' : 'invalid'}`}
                                    >
                                        {p.valid ? (
                                            <>
                                                <i
                                                    className={`bx ${CONTENT_TYPE_CONFIGS[p.type].icon}`}
                                                    style={{ color: CONTENT_TYPE_CONFIGS[p.type].color }}
                                                />
                                                <span className="url-domain">{p.domain}</span>
                                                <span className="url-path">{p.url}</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="bx bx-error" style={{ color: '#EF4444' }} />
                                                <span className="url-invalid">{p.url}</span>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {parsedUrls.length > 10 && (
                                    <div className="url-item more">
                                        +{parsedUrls.length - 10} more...
                                    </div>
                                )}
                            </div>

                            {/* Invalid URLs Warning */}
                            {invalidUrls.length > 0 && (
                                <div className="invalid-warning">
                                    <i className="bx bx-error-circle" />
                                    {invalidUrls.length} invalid URL{invalidUrls.length > 1 ? 's' : ''} will be skipped
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="import-error">
                            <i className="bx bx-error-circle" /> {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={isImporting}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleImport}
                        disabled={validUrls.length === 0 || isImporting}
                    >
                        {isImporting ? (
                            <>
                                <i className="bx bx-loader-alt spinning" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <i className="bx bx-import" />
                                Import {validUrls.length} URL{validUrls.length !== 1 ? 's' : ''}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Detect content type from URL
 */
function detectContentType(url: string): ContentType {
    const urlLower = url.toLowerCase();

    for (const [type, config] of Object.entries(CONTENT_TYPE_CONFIGS)) {
        if (type === 'website' || type === 'text') continue; // Skip defaults
        for (const pattern of config.patterns) {
            if (pattern.test(urlLower)) {
                return type as ContentType;
            }
        }
    }

    return 'website';
}

export default ImportModal;
