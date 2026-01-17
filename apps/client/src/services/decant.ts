/**
 * Decant Frontend API Client
 *
 * Client-side service for interacting with the Decant backend API
 * Provides methods for URL metadata extraction and resource management
 */

import server from "./server.js";

/**
 * Extracted metadata from a URL resource
 */
export interface ResourceMetadata {
    title: string;
    function: string;
    category: string;
    subCategory: string;
    parentOrganization: string;
    dateAdded: string;
    logo: string | null;
    tags: string[];
    differentiation: string;
    functionHierarchyCode: string;
    organizationHierarchyCode: string;
    description: string;
    url: string;
}

/**
 * A saved resource in the system
 */
export interface DecantResource {
    id: string;
    noteId: string | null;
    metadata: ResourceMetadata;
    createdAt: string;
    updatedAt: string;
    userNotes: string;
    isFavorite: boolean;
    customTags: string[];
}

/**
 * Hierarchy definition
 */
export interface HierarchyDefinition {
    code: string;
    name: string;
    description: string;
    parent?: string;
}

/**
 * Standard API response
 */
interface ApiResponse<T = unknown> {
    success: boolean;
    error?: string;
    [key: string]: unknown;
}

/**
 * Metadata extraction response
 */
interface MetadataExtractionResponse extends ApiResponse {
    metadata?: ResourceMetadata;
    cached?: boolean;
}

/**
 * List resources response
 */
interface ListResourcesResponse extends ApiResponse {
    resources: DecantResource[];
    total: number;
}

/**
 * Resource response
 */
interface ResourceResponse extends ApiResponse {
    resource: DecantResource;
}

/**
 * Categories response
 */
interface CategoriesResponse extends ApiResponse {
    categories: Array<{ category: string; count: number }>;
}

/**
 * Search response
 */
interface SearchResponse extends ApiResponse {
    resources: DecantResource[];
    count: number;
}

/**
 * Hierarchies response
 */
interface HierarchiesResponse extends ApiResponse {
    functionHierarchies: HierarchyDefinition[];
    organizationHierarchies: HierarchyDefinition[];
}

/**
 * Cache stats response
 */
interface CacheStatsResponse extends ApiResponse {
    size: number;
    urls: string[];
}

/**
 * AI test response
 */
interface AITestResponse {
    success: boolean;
    message: string;
}

/**
 * Extract metadata from a URL using AI
 *
 * @param url - The URL to analyze
 * @param options - Additional options
 * @returns Extracted metadata
 */
async function extractMetadata(
    url: string,
    options?: {
        forceRefresh?: boolean;
        context?: string;
    }
): Promise<MetadataExtractionResponse> {
    return await server.post<MetadataExtractionResponse>("/api/decant/extract", {
        url,
        forceRefresh: options?.forceRefresh,
        context: options?.context,
    });
}

/**
 * List all resources
 *
 * @param options - Filter and pagination options
 * @returns List of resources
 */
async function listResources(options?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
}): Promise<ListResourcesResponse> {
    const params = new URLSearchParams();

    if (options?.category) params.append("category", options.category);
    if (options?.search) params.append("search", options.search);
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());

    const queryString = params.toString();
    const url = `/api/decant/resources${queryString ? `?${queryString}` : ""}`;

    return await server.get<ListResourcesResponse>(url);
}

/**
 * Create a new resource from a URL
 *
 * @param url - The URL to create a resource from
 * @param options - Additional options
 * @returns Created resource
 */
async function createResource(
    url: string,
    options?: {
        metadata?: Partial<ResourceMetadata>;
        userNotes?: string;
        customTags?: string[];
        createNote?: boolean;
    }
): Promise<ResourceResponse> {
    return await server.post<ResourceResponse>("/api/decant/resources", {
        url,
        metadata: options?.metadata,
        userNotes: options?.userNotes,
        customTags: options?.customTags,
        createNote: options?.createNote ?? true,
    });
}

/**
 * Get a specific resource
 *
 * @param resourceId - The resource ID
 * @returns Resource details
 */
async function getResource(resourceId: string): Promise<ResourceResponse> {
    return await server.get<ResourceResponse>(`/api/decant/resources/${resourceId}`);
}

/**
 * Update a resource
 *
 * @param resourceId - The resource ID
 * @param updates - Fields to update
 * @returns Updated resource
 */
async function updateResource(
    resourceId: string,
    updates: {
        metadata?: Partial<ResourceMetadata>;
        userNotes?: string;
        customTags?: string[];
        isFavorite?: boolean;
    }
): Promise<ResourceResponse> {
    return await server.put<ResourceResponse>(`/api/decant/resources/${resourceId}`, updates);
}

/**
 * Delete a resource
 *
 * @param resourceId - The resource ID
 */
async function deleteResource(resourceId: string): Promise<void> {
    await server.remove(`/api/decant/resources/${resourceId}`);
}

/**
 * Refresh metadata for a resource
 *
 * @param resourceId - The resource ID
 * @returns Updated resource with fresh metadata
 */
async function refreshResource(resourceId: string): Promise<ResourceResponse> {
    return await server.post<ResourceResponse>(`/api/decant/resources/${resourceId}/refresh`);
}

/**
 * Get categories with resource counts
 *
 * @returns List of categories with counts
 */
async function getCategories(): Promise<CategoriesResponse> {
    return await server.get<CategoriesResponse>("/api/decant/categories");
}

/**
 * Search resources
 *
 * @param query - Search query
 * @param options - Filter options
 * @returns Search results
 */
async function searchResources(
    query: string,
    options?: {
        categories?: string[];
        tags?: string[];
        functionCodes?: string[];
        limit?: number;
    }
): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.append("q", query);

    if (options?.categories?.length) params.append("categories", options.categories.join(","));
    if (options?.tags?.length) params.append("tags", options.tags.join(","));
    if (options?.functionCodes?.length) params.append("functionCodes", options.functionCodes.join(","));
    if (options?.limit) params.append("limit", options.limit.toString());

    return await server.get<SearchResponse>(`/api/decant/search?${params.toString()}`);
}

/**
 * Get hierarchy definitions
 *
 * @returns Function and organization hierarchy definitions
 */
async function getHierarchies(): Promise<HierarchiesResponse> {
    return await server.get<HierarchiesResponse>("/api/decant/hierarchies");
}

/**
 * Test AI provider connection
 *
 * @returns Test result
 */
async function testAIConnection(): Promise<AITestResponse> {
    return await server.post<AITestResponse>("/api/decant/ai/test");
}

/**
 * Get cache statistics
 *
 * @returns Cache stats
 */
async function getCacheStats(): Promise<CacheStatsResponse> {
    return await server.get<CacheStatsResponse>("/api/decant/cache/stats");
}

/**
 * Clear metadata cache
 *
 * @param url - Specific URL to clear, or omit to clear all
 */
async function clearCache(url?: string): Promise<ApiResponse> {
    return await server.post<ApiResponse>("/api/decant/cache/clear", { url });
}

/**
 * Toggle favorite status for a resource
 *
 * @param resourceId - The resource ID
 * @param isFavorite - Whether to favorite or unfavorite
 * @returns Updated resource
 */
async function toggleFavorite(resourceId: string, isFavorite: boolean): Promise<ResourceResponse> {
    return await updateResource(resourceId, { isFavorite });
}

/**
 * Add custom tags to a resource
 *
 * @param resourceId - The resource ID
 * @param tags - Tags to add
 * @returns Updated resource
 */
async function addCustomTags(resourceId: string, tags: string[]): Promise<ResourceResponse> {
    const resource = await getResource(resourceId);
    const existingTags = resource.resource.customTags || [];
    const newTags = [...new Set([...existingTags, ...tags])];
    return await updateResource(resourceId, { customTags: newTags });
}

/**
 * Remove custom tags from a resource
 *
 * @param resourceId - The resource ID
 * @param tags - Tags to remove
 * @returns Updated resource
 */
async function removeCustomTags(resourceId: string, tags: string[]): Promise<ResourceResponse> {
    const resource = await getResource(resourceId);
    const existingTags = resource.resource.customTags || [];
    const newTags = existingTags.filter((t) => !tags.includes(t));
    return await updateResource(resourceId, { customTags: newTags });
}

/**
 * Bulk create resources from multiple URLs
 *
 * @param urls - Array of URLs to create resources from
 * @param options - Common options for all resources
 * @returns Array of results for each URL
 */
async function bulkCreateResources(
    urls: string[],
    options?: {
        createNote?: boolean;
    }
): Promise<Array<{ url: string; success: boolean; resource?: DecantResource; error?: string }>> {
    const results = [];

    for (const url of urls) {
        try {
            const response = await createResource(url, options);
            results.push({
                url,
                success: true,
                resource: response.resource,
            });
        } catch (error) {
            results.push({
                url,
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }

    return results;
}

/**
 * Get resources by category
 *
 * @param category - Category name
 * @param limit - Maximum number of results
 * @returns List of resources in the category
 */
async function getResourcesByCategory(category: string, limit = 50): Promise<DecantResource[]> {
    const response = await listResources({ category, limit });
    return response.resources;
}

/**
 * Get favorite resources
 *
 * @param limit - Maximum number of results
 * @returns List of favorite resources
 */
async function getFavorites(limit = 50): Promise<DecantResource[]> {
    const response = await listResources({ limit: 10000 });
    return response.resources.filter((r) => r.isFavorite).slice(0, limit);
}

/**
 * Get recently added resources
 *
 * @param limit - Maximum number of results
 * @returns List of recently added resources
 */
async function getRecentResources(limit = 10): Promise<DecantResource[]> {
    const response = await listResources({ limit: 10000 });
    return response.resources
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
}

export default {
    // Core extraction
    extractMetadata,

    // Resource CRUD
    listResources,
    createResource,
    getResource,
    updateResource,
    deleteResource,
    refreshResource,

    // Discovery
    getCategories,
    searchResources,
    getHierarchies,

    // AI and cache
    testAIConnection,
    getCacheStats,
    clearCache,

    // Convenience methods
    toggleFavorite,
    addCustomTags,
    removeCustomTags,
    bulkCreateResources,
    getResourcesByCategory,
    getFavorites,
    getRecentResources,
};

// Named exports for tree-shaking
export {
    extractMetadata,
    listResources,
    createResource,
    getResource,
    updateResource,
    deleteResource,
    refreshResource,
    getCategories,
    searchResources,
    getHierarchies,
    testAIConnection,
    getCacheStats,
    clearCache,
    toggleFavorite,
    addCustomTags,
    removeCustomTags,
    bulkCreateResources,
    getResourcesByCategory,
    getFavorites,
    getRecentResources,
};
