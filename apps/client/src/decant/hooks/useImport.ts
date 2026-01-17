/**
 * useImport - Hook for URL import functionality
 *
 * Provides URL validation, content type detection, and import status tracking.
 */

import { useState, useCallback } from 'preact/hooks';
import type { ContentImportRequest, ContentImportResult, ContentType, BatchImportResult } from '../types';
import { contentDetector } from '../services/contentDetector';
import { contentImporter } from '../services/contentImporter';

interface ImportStatus {
    url: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    detectedType?: ContentType;
    result?: ContentImportResult;
    error?: string;
}

interface UseImportResult {
    importStatus: ImportStatus[];
    isImporting: boolean;
    progress: { current: number; total: number };
    importUrl: (url: string, options?: Partial<ContentImportRequest>) => Promise<ContentImportResult>;
    importUrls: (urls: string[], options?: Partial<ContentImportRequest>) => Promise<BatchImportResult>;
    validateUrl: (url: string) => { valid: boolean; error?: string };
    detectType: (url: string) => ContentType;
    clearStatus: () => void;
}

export function useImport(): UseImportResult {
    const [importStatus, setImportStatus] = useState<ImportStatus[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // Validate URL format
    const validateUrl = useCallback((url: string): { valid: boolean; error?: string } => {
        const trimmed = url.trim();

        if (!trimmed) {
            return { valid: false, error: 'URL is required' };
        }

        try {
            const parsed = new URL(trimmed);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return { valid: false, error: 'Only HTTP/HTTPS URLs are supported' };
            }
            return { valid: true };
        } catch {
            return { valid: false, error: 'Invalid URL format' };
        }
    }, []);

    // Detect content type from URL
    const detectType = useCallback((url: string): ContentType => {
        return contentDetector.detectFromUrl(url);
    }, []);

    // Import single URL
    const importUrl = useCallback(async (
        url: string,
        options?: Partial<ContentImportRequest>
    ): Promise<ContentImportResult> => {
        const validation = validateUrl(url);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const statusEntry: ImportStatus = {
            url,
            status: 'processing',
            detectedType: detectType(url),
        };

        setImportStatus(prev => [...prev, statusEntry]);
        setIsImporting(true);

        try {
            const result = await contentImporter.importUrl({
                url: url.trim(),
                ...options,
            });

            setImportStatus(prev =>
                prev.map(s =>
                    s.url === url
                        ? { ...s, status: result.success ? 'success' : 'error', result }
                        : s
                )
            );

            return result;
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Import failed';
            setImportStatus(prev =>
                prev.map(s =>
                    s.url === url
                        ? { ...s, status: 'error', error }
                        : s
                )
            );
            return { success: false, error };
        } finally {
            setIsImporting(false);
        }
    }, [validateUrl, detectType]);

    // Import multiple URLs
    const importUrls = useCallback(async (
        urls: string[],
        options?: Partial<ContentImportRequest>
    ): Promise<BatchImportResult> => {
        const validUrls = urls.filter(url => validateUrl(url).valid);

        if (validUrls.length === 0) {
            return { total: urls.length, successful: 0, failed: urls.length, results: [] };
        }

        // Initialize status for all URLs
        const initialStatus: ImportStatus[] = validUrls.map(url => ({
            url,
            status: 'pending',
            detectedType: detectType(url),
        }));

        setImportStatus(prev => [...prev, ...initialStatus]);
        setIsImporting(true);
        setProgress({ current: 0, total: validUrls.length });

        const results: ContentImportResult[] = [];
        let successful = 0;
        let failed = 0;

        for (let i = 0; i < validUrls.length; i++) {
            const url = validUrls[i];

            // Update status to processing
            setImportStatus(prev =>
                prev.map(s =>
                    s.url === url
                        ? { ...s, status: 'processing' }
                        : s
                )
            );

            try {
                const result = await contentImporter.importUrl({
                    url: url.trim(),
                    ...options,
                });

                results.push(result);

                if (result.success) {
                    successful++;
                } else {
                    failed++;
                }

                setImportStatus(prev =>
                    prev.map(s =>
                        s.url === url
                            ? { ...s, status: result.success ? 'success' : 'error', result }
                            : s
                    )
                );
            } catch (err) {
                const error = err instanceof Error ? err.message : 'Import failed';
                failed++;
                results.push({ success: false, error });

                setImportStatus(prev =>
                    prev.map(s =>
                        s.url === url
                            ? { ...s, status: 'error', error }
                            : s
                    )
                );
            }

            setProgress({ current: i + 1, total: validUrls.length });
        }

        setIsImporting(false);
        setProgress({ current: 0, total: 0 });

        return {
            total: urls.length,
            successful,
            failed: failed + (urls.length - validUrls.length),
            results,
        };
    }, [validateUrl, detectType]);

    // Clear import status
    const clearStatus = useCallback(() => {
        setImportStatus([]);
    }, []);

    return {
        importStatus,
        isImporting,
        progress,
        importUrl,
        importUrls,
        validateUrl,
        detectType,
        clearStatus,
    };
}

export default useImport;
