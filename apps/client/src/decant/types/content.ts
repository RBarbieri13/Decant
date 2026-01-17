/**
 * Content Types - Defines all supported content types and their metadata
 */

export type ContentType =
    | 'website'
    | 'article'
    | 'youtube'
    | 'podcast'
    | 'paper'
    | 'tool'
    | 'file'
    | 'image'
    | 'text';

export interface ContentTypeConfig {
    type: ContentType;
    label: string;
    icon: string;
    color: string;
    patterns: RegExp[];
    extractors: string[];
}

export const CONTENT_TYPE_CONFIGS: Record<ContentType, ContentTypeConfig> = {
    youtube: {
        type: 'youtube',
        label: 'YouTube',
        icon: 'bx-play-circle',
        color: '#FF0000',
        patterns: [
            /youtube\.com\/watch/,
            /youtu\.be\//,
            /youtube\.com\/embed/,
            /youtube\.com\/playlist/
        ],
        extractors: ['youtube']
    },
    article: {
        type: 'article',
        label: 'Article',
        icon: 'bx-file',
        color: '#4A90D9',
        patterns: [
            /medium\.com/,
            /substack\.com/,
            /dev\.to/,
            /hashnode\.dev/,
            /\/blog\//,
            /\/article\//,
            /\/post\//,
            /\/news\//
        ],
        extractors: ['readability', 'opengraph']
    },
    podcast: {
        type: 'podcast',
        label: 'Podcast',
        icon: 'bx-podcast',
        color: '#8B5CF6',
        patterns: [
            /spotify\.com\/(show|episode)/,
            /podcasts\.apple\.com/,
            /anchor\.fm/,
            /overcast\.fm/,
            /pocketcasts\.com/,
            /\.rss$/
        ],
        extractors: ['podcast']
    },
    paper: {
        type: 'paper',
        label: 'Paper',
        icon: 'bx-book-open',
        color: '#059669',
        patterns: [
            /arxiv\.org/,
            /doi\.org/,
            /scholar\.google/,
            /researchgate\.net/,
            /semanticscholar\.org/,
            /pubmed\.ncbi/,
            /\.pdf$/
        ],
        extractors: ['academic']
    },
    tool: {
        type: 'tool',
        label: 'Tool',
        icon: 'bx-wrench',
        color: '#F59E0B',
        patterns: [
            /github\.com/,
            /gitlab\.com/,
            /npmjs\.com/,
            /pypi\.org/,
            /producthunt\.com/
        ],
        extractors: ['product', 'github']
    },
    image: {
        type: 'image',
        label: 'Image',
        icon: 'bx-image',
        color: '#EC4899',
        patterns: [
            /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i,
            /unsplash\.com/,
            /pinterest\.com/,
            /dribbble\.com/,
            /behance\.net/,
            /imgur\.com/
        ],
        extractors: ['image']
    },
    file: {
        type: 'file',
        label: 'File',
        icon: 'bx-file-blank',
        color: '#6B7280',
        patterns: [
            /\.(zip|rar|7z|tar|gz|doc|docx|xls|xlsx|ppt|pptx)(\?|$)/i,
            /drive\.google\.com/,
            /dropbox\.com/
        ],
        extractors: ['file']
    },
    text: {
        type: 'text',
        label: 'Text',
        icon: 'bx-text',
        color: '#374151',
        patterns: [],
        extractors: ['text']
    },
    website: {
        type: 'website',
        label: 'Website',
        icon: 'bx-globe',
        color: '#3B82F6',
        patterns: [], // Default fallback
        extractors: ['opengraph', 'html']
    }
};

export interface ContentMetadata {
    title: string;
    description?: string;
    author?: string;
    publishedAt?: string;
    domain: string;
    favicon?: string;
    thumbnail?: string;
    duration?: string; // For videos/podcasts
    wordCount?: number; // For articles
    pageCount?: number; // For papers/PDFs
    language?: string;
    canonicalUrl?: string;
}

export interface ContentItem {
    id: string;
    noteId: string;
    type: ContentType;
    sourceUrl: string;
    metadata: ContentMetadata;
    aiAnalysis?: AIAnalysis;
    createdAt: string;
    updatedAt: string;
    lastAccessedAt?: string;
    spaceId: string;
    position: number;
    isArchived: boolean;
    isPinned: boolean;
}

export interface AIAnalysis {
    summary: string;
    keyPoints: string[];
    tags: string[];
    suggestedCategory: string;
    relatedTopics: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
    readingTime?: number; // minutes
    confidence: number; // 0-1
    processedAt: string;
}

export interface ContentImportRequest {
    url: string;
    spaceId?: string;
    skipAI?: boolean;
    manualTags?: string[];
    manualTitle?: string;
}

export interface ContentImportResult {
    success: boolean;
    contentItem?: ContentItem;
    error?: string;
    warnings?: string[];
}

export interface BatchImportRequest {
    urls: string[];
    spaceId?: string;
    skipAI?: boolean;
}

export interface BatchImportResult {
    total: number;
    successful: number;
    failed: number;
    results: ContentImportResult[];
}
