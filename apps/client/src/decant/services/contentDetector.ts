/**
 * ContentDetector - Service for detecting content types from URLs
 *
 * Analyzes URL patterns to determine the type of content
 * (article, video, podcast, paper, tool, etc.)
 */

import type { ContentType } from '../types';
import { CONTENT_TYPE_CONFIGS } from '../types/content';

/**
 * ContentDetector class for identifying content types from URLs
 */
class ContentDetector {
    /**
     * Detect content type from URL string
     */
    detectFromUrl(url: string): ContentType {
        const urlLower = url.toLowerCase();

        // Check each content type's patterns
        for (const [type, config] of Object.entries(CONTENT_TYPE_CONFIGS)) {
            // Skip default types (website, text)
            if (type === 'website' || type === 'text') continue;

            for (const pattern of config.patterns) {
                if (pattern.test(urlLower)) {
                    return type as ContentType;
                }
            }
        }

        // Check file extension
        const extension = this.getFileExtension(url);
        if (extension) {
            const typeByExtension = this.getTypeByExtension(extension);
            if (typeByExtension) {
                return typeByExtension;
            }
        }

        // Default to website
        return 'website';
    }

    /**
     * Detect content type from URL and MIME type
     */
    detectFromUrlAndMime(url: string, mimeType?: string): ContentType {
        // First try URL detection
        const urlType = this.detectFromUrl(url);
        if (urlType !== 'website') {
            return urlType;
        }

        // If URL detection failed, try MIME type
        if (mimeType) {
            const mimeTypeLower = mimeType.toLowerCase();

            if (mimeTypeLower.startsWith('image/')) {
                return 'image';
            }
            if (mimeTypeLower.startsWith('audio/')) {
                return 'podcast';
            }
            if (mimeTypeLower.startsWith('video/')) {
                return 'youtube'; // Generic video
            }
            if (mimeTypeLower === 'application/pdf') {
                return 'paper';
            }
            if (mimeTypeLower.includes('text/html')) {
                return 'website';
            }
        }

        return 'website';
    }

    /**
     * Detect content type from HTML content analysis
     */
    detectFromHtml(url: string, html: string): ContentType {
        // First try URL detection
        const urlType = this.detectFromUrl(url);
        if (urlType !== 'website') {
            return urlType;
        }

        // Analyze HTML for clues
        const htmlLower = html.toLowerCase();

        // Check for article indicators
        const articleIndicators = [
            '<article',
            'class="article"',
            'class="post"',
            'class="entry"',
            'class="blog"',
            'itemprop="articleBody"',
            'property="article:',
            '<time datetime',
            'class="author"',
            'rel="author"',
        ];

        let articleScore = 0;
        for (const indicator of articleIndicators) {
            if (htmlLower.includes(indicator)) {
                articleScore++;
            }
        }

        // Check word count (articles usually have substantial text)
        const textContent = html.replace(/<[^>]*>/g, ' ');
        const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

        if (articleScore >= 3 || wordCount > 500) {
            return 'article';
        }

        // Check for tool/product indicators
        const toolIndicators = [
            'pricing',
            'sign up',
            'signup',
            'get started',
            'free trial',
            'features',
            'download',
            'install',
        ];

        let toolScore = 0;
        for (const indicator of toolIndicators) {
            if (htmlLower.includes(indicator)) {
                toolScore++;
            }
        }

        if (toolScore >= 3) {
            return 'tool';
        }

        return 'website';
    }

    /**
     * Get detailed content type info
     */
    getTypeInfo(type: ContentType) {
        return CONTENT_TYPE_CONFIGS[type];
    }

    /**
     * Get all supported content types
     */
    getSupportedTypes(): ContentType[] {
        return Object.keys(CONTENT_TYPE_CONFIGS) as ContentType[];
    }

    /**
     * Check if URL matches specific content type
     */
    isType(url: string, type: ContentType): boolean {
        return this.detectFromUrl(url) === type;
    }

    /**
     * Extract file extension from URL
     */
    private getFileExtension(url: string): string | null {
        try {
            const pathname = new URL(url).pathname;
            const match = pathname.match(/\.([a-z0-9]+)(?:\?|$)/i);
            return match ? match[1].toLowerCase() : null;
        } catch {
            return null;
        }
    }

    /**
     * Map file extension to content type
     */
    private getTypeByExtension(ext: string): ContentType | null {
        const extensionMap: Record<string, ContentType> = {
            // Images
            jpg: 'image',
            jpeg: 'image',
            png: 'image',
            gif: 'image',
            webp: 'image',
            svg: 'image',
            bmp: 'image',

            // Documents
            pdf: 'paper',

            // Audio
            mp3: 'podcast',
            wav: 'podcast',
            m4a: 'podcast',
            ogg: 'podcast',

            // Video
            mp4: 'youtube',
            webm: 'youtube',
            mov: 'youtube',

            // Archives
            zip: 'file',
            rar: 'file',
            '7z': 'file',
            tar: 'file',
            gz: 'file',

            // Office
            doc: 'file',
            docx: 'file',
            xls: 'file',
            xlsx: 'file',
            ppt: 'file',
            pptx: 'file',
        };

        return extensionMap[ext] || null;
    }
}

// Export singleton instance
export const contentDetector = new ContentDetector();
export default contentDetector;
