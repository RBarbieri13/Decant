/**
 * Decant - Resource Metadata Types
 *
 * Types for AI-powered URL metadata extraction and resource management
 */

/**
 * Extracted metadata from a URL resource
 */
export interface ResourceMetadata {
    /** The title of the resource/page */
    title: string;

    /** Primary function/purpose of the resource (e.g., "Design Tool", "Analytics Platform") */
    function: string;

    /** Main category (e.g., "Software", "Service", "Framework") */
    category: string;

    /** Sub-category for more specific classification */
    subCategory: string;

    /** Parent organization or company that owns/operates the resource */
    parentOrganization: string;

    /** Date the resource was added to the system */
    dateAdded: string;

    /** URL to the resource's logo/favicon */
    logo: string | null;

    /** Array of relevant tags for categorization */
    tags: string[];

    /** What makes this resource unique compared to similar ones */
    differentiation: string;

    /** Hierarchical code based on function (e.g., "TECH.DEV.TOOLS") */
    functionHierarchyCode: string;

    /** Hierarchical code based on organization (e.g., "CORP.TECH.SAAS") */
    organizationHierarchyCode: string;

    /** Brief description of the resource */
    description: string;

    /** The original URL */
    url: string;
}

/**
 * A saved resource in the system
 */
export interface DecantResource {
    /** Unique identifier */
    id: string;

    /** Associated Trilium note ID */
    noteId: string | null;

    /** The extracted metadata */
    metadata: ResourceMetadata;

    /** Creation timestamp */
    createdAt: string;

    /** Last update timestamp */
    updatedAt: string;

    /** User-added notes/comments */
    userNotes: string;

    /** Whether the resource is favorited */
    isFavorite: boolean;

    /** Custom user tags (in addition to AI-extracted ones) */
    customTags: string[];
}

/**
 * Request to extract metadata from a URL
 */
export interface MetadataExtractionRequest {
    /** The URL to analyze */
    url: string;

    /** Optional: Force re-extraction even if cached */
    forceRefresh?: boolean;

    /** Optional: Additional context to help AI extraction */
    context?: string;
}

/**
 * Response from metadata extraction
 */
export interface MetadataExtractionResponse {
    success: boolean;
    metadata?: ResourceMetadata;
    error?: string;
    cached?: boolean;
}

/**
 * Request to create a new resource
 */
export interface CreateResourceRequest {
    url: string;
    metadata?: Partial<ResourceMetadata>;
    userNotes?: string;
    customTags?: string[];
    createNote?: boolean;
}

/**
 * Request to update a resource
 */
export interface UpdateResourceRequest {
    metadata?: Partial<ResourceMetadata>;
    userNotes?: string;
    customTags?: string[];
    isFavorite?: boolean;
}

/**
 * AI Provider configuration
 */
export interface AIProviderConfig {
    provider: 'openai' | 'anthropic' | 'ollama';
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}

/**
 * Hierarchy code definitions
 */
export interface HierarchyDefinition {
    code: string;
    name: string;
    description: string;
    parent?: string;
}

/**
 * Function hierarchy codes
 */
export const FUNCTION_HIERARCHIES: HierarchyDefinition[] = [
    // Technology
    { code: 'TECH', name: 'Technology', description: 'Technology-related resources' },
    { code: 'TECH.DEV', name: 'Development', description: 'Software development tools', parent: 'TECH' },
    { code: 'TECH.DEV.IDE', name: 'IDE/Editor', description: 'Code editors and IDEs', parent: 'TECH.DEV' },
    { code: 'TECH.DEV.VCS', name: 'Version Control', description: 'Git and version control', parent: 'TECH.DEV' },
    { code: 'TECH.DEV.CI', name: 'CI/CD', description: 'Continuous integration/deployment', parent: 'TECH.DEV' },
    { code: 'TECH.DEV.TEST', name: 'Testing', description: 'Testing frameworks and tools', parent: 'TECH.DEV' },
    { code: 'TECH.DEV.API', name: 'API Tools', description: 'API development and testing', parent: 'TECH.DEV' },
    { code: 'TECH.DATA', name: 'Data', description: 'Data management and analytics', parent: 'TECH' },
    { code: 'TECH.DATA.DB', name: 'Database', description: 'Database systems', parent: 'TECH.DATA' },
    { code: 'TECH.DATA.VIZ', name: 'Visualization', description: 'Data visualization', parent: 'TECH.DATA' },
    { code: 'TECH.DATA.BI', name: 'Business Intelligence', description: 'BI and analytics platforms', parent: 'TECH.DATA' },
    { code: 'TECH.AI', name: 'AI/ML', description: 'Artificial intelligence and machine learning', parent: 'TECH' },
    { code: 'TECH.AI.LLM', name: 'LLM', description: 'Large language models', parent: 'TECH.AI' },
    { code: 'TECH.AI.CV', name: 'Computer Vision', description: 'Image and video AI', parent: 'TECH.AI' },
    { code: 'TECH.INFRA', name: 'Infrastructure', description: 'Cloud and infrastructure', parent: 'TECH' },
    { code: 'TECH.INFRA.CLOUD', name: 'Cloud Platform', description: 'Cloud service providers', parent: 'TECH.INFRA' },
    { code: 'TECH.INFRA.HOST', name: 'Hosting', description: 'Web hosting services', parent: 'TECH.INFRA' },
    { code: 'TECH.SEC', name: 'Security', description: 'Security tools and services', parent: 'TECH' },

    // Design
    { code: 'DESIGN', name: 'Design', description: 'Design-related resources' },
    { code: 'DESIGN.UI', name: 'UI Design', description: 'User interface design', parent: 'DESIGN' },
    { code: 'DESIGN.UX', name: 'UX Design', description: 'User experience design', parent: 'DESIGN' },
    { code: 'DESIGN.GRAPH', name: 'Graphics', description: 'Graphic design tools', parent: 'DESIGN' },
    { code: 'DESIGN.PROTO', name: 'Prototyping', description: 'Design prototyping', parent: 'DESIGN' },
    { code: 'DESIGN.ASSET', name: 'Assets', description: 'Design assets and resources', parent: 'DESIGN' },

    // Business
    { code: 'BIZ', name: 'Business', description: 'Business tools and services' },
    { code: 'BIZ.PROJ', name: 'Project Management', description: 'Project management tools', parent: 'BIZ' },
    { code: 'BIZ.CRM', name: 'CRM', description: 'Customer relationship management', parent: 'BIZ' },
    { code: 'BIZ.MARKET', name: 'Marketing', description: 'Marketing tools', parent: 'BIZ' },
    { code: 'BIZ.SALES', name: 'Sales', description: 'Sales tools', parent: 'BIZ' },
    { code: 'BIZ.FIN', name: 'Finance', description: 'Finance and accounting', parent: 'BIZ' },
    { code: 'BIZ.HR', name: 'HR', description: 'Human resources', parent: 'BIZ' },
    { code: 'BIZ.COMM', name: 'Communication', description: 'Team communication', parent: 'BIZ' },

    // Content
    { code: 'CONTENT', name: 'Content', description: 'Content creation and management' },
    { code: 'CONTENT.CMS', name: 'CMS', description: 'Content management systems', parent: 'CONTENT' },
    { code: 'CONTENT.WRITE', name: 'Writing', description: 'Writing and editing tools', parent: 'CONTENT' },
    { code: 'CONTENT.VIDEO', name: 'Video', description: 'Video production', parent: 'CONTENT' },
    { code: 'CONTENT.AUDIO', name: 'Audio', description: 'Audio production', parent: 'CONTENT' },

    // Learning
    { code: 'LEARN', name: 'Learning', description: 'Educational resources' },
    { code: 'LEARN.COURSE', name: 'Courses', description: 'Online courses', parent: 'LEARN' },
    { code: 'LEARN.DOC', name: 'Documentation', description: 'Documentation and guides', parent: 'LEARN' },
    { code: 'LEARN.TUTORIAL', name: 'Tutorials', description: 'Tutorials and how-tos', parent: 'LEARN' },

    // Other
    { code: 'OTHER', name: 'Other', description: 'Miscellaneous resources' },
];

/**
 * Organization hierarchy codes
 */
export const ORGANIZATION_HIERARCHIES: HierarchyDefinition[] = [
    // Corporate
    { code: 'CORP', name: 'Corporate', description: 'Corporate entities' },
    { code: 'CORP.TECH', name: 'Tech Company', description: 'Technology companies', parent: 'CORP' },
    { code: 'CORP.TECH.FAANG', name: 'FAANG', description: 'Major tech giants', parent: 'CORP.TECH' },
    { code: 'CORP.TECH.SAAS', name: 'SaaS', description: 'SaaS companies', parent: 'CORP.TECH' },
    { code: 'CORP.TECH.STARTUP', name: 'Startup', description: 'Tech startups', parent: 'CORP.TECH' },
    { code: 'CORP.AGENCY', name: 'Agency', description: 'Service agencies', parent: 'CORP' },
    { code: 'CORP.CONSULT', name: 'Consulting', description: 'Consulting firms', parent: 'CORP' },

    // Open Source
    { code: 'OSS', name: 'Open Source', description: 'Open source projects' },
    { code: 'OSS.FOUND', name: 'Foundation', description: 'Open source foundations', parent: 'OSS' },
    { code: 'OSS.COMM', name: 'Community', description: 'Community projects', parent: 'OSS' },
    { code: 'OSS.INDIE', name: 'Independent', description: 'Independent developers', parent: 'OSS' },

    // Academic
    { code: 'ACAD', name: 'Academic', description: 'Academic institutions' },
    { code: 'ACAD.UNIV', name: 'University', description: 'Universities', parent: 'ACAD' },
    { code: 'ACAD.RESEARCH', name: 'Research', description: 'Research institutions', parent: 'ACAD' },

    // Government
    { code: 'GOV', name: 'Government', description: 'Government entities' },
    { code: 'GOV.FED', name: 'Federal', description: 'Federal government', parent: 'GOV' },
    { code: 'GOV.STATE', name: 'State', description: 'State government', parent: 'GOV' },

    // Individual
    { code: 'IND', name: 'Individual', description: 'Individual creators' },
    { code: 'IND.DEV', name: 'Developer', description: 'Individual developers', parent: 'IND' },
    { code: 'IND.CREATOR', name: 'Creator', description: 'Content creators', parent: 'IND' },

    // Other
    { code: 'OTHER', name: 'Other', description: 'Other organizations' },
];

/**
 * Default metadata values
 */
export const DEFAULT_METADATA: ResourceMetadata = {
    title: '',
    function: '',
    category: 'Other',
    subCategory: '',
    parentOrganization: '',
    dateAdded: new Date().toISOString(),
    logo: null,
    tags: [],
    differentiation: '',
    functionHierarchyCode: 'OTHER',
    organizationHierarchyCode: 'OTHER',
    description: '',
    url: '',
};
