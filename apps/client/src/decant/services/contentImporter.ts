/**
 * ContentImporter - Service for importing and managing content items
 *
 * Handles URL fetching, metadata extraction, and content storage.
 */

import type {
    ContentItem,
    ContentImportRequest,
    ContentImportResult,
    ContentMetadata,
    ContentType,
} from '../types';
import { contentDetector } from './contentDetector';
import { SYSTEM_SPACES } from '../types/space';

/**
 * ContentImporter class for importing URLs and managing content
 */
class ContentImporter {
    private baseUrl = '/api/decant';
    private itemsCache: Map<string, ContentItem[]> = new Map();

    /**
     * Import a single URL
     */
    async importUrl(request: ContentImportRequest): Promise<ContentImportResult> {
        try {
            const response = await fetch(`${this.baseUrl}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                // If API doesn't exist yet, create mock item
                if (response.status === 404) {
                    return this.createMockImport(request);
                }
                throw new Error(`Import failed: ${response.statusText}`);
            }

            const result = await response.json();
            this.invalidateCache();
            return result;
        } catch (error) {
            console.warn('Using mock import due to API error:', error);
            return this.createMockImport(request);
        }
    }

    /**
     * Get all content items
     */
    async getAllItems(): Promise<ContentItem[]> {
        try {
            const response = await fetch(`${this.baseUrl}/items`);

            if (!response.ok) {
                if (response.status === 404) {
                    return this.getDemoItems();
                }
                throw new Error(`Failed to fetch items: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.warn('Using demo items due to API error:', error);
            return this.getDemoItems();
        }
    }

    /**
     * Get items for a specific space
     */
    async getItemsBySpace(spaceId: string): Promise<ContentItem[]> {
        try {
            const response = await fetch(`${this.baseUrl}/spaces/${spaceId}/items`);

            if (!response.ok) {
                if (response.status === 404) {
                    return this.getDemoItems().filter(i => i.spaceId === spaceId);
                }
                throw new Error(`Failed to fetch items: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.warn('Using demo items due to API error:', error);
            return this.getDemoItems().filter(i => i.spaceId === spaceId);
        }
    }

    /**
     * Get recent items
     */
    async getRecentItems(limit: number = 50): Promise<ContentItem[]> {
        const items = await this.getAllItems();
        return items
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit);
    }

    /**
     * Get favorite (pinned) items
     */
    async getFavoriteItems(): Promise<ContentItem[]> {
        const items = await this.getAllItems();
        return items.filter(i => i.isPinned);
    }

    /**
     * Get inbox items
     */
    async getInboxItems(): Promise<ContentItem[]> {
        const items = await this.getAllItems();
        return items.filter(i => i.spaceId === SYSTEM_SPACES.INBOX || !i.spaceId);
    }

    /**
     * Get archived items
     */
    async getArchivedItems(): Promise<ContentItem[]> {
        const items = await this.getAllItems();
        return items.filter(i => i.isArchived);
    }

    /**
     * Move item to a different space
     */
    async moveItem(itemId: string, targetSpaceId: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/items/${itemId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetSpaceId }),
            });

            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to move item: ${response.statusText}`);
            }

            this.invalidateCache();
        } catch (error) {
            console.error('Failed to move item:', error);
        }
    }

    /**
     * Delete an item
     */
    async deleteItem(itemId: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/items/${itemId}`, {
                method: 'DELETE',
            });

            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to delete item: ${response.statusText}`);
            }

            this.invalidateCache();
        } catch (error) {
            console.error('Failed to delete item:', error);
        }
    }

    /**
     * Update an item
     */
    async updateItem(itemId: string, data: Partial<ContentItem>): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to update item: ${response.statusText}`);
            }

            this.invalidateCache();
        } catch (error) {
            console.error('Failed to update item:', error);
        }
    }

    /**
     * Invalidate cache
     */
    private invalidateCache(): void {
        this.itemsCache.clear();
    }

    // ============================================================
    // Demo/Mock Data Methods (used before backend is implemented)
    // ============================================================

    private createMockImport(request: ContentImportRequest): ContentImportResult {
        const url = request.url;
        const type = contentDetector.detectFromUrl(url);

        let domain: string;
        try {
            domain = new URL(url).hostname.replace('www.', '');
        } catch {
            domain = 'unknown';
        }

        const metadata: ContentMetadata = {
            title: request.manualTitle || this.generateMockTitle(url, type),
            description: 'Imported content awaiting AI processing...',
            domain,
            favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
            thumbnail: this.getMockThumbnail(type, url),
        };

        const item: ContentItem = {
            id: `item-${Date.now()}`,
            noteId: `note-${Date.now()}`,
            type,
            sourceUrl: url,
            metadata,
            aiAnalysis: {
                summary: 'AI summary pending...',
                keyPoints: [],
                tags: request.manualTags || this.getMockTags(type),
                suggestedCategory: 'Inbox',
                relatedTopics: [],
                confidence: 0,
                processedAt: new Date().toISOString(),
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            spaceId: request.spaceId || SYSTEM_SPACES.INBOX,
            position: 0,
            isArchived: false,
            isPinned: false,
        };

        return {
            success: true,
            contentItem: item,
        };
    }

    private generateMockTitle(url: string, type: ContentType): string {
        const domain = new URL(url).hostname.replace('www.', '');

        switch (type) {
            case 'youtube':
                return 'YouTube Video';
            case 'article':
                return `Article from ${domain}`;
            case 'podcast':
                return 'Podcast Episode';
            case 'paper':
                return 'Research Paper';
            case 'tool':
                return `${domain} - Tool`;
            case 'image':
                return 'Image';
            default:
                return domain;
        }
    }

    private getMockThumbnail(type: ContentType, url: string): string | undefined {
        // For YouTube, we could extract video ID and use thumbnail
        if (type === 'youtube') {
            const videoIdMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            if (videoIdMatch) {
                return `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`;
            }
        }

        // For other types, return undefined (will use fallback)
        return undefined;
    }

    private getMockTags(type: ContentType): string[] {
        const tagsByType: Record<ContentType, string[]> = {
            youtube: ['video', 'tutorial'],
            article: ['article', 'reading'],
            podcast: ['podcast', 'audio'],
            paper: ['research', 'academic'],
            tool: ['tool', 'software'],
            image: ['image', 'visual'],
            file: ['file', 'download'],
            text: ['note', 'text'],
            website: ['website', 'reference'],
        };

        return tagsByType[type] || ['imported'];
    }

    private getDemoItems(): ContentItem[] {
        return [
            {
                id: 'demo-item-1',
                noteId: 'demo-note-1',
                type: 'article',
                sourceUrl: 'https://example.com/great-article',
                metadata: {
                    title: 'The Complete Guide to Modern Web Development',
                    description: 'An in-depth exploration of modern web development practices, tools, and frameworks.',
                    domain: 'example.com',
                    favicon: 'https://www.google.com/s2/favicons?domain=example.com&sz=64',
                    thumbnail: 'https://picsum.photos/seed/1/400/300',
                    author: 'John Developer',
                },
                aiAnalysis: {
                    summary: 'A comprehensive guide covering React, TypeScript, and modern build tools for web developers.',
                    keyPoints: ['React best practices', 'TypeScript integration', 'Modern tooling'],
                    tags: ['webdev', 'react', 'typescript', 'tutorial'],
                    suggestedCategory: 'Learning',
                    relatedTopics: ['Frontend', 'JavaScript'],
                    confidence: 0.92,
                    processedAt: new Date().toISOString(),
                },
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                updatedAt: new Date(Date.now() - 86400000).toISOString(),
                spaceId: 'demo-2',
                position: 0,
                isArchived: false,
                isPinned: true,
            },
            {
                id: 'demo-item-2',
                noteId: 'demo-note-2',
                type: 'youtube',
                sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                metadata: {
                    title: 'Advanced TypeScript Patterns',
                    description: 'Learn advanced TypeScript patterns for large-scale applications.',
                    domain: 'youtube.com',
                    favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
                    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                    duration: '45:32',
                },
                aiAnalysis: {
                    summary: 'Deep dive into TypeScript generics, conditional types, and utility types.',
                    keyPoints: ['Generics', 'Conditional types', 'Utility types'],
                    tags: ['typescript', 'programming', 'tutorial'],
                    suggestedCategory: 'Learning',
                    relatedTopics: ['TypeScript', 'Programming'],
                    confidence: 0.88,
                    processedAt: new Date().toISOString(),
                },
                createdAt: new Date(Date.now() - 172800000).toISOString(),
                updatedAt: new Date(Date.now() - 172800000).toISOString(),
                spaceId: 'demo-2',
                position: 1,
                isArchived: false,
                isPinned: false,
            },
            {
                id: 'demo-item-3',
                noteId: 'demo-note-3',
                type: 'tool',
                sourceUrl: 'https://github.com/example/awesome-project',
                metadata: {
                    title: 'Awesome Project - GitHub',
                    description: 'An awesome open-source project for developers.',
                    domain: 'github.com',
                    favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
                    thumbnail: 'https://picsum.photos/seed/3/400/300',
                },
                aiAnalysis: {
                    summary: 'Open-source developer tool with great documentation and active community.',
                    keyPoints: ['Open source', 'Developer tool', 'Active community'],
                    tags: ['github', 'opensource', 'tool'],
                    suggestedCategory: 'Work Projects',
                    relatedTopics: ['Development', 'Open Source'],
                    confidence: 0.85,
                    processedAt: new Date().toISOString(),
                },
                createdAt: new Date(Date.now() - 259200000).toISOString(),
                updatedAt: new Date(Date.now() - 259200000).toISOString(),
                spaceId: 'demo-1',
                position: 0,
                isArchived: false,
                isPinned: false,
            },
            {
                id: 'demo-item-4',
                noteId: 'demo-note-4',
                type: 'paper',
                sourceUrl: 'https://arxiv.org/abs/2301.00000',
                metadata: {
                    title: 'Attention Is All You Need: Revisited',
                    description: 'A revisitation of the transformer architecture and its modern applications.',
                    domain: 'arxiv.org',
                    favicon: 'https://www.google.com/s2/favicons?domain=arxiv.org&sz=64',
                    author: 'Research Team',
                    pageCount: 15,
                },
                aiAnalysis: {
                    summary: 'Academic paper exploring recent advances in transformer architectures for NLP and beyond.',
                    keyPoints: ['Transformers', 'Attention mechanisms', 'NLP applications'],
                    tags: ['ai', 'research', 'transformers', 'nlp'],
                    suggestedCategory: 'Research Papers',
                    relatedTopics: ['Machine Learning', 'NLP'],
                    confidence: 0.95,
                    processedAt: new Date().toISOString(),
                },
                createdAt: new Date(Date.now() - 345600000).toISOString(),
                updatedAt: new Date(Date.now() - 345600000).toISOString(),
                spaceId: 'demo-4',
                position: 0,
                isArchived: false,
                isPinned: true,
            },
        ];
    }
}

// Export singleton instance
export const contentImporter = new ContentImporter();
export default contentImporter;
