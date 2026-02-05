/**
 * AI Import Client Examples
 *
 * This file demonstrates how to use the AI Import API from the frontend.
 * These functions can be integrated into Trilium's client-side code.
 */

/**
 * Type definitions for AI Import API
 */
interface AIImportOptions {
    spaceId?: string;
    collectionId?: string;
    skipCategorization?: boolean;
    title?: string;
}

interface AutoCategorizationResult {
    suggestedSpaceId: string | null;
    suggestedSpaceName: string;
    suggestedCollectionId: string | null;
    suggestedCollectionName: string;
    createNewCollection: boolean;
    newCollectionName?: string;
    contentType: string;
    suggestedTags: string[];
    summary: string;
    keyPoints: string[];
    confidence: number;
}

interface AIImportResult {
    success: boolean;
    noteId: string;
    spaceId: string;
    spaceName: string;
    collectionId: string;
    collectionName: string;
    categorization: AutoCategorizationResult;
    processingTimeMs: number;
    error?: string;
}

/**
 * Import a URL with AI categorization
 */
export async function importUrl(
    url: string,
    options: AIImportOptions = {}
): Promise<AIImportResult> {
    const response = await fetch('/api/ai-import', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url,
            options
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

/**
 * Check if AI Import service is available
 */
export async function checkServiceStatus(): Promise<{
    available: boolean;
    message: string;
}> {
    const response = await fetch('/api/ai-import/status');

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

/**
 * Example 1: Basic Import
 * Import a URL and let AI decide where to place it
 */
export async function example1_BasicImport() {
    console.log('Example 1: Basic Import with AI Categorization');

    const url = 'https://github.com/trilium-next/notes';

    try {
        const result = await importUrl(url);

        if (result.success) {
            console.log(`✓ Successfully imported: ${result.noteId}`);
            console.log(`  Space: ${result.spaceName}`);
            console.log(`  Collection: ${result.collectionName}`);
            console.log(`  Content Type: ${result.categorization.contentType}`);
            console.log(`  Confidence: ${result.categorization.confidence}`);
            console.log(`  Tags: ${result.categorization.suggestedTags.join(', ')}`);
            console.log(`  Summary: ${result.categorization.summary}`);
        } else {
            console.error(`✗ Import failed: ${result.error}`);
        }
    } catch (error) {
        console.error('Error during import:', error);
    }
}

/**
 * Example 2: Import with Custom Title
 */
export async function example2_CustomTitle() {
    console.log('Example 2: Import with Custom Title');

    const url = 'https://example.com/article';
    const customTitle = 'My Favorite Article on TypeScript';

    try {
        const result = await importUrl(url, {
            title: customTitle
        });

        if (result.success) {
            console.log(`✓ Imported with custom title: ${result.noteId}`);
        }
    } catch (error) {
        console.error('Error during import:', error);
    }
}

/**
 * Example 3: Import to Specific Location
 */
export async function example3_SpecificLocation(
    spaceId: string,
    collectionId: string
) {
    console.log('Example 3: Import to Specific Location');

    const url = 'https://example.com/tutorial';

    try {
        const result = await importUrl(url, {
            spaceId,
            collectionId,
            skipCategorization: true
        });

        if (result.success) {
            console.log(`✓ Imported to specified location: ${result.noteId}`);
            console.log(`  Processing time: ${result.processingTimeMs}ms`);
        }
    } catch (error) {
        console.error('Error during import:', error);
    }
}

/**
 * Example 4: Batch Import Multiple URLs
 */
export async function example4_BatchImport(urls: string[]) {
    console.log('Example 4: Batch Import Multiple URLs');

    const results = await Promise.allSettled(
        urls.map(url => importUrl(url))
    );

    let successCount = 0;
    let failCount = 0;

    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
            console.log(`✓ [${index + 1}/${urls.length}] Imported: ${result.value.noteId}`);
        } else {
            failCount++;
            console.error(`✗ [${index + 1}/${urls.length}] Failed: ${urls[index]}`);
        }
    });

    console.log(`\nBatch complete: ${successCount} succeeded, ${failCount} failed`);
}

/**
 * Example 5: Import with Progress Callback
 */
export async function example5_ImportWithProgress(
    url: string,
    onProgress: (stage: string, progress: number) => void
) {
    console.log('Example 5: Import with Progress Tracking');

    onProgress('Starting import...', 0);

    try {
        onProgress('Analyzing URL...', 25);

        const result = await importUrl(url);

        if (result.success) {
            onProgress('Creating note...', 75);
            onProgress('Complete!', 100);

            console.log(`✓ Import complete: ${result.noteId}`);
            return result;
        } else {
            onProgress('Failed', 0);
            throw new Error(result.error);
        }
    } catch (error) {
        onProgress('Error occurred', 0);
        console.error('Import failed:', error);
        throw error;
    }
}

/**
 * Example 6: Check Service Health Before Import
 */
export async function example6_HealthCheck() {
    console.log('Example 6: Check Service Health');

    try {
        const status = await checkServiceStatus();

        if (status.available) {
            console.log('✓ AI Import service is available');
            console.log(`  Message: ${status.message}`);
            return true;
        } else {
            console.warn('⚠ AI Import service is not available');
            return false;
        }
    } catch (error) {
        console.error('Error checking service status:', error);
        return false;
    }
}

/**
 * Example 7: Import with Error Handling and Retry
 */
export async function example7_ImportWithRetry(
    url: string,
    maxRetries: number = 3
): Promise<AIImportResult> {
    console.log('Example 7: Import with Retry Logic');

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${maxRetries}...`);

            const result = await importUrl(url);

            if (result.success) {
                console.log(`✓ Succeeded on attempt ${attempt}`);
                return result;
            } else {
                lastError = new Error(result.error);
                console.warn(`⚠ Attempt ${attempt} failed: ${result.error}`);
            }
        } catch (error) {
            lastError = error as Error;
            console.warn(`⚠ Attempt ${attempt} threw error:`, error);
        }

        if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('Import failed after all retries');
}

/**
 * Example 8: UI Integration - Complete Workflow
 */
export async function example8_UIWorkflow(
    url: string,
    updateUI: (state: string, data?: any) => void
) {
    console.log('Example 8: Complete UI Workflow');

    try {
        // 1. Validate URL
        updateUI('validating');
        if (!url || !url.startsWith('http')) {
            throw new Error('Invalid URL');
        }

        // 2. Check service availability
        updateUI('checking-service');
        const status = await checkServiceStatus();
        if (!status.available) {
            throw new Error('AI Import service is not available');
        }

        // 3. Start import
        updateUI('importing');
        const result = await importUrl(url);

        // 4. Handle result
        if (result.success) {
            updateUI('success', {
                noteId: result.noteId,
                space: result.spaceName,
                collection: result.collectionName,
                summary: result.categorization.summary,
                tags: result.categorization.suggestedTags
            });

            return result;
        } else {
            throw new Error(result.error || 'Import failed');
        }
    } catch (error) {
        updateUI('error', {
            message: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

/**
 * Example 9: Extract Import Statistics
 */
export async function example9_ImportStatistics(
    results: AIImportResult[]
) {
    console.log('Example 9: Import Statistics');

    const stats = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        averageTime: 0,
        contentTypes: {} as Record<string, number>,
        spaces: {} as Record<string, number>,
        collections: {} as Record<string, number>,
        averageConfidence: 0
    };

    let totalTime = 0;
    let totalConfidence = 0;

    results.forEach(result => {
        if (result.success) {
            totalTime += result.processingTimeMs;
            totalConfidence += result.categorization.confidence;

            const contentType = result.categorization.contentType;
            stats.contentTypes[contentType] = (stats.contentTypes[contentType] || 0) + 1;

            stats.spaces[result.spaceName] = (stats.spaces[result.spaceName] || 0) + 1;
            stats.collections[result.collectionName] = (stats.collections[result.collectionName] || 0) + 1;
        }
    });

    stats.averageTime = stats.successful > 0 ? totalTime / stats.successful : 0;
    stats.averageConfidence = stats.successful > 0 ? totalConfidence / stats.successful : 0;

    console.log('Statistics:', stats);
    return stats;
}

/**
 * Example 10: Create Import Widget
 */
export function example10_CreateImportWidget(): HTMLElement {
    console.log('Example 10: Create Import Widget');

    const widget = document.createElement('div');
    widget.className = 'ai-import-widget';
    widget.innerHTML = `
        <div class="ai-import-widget-content">
            <h3>Import URL</h3>
            <input
                type="text"
                id="ai-import-url"
                placeholder="Enter URL to import..."
                class="form-control"
            />
            <button id="ai-import-btn" class="btn btn-primary">
                Import with AI
            </button>
            <div id="ai-import-status" class="ai-import-status"></div>
            <div id="ai-import-result" class="ai-import-result"></div>
        </div>
    `;

    const urlInput = widget.querySelector('#ai-import-url') as HTMLInputElement;
    const importBtn = widget.querySelector('#ai-import-btn') as HTMLButtonElement;
    const statusDiv = widget.querySelector('#ai-import-status') as HTMLDivElement;
    const resultDiv = widget.querySelector('#ai-import-result') as HTMLDivElement;

    importBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();

        if (!url) {
            statusDiv.textContent = 'Please enter a URL';
            statusDiv.className = 'ai-import-status error';
            return;
        }

        try {
            statusDiv.textContent = 'Importing...';
            statusDiv.className = 'ai-import-status loading';
            importBtn.disabled = true;

            const result = await importUrl(url);

            if (result.success) {
                statusDiv.textContent = 'Import successful!';
                statusDiv.className = 'ai-import-status success';

                resultDiv.innerHTML = `
                    <h4>Imported Note</h4>
                    <p><strong>Space:</strong> ${result.spaceName}</p>
                    <p><strong>Collection:</strong> ${result.collectionName}</p>
                    <p><strong>Content Type:</strong> ${result.categorization.contentType}</p>
                    <p><strong>Confidence:</strong> ${(result.categorization.confidence * 100).toFixed(0)}%</p>
                    <p><strong>Tags:</strong> ${result.categorization.suggestedTags.join(', ')}</p>
                    <a href="#root/${result.noteId}" class="btn btn-sm btn-secondary">View Note</a>
                `;
                resultDiv.style.display = 'block';

                urlInput.value = '';
            } else {
                throw new Error(result.error || 'Import failed');
            }
        } catch (error) {
            statusDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            statusDiv.className = 'ai-import-status error';
            resultDiv.style.display = 'none';
        } finally {
            importBtn.disabled = false;
        }
    });

    return widget;
}

// Export all examples
export default {
    importUrl,
    checkServiceStatus,
    example1_BasicImport,
    example2_CustomTitle,
    example3_SpecificLocation,
    example4_BatchImport,
    example5_ImportWithProgress,
    example6_HealthCheck,
    example7_ImportWithRetry,
    example8_UIWorkflow,
    example9_ImportStatistics,
    example10_CreateImportWidget
};
