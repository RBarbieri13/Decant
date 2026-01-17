/**
 * Decant - Resource Management Service
 *
 * Handles CRUD operations for Decant resources
 * Integrates with Trilium notes for persistence
 */

import sql from "../sql.js";
import log from "../log.js";
import becca from "../../becca/becca.js";
import noteService from "../notes.js";
import attributeService from "../attributes.js";
import { newEntityId } from "../utils.js";
import metadataExtractor from "./metadata_extractor.js";
import type {
    DecantResource,
    ResourceMetadata,
    CreateResourceRequest,
    UpdateResourceRequest,
    MetadataExtractionRequest,
} from "./types.js";
import { DEFAULT_METADATA } from "./types.js";

// Decant root note title - will be created if it doesn't exist
const DECANT_ROOT_NOTE_TITLE = 'Decant Resources';
const DECANT_ATTRIBUTE_PREFIX = 'decant';

/**
 * Find or create the Decant root note
 */
async function getOrCreateDecantRoot(): Promise<string> {
    // Look for existing Decant root note
    const existingRoot = becca.getNotesByTitle(DECANT_ROOT_NOTE_TITLE).find(
        note => note.hasLabel('decantRoot')
    );

    if (existingRoot) {
        return existingRoot.noteId;
    }

    // Create new Decant root note under root
    const rootNote = becca.getNote('root');
    if (!rootNote) {
        throw new Error('Root note not found');
    }

    const { note } = noteService.createNewNote({
        parentNoteId: 'root',
        title: DECANT_ROOT_NOTE_TITLE,
        content: `<h1>Decant Resources</h1>
<p>This note contains all resources managed by Decant.</p>
<p>Resources are automatically organized by category and function.</p>`,
        type: 'text',
    });

    // Add identifying label
    attributeService.createLabel(note.noteId, 'decantRoot', 'true');
    attributeService.createLabel(note.noteId, 'iconClass', 'bx bx-bookmark');

    log.info(`Created Decant root note: ${note.noteId}`);
    return note.noteId;
}

/**
 * Find or create a category note under the Decant root
 */
async function getOrCreateCategoryNote(category: string, parentNoteId: string): Promise<string> {
    const parentNote = becca.getNote(parentNoteId);
    if (!parentNote) {
        throw new Error(`Parent note not found: ${parentNoteId}`);
    }

    // Look for existing category note
    const existingCategory = parentNote.getChildNotes().find(
        child => child.title === category && child.hasLabel('decantCategory')
    );

    if (existingCategory) {
        return existingCategory.noteId;
    }

    // Create new category note
    const { note } = noteService.createNewNote({
        parentNoteId,
        title: category,
        content: `<h2>${category}</h2><p>Resources in the ${category} category.</p>`,
        type: 'text',
    });

    attributeService.createLabel(note.noteId, 'decantCategory', category);
    attributeService.createLabel(note.noteId, 'iconClass', 'bx bx-folder');

    log.info(`Created category note: ${category} (${note.noteId})`);
    return note.noteId;
}

/**
 * Create a note for a Decant resource
 */
async function createResourceNote(resource: DecantResource): Promise<string> {
    const { metadata } = resource;

    // Get or create the hierarchy
    const rootNoteId = await getOrCreateDecantRoot();
    const categoryNoteId = await getOrCreateCategoryNote(metadata.category, rootNoteId);
    let parentNoteId = categoryNoteId;

    // Optionally create sub-category
    if (metadata.subCategory) {
        parentNoteId = await getOrCreateCategoryNote(metadata.subCategory, categoryNoteId);
    }

    // Create the resource note
    const noteContent = buildResourceNoteContent(metadata);

    const { note } = noteService.createNewNote({
        parentNoteId,
        title: metadata.title,
        content: noteContent,
        type: 'text',
    });

    // Add metadata as attributes
    addMetadataAttributes(note.noteId, metadata);
    addResourceAttributes(note.noteId, resource);

    log.info(`Created resource note: ${metadata.title} (${note.noteId})`);
    return note.noteId;
}

/**
 * Build HTML content for a resource note
 */
function buildResourceNoteContent(metadata: ResourceMetadata): string {
    const logoHtml = metadata.logo
        ? `<img src="${metadata.logo}" alt="${metadata.title} logo" style="max-height: 64px; margin-right: 16px;">`
        : '';

    return `<div style="display: flex; align-items: center; margin-bottom: 20px;">
    ${logoHtml}
    <div>
        <h1>${metadata.title}</h1>
        <p><strong>${metadata.function}</strong></p>
    </div>
</div>

<h2>Description</h2>
<p>${metadata.description}</p>

<h2>Details</h2>
<table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>URL</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><a href="${metadata.url}">${metadata.url}</a></td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Category</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${metadata.category}${metadata.subCategory ? ` / ${metadata.subCategory}` : ''}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Organization</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${metadata.parentOrganization || 'Unknown'}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Function Code</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${metadata.functionHierarchyCode}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Org Code</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${metadata.organizationHierarchyCode}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Date Added</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date(metadata.dateAdded).toLocaleDateString()}</td></tr>
</table>

<h2>Differentiation</h2>
<p>${metadata.differentiation}</p>

<h2>Tags</h2>
<p>${metadata.tags.map(t => `<span style="background: #e0e0e0; padding: 2px 8px; border-radius: 12px; margin-right: 4px;">${t}</span>`).join(' ')}</p>
`;
}

/**
 * Add metadata as note attributes
 */
function addMetadataAttributes(noteId: string, metadata: ResourceMetadata): void {
    // Core metadata
    attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}Resource`, 'true');
    attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}Url`, metadata.url);
    attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}Function`, metadata.function);
    attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}Category`, metadata.category);

    if (metadata.subCategory) {
        attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}SubCategory`, metadata.subCategory);
    }

    if (metadata.parentOrganization) {
        attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}Organization`, metadata.parentOrganization);
    }

    attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}FunctionCode`, metadata.functionHierarchyCode);
    attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}OrgCode`, metadata.organizationHierarchyCode);

    // Tags as individual labels
    for (const tag of metadata.tags) {
        attributeService.createLabel(noteId, 'tag', tag);
    }

    // Logo as relation if it's a URL
    if (metadata.logo) {
        attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}Logo`, metadata.logo);
    }
}

/**
 * Add resource-level attributes
 */
function addResourceAttributes(noteId: string, resource: DecantResource): void {
    attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}ResourceId`, resource.id);

    if (resource.userNotes) {
        attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}UserNotes`, resource.userNotes);
    }

    if (resource.isFavorite) {
        attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}Favorite`, 'true');
    }

    for (const tag of resource.customTags) {
        attributeService.createLabel(noteId, `${DECANT_ATTRIBUTE_PREFIX}CustomTag`, tag);
    }
}

/**
 * List all Decant resources
 */
async function listResources(options?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
}): Promise<{ resources: DecantResource[]; total: number }> {
    const { category, search, limit = 50, offset = 0 } = options || {};

    // Find all notes with decantResource label
    let resources: DecantResource[] = [];

    const resourceNotes = becca.findNotes(`#${DECANT_ATTRIBUTE_PREFIX}Resource`);

    for (const note of resourceNotes) {
        const resource = noteToResource(note);
        if (resource) {
            // Apply filters
            if (category && resource.metadata.category !== category) {
                continue;
            }
            if (search) {
                const searchLower = search.toLowerCase();
                const matchesSearch =
                    resource.metadata.title.toLowerCase().includes(searchLower) ||
                    resource.metadata.description.toLowerCase().includes(searchLower) ||
                    resource.metadata.tags.some(t => t.toLowerCase().includes(searchLower));
                if (!matchesSearch) {
                    continue;
                }
            }
            resources.push(resource);
        }
    }

    const total = resources.length;

    // Apply pagination
    resources = resources.slice(offset, offset + limit);

    return { resources, total };
}

/**
 * Convert a Trilium note to a DecantResource
 */
function noteToResource(note: any): DecantResource | null {
    if (!note.hasLabel(`${DECANT_ATTRIBUTE_PREFIX}Resource`)) {
        return null;
    }

    const getLabel = (name: string) => note.getLabelValue(`${DECANT_ATTRIBUTE_PREFIX}${name}`) || '';
    const getLabels = (name: string) => note.getLabels(name).map((l: any) => l.value);

    const metadata: ResourceMetadata = {
        title: note.title,
        url: getLabel('Url'),
        function: getLabel('Function'),
        category: getLabel('Category') || 'Other',
        subCategory: getLabel('SubCategory'),
        parentOrganization: getLabel('Organization'),
        dateAdded: note.dateCreated || new Date().toISOString(),
        logo: getLabel('Logo') || null,
        tags: getLabels('tag'),
        differentiation: '', // Not stored as attribute
        functionHierarchyCode: getLabel('FunctionCode') || 'OTHER',
        organizationHierarchyCode: getLabel('OrgCode') || 'OTHER',
        description: '', // Stored in note content
    };

    return {
        id: getLabel('ResourceId') || note.noteId,
        noteId: note.noteId,
        metadata,
        createdAt: note.dateCreated,
        updatedAt: note.dateModified,
        userNotes: getLabel('UserNotes'),
        isFavorite: note.hasLabel(`${DECANT_ATTRIBUTE_PREFIX}Favorite`),
        customTags: note.getLabels(`${DECANT_ATTRIBUTE_PREFIX}CustomTag`).map((l: any) => l.value),
    };
}

/**
 * Get a specific resource by ID
 */
async function getResource(resourceId: string): Promise<DecantResource | null> {
    // Try to find by resource ID first
    const notesByResourceId = becca.findNotes(`#${DECANT_ATTRIBUTE_PREFIX}ResourceId="${resourceId}"`);
    if (notesByResourceId.length > 0) {
        return noteToResource(notesByResourceId[0]);
    }

    // Try to find by note ID
    const note = becca.getNote(resourceId);
    if (note && note.hasLabel(`${DECANT_ATTRIBUTE_PREFIX}Resource`)) {
        return noteToResource(note);
    }

    return null;
}

/**
 * Create a new resource from a URL
 */
async function createResource(request: CreateResourceRequest): Promise<DecantResource> {
    const { url, metadata: userMetadata, userNotes, customTags = [], createNote = true } = request;

    // Extract metadata using AI
    const extractionResult = await metadataExtractor.extractMetadata({
        url,
        forceRefresh: true,
    });

    if (!extractionResult.success || !extractionResult.metadata) {
        throw new Error(extractionResult.error || 'Failed to extract metadata');
    }

    // Merge extracted metadata with user-provided metadata
    const metadata: ResourceMetadata = {
        ...extractionResult.metadata,
        ...userMetadata,
    };

    // Create the resource object
    const resource: DecantResource = {
        id: newEntityId(),
        noteId: null,
        metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userNotes: userNotes || '',
        isFavorite: false,
        customTags,
    };

    // Create a Trilium note if requested
    if (createNote) {
        resource.noteId = await createResourceNote(resource);
    }

    log.info(`Created resource: ${resource.id} - ${metadata.title}`);

    return resource;
}

/**
 * Update an existing resource
 */
async function updateResource(resourceId: string, updates: UpdateResourceRequest): Promise<DecantResource | null> {
    const resource = await getResource(resourceId);
    if (!resource) {
        return null;
    }

    // Apply updates
    if (updates.metadata) {
        resource.metadata = { ...resource.metadata, ...updates.metadata };
    }
    if (updates.userNotes !== undefined) {
        resource.userNotes = updates.userNotes;
    }
    if (updates.customTags !== undefined) {
        resource.customTags = updates.customTags;
    }
    if (updates.isFavorite !== undefined) {
        resource.isFavorite = updates.isFavorite;
    }
    resource.updatedAt = new Date().toISOString();

    // Update the Trilium note if it exists
    if (resource.noteId) {
        const note = becca.getNote(resource.noteId);
        if (note) {
            // Update note content
            const newContent = buildResourceNoteContent(resource.metadata);
            note.setContent(newContent);

            // Update title if changed
            if (updates.metadata?.title && note.title !== updates.metadata.title) {
                note.title = updates.metadata.title;
                note.save();
            }

            // Update attributes
            // Remove old attributes and add new ones
            const existingLabels = note.getOwnedLabels().filter(
                (l: any) => l.name.startsWith(DECANT_ATTRIBUTE_PREFIX) || l.name === 'tag'
            );
            for (const label of existingLabels) {
                label.markAsDeleted();
            }

            addMetadataAttributes(note.noteId, resource.metadata);
            addResourceAttributes(note.noteId, resource);
        }
    }

    log.info(`Updated resource: ${resourceId}`);

    return resource;
}

/**
 * Delete a resource
 */
async function deleteResource(resourceId: string): Promise<boolean> {
    const resource = await getResource(resourceId);
    if (!resource) {
        return false;
    }

    // Delete the Trilium note if it exists
    if (resource.noteId) {
        const note = becca.getNote(resource.noteId);
        if (note) {
            noteService.deleteNote(note);
        }
    }

    log.info(`Deleted resource: ${resourceId}`);
    return true;
}

/**
 * Refresh metadata for a resource
 */
async function refreshResourceMetadata(resourceId: string): Promise<DecantResource | null> {
    const resource = await getResource(resourceId);
    if (!resource) {
        return null;
    }

    // Re-extract metadata
    const extractionResult = await metadataExtractor.extractMetadata({
        url: resource.metadata.url,
        forceRefresh: true,
    });

    if (!extractionResult.success || !extractionResult.metadata) {
        throw new Error(extractionResult.error || 'Failed to refresh metadata');
    }

    // Update with new metadata but preserve user data
    return updateResource(resourceId, {
        metadata: {
            ...extractionResult.metadata,
            // Preserve user-set values
            dateAdded: resource.metadata.dateAdded,
        },
    });
}

/**
 * Get categories and their resource counts
 */
async function getCategories(): Promise<{ category: string; count: number }[]> {
    const { resources } = await listResources({ limit: 10000 });

    const categoryCounts = new Map<string, number>();
    for (const resource of resources) {
        const count = categoryCounts.get(resource.metadata.category) || 0;
        categoryCounts.set(resource.metadata.category, count + 1);
    }

    return Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Search resources by various criteria
 */
async function searchResources(query: string, options?: {
    categories?: string[];
    tags?: string[];
    functionCodes?: string[];
    limit?: number;
}): Promise<DecantResource[]> {
    const { categories, tags, functionCodes, limit = 50 } = options || {};

    const { resources } = await listResources({ limit: 10000 });

    return resources
        .filter(resource => {
            const queryLower = query.toLowerCase();

            // Text search
            const matchesQuery =
                resource.metadata.title.toLowerCase().includes(queryLower) ||
                resource.metadata.description.toLowerCase().includes(queryLower) ||
                resource.metadata.function.toLowerCase().includes(queryLower) ||
                resource.metadata.parentOrganization.toLowerCase().includes(queryLower) ||
                resource.metadata.tags.some(t => t.toLowerCase().includes(queryLower)) ||
                resource.metadata.url.toLowerCase().includes(queryLower);

            if (!matchesQuery) return false;

            // Category filter
            if (categories && categories.length > 0) {
                if (!categories.includes(resource.metadata.category)) return false;
            }

            // Tag filter
            if (tags && tags.length > 0) {
                const resourceTags = [...resource.metadata.tags, ...resource.customTags];
                if (!tags.some(t => resourceTags.includes(t))) return false;
            }

            // Function code filter
            if (functionCodes && functionCodes.length > 0) {
                if (!functionCodes.some(code =>
                    resource.metadata.functionHierarchyCode.startsWith(code)
                )) return false;
            }

            return true;
        })
        .slice(0, limit);
}

export default {
    listResources,
    getResource,
    createResource,
    updateResource,
    deleteResource,
    refreshResourceMetadata,
    getCategories,
    searchResources,
    getOrCreateDecantRoot,
};

export {
    listResources,
    getResource,
    createResource,
    updateResource,
    deleteResource,
    refreshResourceMetadata,
    getCategories,
    searchResources,
    getOrCreateDecantRoot,
};
