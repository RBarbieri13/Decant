// ============================================================
// Decant Shared Types
// ============================================================

// Node types in the hierarchy
export type NodeType = 'segment' | 'category' | 'content_type' | 'subcategory' | 'item' | 'organization' | 'custom_space';

// Content type codes
export type ContentTypeCode = 
  | 'T'  // Website/Tool (interactive platform, SaaS)
  | 'A'  // Article (written content, blog, docs)
  | 'V'  // Video (YouTube, Vimeo)
  | 'P'  // Podcast (episodic audio/video)
  | 'R'  // Research Paper (academic, whitepaper)
  | 'G'  // Repository (GitHub, code libraries)
  | 'S'  // Social Post (Twitter, LinkedIn)
  | 'C'  // Course/Tutorial (structured learning)
  | 'I'  // Image/Graphic (infographics)
  | 'N'  // Newsletter (email content)
  | 'K'  // Book/eBook
  | 'U'; // Audio (music, sound files)

// Segment codes
export type SegmentCode = 
  | 'A'  // AI (artificial intelligence, ML, LLMs)
  | 'T'  // Technology (software, hardware, dev tools)
  | 'F'  // Finance (money, investing, FP&A)
  | 'S'  // Sports (football, fantasy, athletics)
  | 'H'  // Health (medical, wellness, accessibility)
  | 'B'  // Business (strategy, operations, management)
  | 'E'  // Entertainment (media, gaming, music)
  | 'L'  // Lifestyle (home, fashion, food, travel)
  | 'X'  // Science (research, academia)
  | 'C'; // Creative (design, art, writing)

// Metadata tag types
export type MetadataTagType = 'ORG' | 'FNC' | 'TEC' | 'LIC' | 'USR';

// Hierarchy view type
export type HierarchyView = 'function' | 'organization';

// Processing status
export type ProcessingStatus = 'pending' | 'processing' | 'complete' | 'failed';

// Gumroad colors
export type GumroadColor = 'pink' | 'yellow' | 'blue' | 'green';

// ============================================================
// Core Node Interface
// ============================================================

export interface Node {
  id: string;
  title: string;
  nodeType: NodeType;

  // Hierarchy codes
  functionCode: string | null;
  organizationCode: string | null;

  // Parent references (dual hierarchy)
  functionParentId: string | null;
  organizationParentId: string | null;

  // Position in sibling list
  functionPosition: number;
  organizationPosition: number;

  // For items: source content
  sourceUrl: string | null;
  faviconPath: string | null;
  thumbnailPath: string | null;

  // AI-generated content (Phase 1)
  aiSummary: string | null;
  aiKeyPoints: string[] | null;
  aiConfidence: number | null;

  // Phase 2 enrichment fields
  company: string | null;
  phraseDescription: string | null;
  shortDescription: string | null;
  descriptorString: string | null;
  phase2Completed: boolean;

  // Metadata
  contentTypeCode: ContentTypeCode | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

// ============================================================
// Tree Node (for UI rendering)
// ============================================================

export interface TreeNode {
  id: string;
  title: string;
  nodeType: NodeType;
  color?: GumroadColor;
  children: TreeNode[];
  isExpanded?: boolean;
  contentTypeCode?: ContentTypeCode | null;
  sourceUrl?: string | null;
  faviconPath?: string | null;
}

// ============================================================
// Metadata Tag
// ============================================================

export interface MetadataTag {
  id: string;
  nodeId: string;
  tagType: MetadataTagType;
  tagCode: string;
  createdAt: string;
}

// ============================================================
// Extracted Field
// ============================================================

export interface ExtractedField {
  id: string;
  nodeId: string;
  fieldName: string;
  fieldValue: string | null;
  fieldType: 'text' | 'number' | 'date' | 'url' | 'json';
  createdAt: string;
}

// ============================================================
// Segment
// ============================================================

export interface Segment {
  id: string;
  segmentCode: SegmentCode;
  segmentName: string;
  color: GumroadColor;
  icon: string | null;
}

// ============================================================
// Organization
// ============================================================

export interface Organization {
  id: string;
  orgCode: string;
  orgName: string;
  logoPath: string | null;
}

// ============================================================
// Custom Space
// ============================================================

export interface CustomSpace {
  id: string;
  spaceName: string;
  description: string | null;
  color: GumroadColor | null;
}

// ============================================================
// Processing Queue Item
// ============================================================

export interface ProcessingQueueItem {
  id: string;
  nodeId: string;
  phase: 'phase1' | 'phase2';
  status: ProcessingStatus;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

// ============================================================
// IPC Request/Response Types
// ============================================================

export interface CreateNodeInput {
  title: string;
  nodeType: NodeType;
  functionParentId?: string | null;
  organizationParentId?: string | null;
  sourceUrl?: string | null;
  contentTypeCode?: ContentTypeCode | null;
}

export interface UpdateNodeInput {
  title?: string;
  functionParentId?: string | null;
  organizationParentId?: string | null;
  functionPosition?: number;
  organizationPosition?: number;
  aiSummary?: string | null;
  aiKeyPoints?: string[];
  aiConfidence?: number;
}

export interface SearchFilters {
  contentType?: ContentTypeCode[];
  segmentCode?: SegmentCode[];
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface SearchResult {
  node: Node;
  matchedField: string;
  matchedText: string;
  score: number;
}

export interface ImportResult {
  success: boolean;
  nodeId?: string;
  error?: string;
  classification?: AIClassification;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  complete: number;
  failed: number;
}

// ============================================================
// AI Classification (Phase 1 - Quick Classification)
// ============================================================

export interface AIClassification {
  // Quick classification results
  segment: string;           // Single uppercase letter (A, T, F, S, etc.)
  category: string;          // 3 uppercase letters (LLM, AGT, FND, etc.)
  contentType: string;       // Single uppercase letter (T, A, V, P, etc.)
  organization: string;      // 4 uppercase letters (ANTH, OAIA, etc.)
  confidence: number;        // 0-1 confidence score
  reasoning: string;         // Brief explanation
}

// ============================================================
// Deep Analysis Result (Phase 2 - Background Enrichment)
// ============================================================

export interface DeepAnalysisResult {
  title: string;
  company: string;
  phraseDescription: string;      // Ultra-brief tagline, max 100 chars
  shortDescription: string;       // 1-3 sentence summary, max 500 chars
  keyConcepts: string[];          // Lowercase human-readable tags
  metadataCodes: {
    ORG: string[];   // Organization codes
    FNC: string[];   // Function/capability codes
    TEC: string[];   // Technology codes
    CON: string[];   // Concept/theme codes
    IND: string[];   // Industry codes
    AUD: string[];   // Audience codes
    PRC: string[];   // Pricing model codes
    PLT: string[];   // Platform codes
  };
}

// ============================================================
// Extended Metadata Tag Types (from Phase 2)
// ============================================================

export type ExtendedMetadataTagType =
  | 'ORG'   // Organization
  | 'FNC'   // Function/capability
  | 'TEC'   // Technology
  | 'CON'   // Concept/theme
  | 'IND'   // Industry
  | 'AUD'   // Audience
  | 'PRC'   // Pricing
  | 'PLT'   // Platform
  | 'DOM';  // Domain

// ============================================================
// Extracted Content (from scraper)
// ============================================================

export interface ExtractedContent {
  url: string;
  title: string;
  description: string | null;
  content: string | null;
  author: string | null;
  date: string | null;
  image: string | null;
  favicon: string | null;
  siteName: string | null;
}

// ============================================================
// IPC Channel Types
// ============================================================

export interface IPCChannels {
  // Nodes
  'nodes:create': (data: CreateNodeInput) => Promise<Node>;
  'nodes:read': (id: string) => Promise<Node | null>;
  'nodes:update': (id: string, data: UpdateNodeInput) => Promise<Node>;
  'nodes:delete': (id: string) => Promise<void>;
  'nodes:move': (id: string, newParentId: string, view: HierarchyView) => Promise<void>;
  'nodes:merge': (primaryId: string, secondaryId: string, options: { keepMetadata: boolean; appendSummary: boolean }) => Promise<Node>;

  // Hierarchy
  'hierarchy:get-tree': (view: HierarchyView, rootId?: string) => Promise<TreeNode[]>;
  'hierarchy:get-path': (nodeId: string, view: HierarchyView) => Promise<Node[]>;
  'hierarchy:get-segments': () => Promise<Segment[]>;
  'hierarchy:get-organizations': () => Promise<Organization[]>;

  // Import
  'import:url': (url: string) => Promise<ImportResult>;
  'import:status': () => Promise<QueueStatus>;

  // Search
  'search:query': (query: string, filters?: SearchFilters) => Promise<SearchResult[]>;

  // Settings
  'settings:get': (key: string) => Promise<string | null>;
  'settings:set': (key: string, value: string) => Promise<void>;
  'settings:get-api-key': () => Promise<string | null>;
  'settings:set-api-key': (key: string) => Promise<void>;
}

// ============================================================
// Window API (exposed via preload)
// ============================================================

export interface DecantAPI {
  nodes: {
    create: (data: CreateNodeInput) => Promise<Node>;
    read: (id: string) => Promise<Node | null>;
    update: (id: string, data: UpdateNodeInput) => Promise<Node>;
    delete: (id: string) => Promise<void>;
    move: (id: string, newParentId: string, view: HierarchyView) => Promise<void>;
    merge: (primaryId: string, secondaryId: string, options: { keepMetadata: boolean; appendSummary: boolean }) => Promise<Node>;
  };
  hierarchy: {
    getTree: (view: HierarchyView, rootId?: string) => Promise<TreeNode[]>;
    getPath: (nodeId: string, view: HierarchyView) => Promise<Node[]>;
    getSegments: () => Promise<Segment[]>;
    getOrganizations: () => Promise<Organization[]>;
  };
  import: {
    url: (url: string) => Promise<ImportResult>;
    status: () => Promise<QueueStatus>;
    onProgress: (callback: (event: unknown, progress: number) => void) => void;
  };
  search: {
    query: (query: string, filters?: SearchFilters) => Promise<SearchResult[]>;
  };
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    getApiKey: () => Promise<string | null>;
    setApiKey: (key: string) => Promise<void>;
  };
  data: {
    export: () => Promise<{ success: boolean; data?: string; error?: string }>;
    import: (jsonData: string) => Promise<{ success: boolean; nodesImported?: number; error?: string }>;
  };
}

// Extend Window interface
declare global {
  interface Window {
    decantAPI: DecantAPI;
  }
}

// ============================================================
// Batch Import Types
// ============================================================

export type BatchImportItemStatus =
  | 'queued'      // Waiting in queue
  | 'validating'  // URL validation
  | 'fetching'    // Fetching content
  | 'classifying' // AI classification
  | 'saving'      // Database save
  | 'imported'    // Complete
  | 'failed'      // Error
  | 'duplicate';  // Skipped (already exists)

export interface BatchImportItem {
  id: string;                        // Unique ID for this import item
  url: string;                       // Original URL
  lineNumber: number;                // Line number from input textarea
  status: BatchImportItemStatus;
  progress: number;                  // 0-100 for individual item
  nodeId?: string;                   // Set when imported
  title?: string;                    // Extracted title
  favicon?: string;                  // Favicon URL
  classification?: AIClassification; // Set when classified
  error?: string;                    // Set if failed
  startedAt?: string;
  completedAt?: string;
}

export interface BatchImportOptions {
  autoClassify: boolean;             // Default true - use AI classification
  skipDuplicates: boolean;           // Default true - skip already imported URLs
  showInTreeWhenDone: boolean;       // Default true - reveal in tree after import
  maxConcurrent: number;             // Default 2 - concurrent imports
}

export interface BatchImportState {
  batchId: string;
  items: BatchImportItem[];
  options: BatchImportOptions;
  status: 'idle' | 'importing' | 'paused' | 'complete' | 'cancelled';
  startedAt?: string;
  completedAt?: string;
}

export interface BatchImportStats {
  total: number;
  imported: number;
  processing: number;
  queued: number;
  failed: number;
  duplicates: number;
}

// SSE Event types for batch import
export interface BatchImportProgressEvent {
  type: 'batch_import_progress';
  batchId: string;
  itemId: string;
  url: string;
  status: BatchImportItemStatus;
  progress: number;
  nodeId?: string;
  title?: string;
  favicon?: string;
  classification?: AIClassification;
  error?: string;
}

export interface BatchImportCompleteEvent {
  type: 'batch_import_complete';
  batchId: string;
  stats: BatchImportStats;
}
