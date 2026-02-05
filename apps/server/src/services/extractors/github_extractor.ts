/**
 * GitHub Repository Extractor
 *
 * Extracts repository metadata and README using GitHub REST API v3.
 * Falls back to web scraping if API unavailable.
 */

import {
    type ContentExtractor,
    type ExtractorOptions,
    type ExtractorResult,
    type GitHubRepositoryMetadata,
    ExtractionErrorCode
} from './types.js';
import {
    createSuccessResult,
    createErrorResult,
    retryWithBackoff,
    isRetryableError
} from './base_extractor.js';
import log from '../log.js';

export class GitHubExtractor implements ContentExtractor {
    readonly contentType = 'github';
    readonly requiresApiKey = false;  // Works without auth, but with lower rate limits

    /**
     * Check if this extractor can handle the URL
     */
    canHandle(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname === 'github.com' && url.includes('/');
        } catch {
            return false;
        }
    }

    /**
     * Parse owner and repo from GitHub URL
     */
    private parseGitHubUrl(url: string): { owner: string; repo: string } | null {
        try {
            // Format: https://github.com/owner/repo
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(p => p);

            if (pathParts.length < 2) {
                return null;
            }

            return {
                owner: pathParts[0],
                repo: pathParts[1]
            };
        } catch {
            return null;
        }
    }

    /**
     * Extract repository metadata
     */
    async extract(url: string, options?: ExtractorOptions): Promise<ExtractorResult> {
        const startTime = Date.now();
        const parsed = this.parseGitHubUrl(url);

        if (!parsed) {
            return createErrorResult(
                ExtractionErrorCode.PARSING_ERROR,
                'Could not parse GitHub URL',
                false
            );
        }

        const { owner, repo } = parsed;

        try {
            // Try API extraction
            const result = await this.extractWithApi(owner, repo, options?.apiKeys?.github, startTime);
            if (result.success) {
                return result;
            }

            // If API failed but error is not recoverable, return error
            if (result.error && !result.error.recoverable) {
                return result;
            }

            log.info(`GitHub API extraction failed (${result.error?.code}), falling back to basic metadata`);
        } catch (error) {
            log.error('GitHub API extraction error:', error);
        }

        // Fallback to minimal metadata
        return this.extractWithFallback(owner, repo, startTime);
    }

    /**
     * Extract using GitHub REST API
     */
    private async extractWithApi(
        owner: string,
        repo: string,
        accessToken: string | undefined,
        startTime: number
    ): Promise<ExtractorResult> {
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Trilium-Notes-AI-Import'
        };

        if (accessToken) {
            headers['Authorization'] = `token ${accessToken}`;
        }

        try {
            // Fetch repository metadata
            const repoData = await retryWithBackoff(
                async () => {
                    const response = await fetch(
                        `https://api.github.com/repos/${owner}/${repo}`,
                        { headers }
                    );

                    if (!response.ok) {
                        const error: any = new Error(`GitHub API error: ${response.status}`);
                        error.status = response.status;
                        throw error;
                    }

                    return response.json();
                },
                3,
                isRetryableError
            );

            // Fetch README
            let readmeContent = '';
            try {
                const readmeResponse = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/readme`,
                    { headers }
                );

                if (readmeResponse.ok) {
                    const readmeData = await readmeResponse.json();
                    // README content is base64 encoded
                    readmeContent = Buffer.from(readmeData.content, 'base64').toString('utf-8');
                }
            } catch (error) {
                log.warn('Failed to fetch README:', error);
                // Continue without README
            }

            // Fetch language breakdown
            let languages: Record<string, number> = {};
            try {
                const langResponse = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/languages`,
                    { headers }
                );

                if (langResponse.ok) {
                    languages = await langResponse.json();
                }
            } catch (error) {
                log.warn('Failed to fetch languages:', error);
            }

            const processingTimeMs = Date.now() - startTime;

            return createSuccessResult(
                {
                    repoOwner: owner,
                    repoName: repo,
                    fullName: repoData.full_name,
                    description: repoData.description || '',
                    stars: repoData.stargazers_count || 0,
                    forks: repoData.forks_count || 0,
                    watchers: repoData.watchers_count || 0,
                    language: repoData.language || 'Unknown',
                    languages,
                    license: repoData.license?.name || repoData.license?.spdx_id || '',
                    topics: repoData.topics || [],
                    lastCommit: repoData.pushed_at || repoData.updated_at || '',
                    createdAt: repoData.created_at || '',
                    readme: readmeContent,
                    homepageUrl: repoData.homepage || '',
                    isArchived: repoData.archived || false,
                    isFork: repoData.fork || false,
                    defaultBranch: repoData.default_branch || 'main',
                    openIssues: repoData.open_issues_count || 0
                },
                {
                    extractionMethod: 'api_standard',
                    apiUsed: 'GitHub REST API v3',
                    confidence: 1.0,
                    cost: 0,  // Free (within rate limits)
                    processingTimeMs
                }
            );
        } catch (error: any) {
            // Map error types
            if (error.status === 403) {
                const rateLimitRemaining = error.headers?.get?.('X-RateLimit-Remaining');
                if (rateLimitRemaining === '0') {
                    return createErrorResult(
                        ExtractionErrorCode.RATE_LIMIT_EXCEEDED,
                        'GitHub API rate limit exceeded',
                        true,
                        error
                    );
                }
            }

            if (error.status === 401) {
                return createErrorResult(
                    ExtractionErrorCode.INVALID_API_KEY,
                    'Invalid GitHub access token',
                    false,
                    error
                );
            }

            if (error.status === 404) {
                return createErrorResult(
                    ExtractionErrorCode.CONTENT_NOT_FOUND,
                    'Repository not found or private',
                    false,
                    error
                );
            }

            return createErrorResult(
                ExtractionErrorCode.UNKNOWN_ERROR,
                `GitHub API extraction failed: ${error.message}`,
                true,
                error
            );
        }
    }

    /**
     * Fallback to basic metadata
     */
    private extractWithFallback(owner: string, repo: string, startTime: number): ExtractorResult {
        const processingTimeMs = Date.now() - startTime;

        return createSuccessResult(
            {
                repoOwner: owner,
                repoName: repo,
                fullName: `${owner}/${repo}`,
                description: '',
                readme: '',
                url: `https://github.com/${owner}/${repo}`
            },
            {
                extractionMethod: 'fallback',
                apiUsed: 'None',
                confidence: 0.3,
                processingTimeMs
            }
        );
    }

    /**
     * Validate GitHub API token
     */
    async validateApiKey(apiKey: string): Promise<boolean> {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${apiKey}`,
                    'User-Agent': 'Trilium-Notes-AI-Import'
                }
            });

            return response.ok;
        } catch (error) {
            log.error('GitHub API token validation failed:', error);
            return false;
        }
    }
}
