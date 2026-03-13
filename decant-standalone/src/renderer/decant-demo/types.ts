export type ViewMode = 'table' | 'grid' | 'tree' | 'list' | 'dashboard';
export type TagColor = 'blue' | 'yellow' | 'pink' | 'green' | 'purple' | 'gray' | 'orange' | 'teal';
export type PanelTab = 'properties' | 'related' | 'backlinks';
export type ColumnFilters = Record<string, string>;
export type RowColor = 'pink' | 'yellow' | 'blue' | 'green' | 'red' | 'cream' | 'default';
export type SortKey = 'title' | 'segment' | 'category' | 'subcategoryLabel' | 'quickPhrase' | 'shortDescription' | 'functionTags' | 'date' | 'company';
export type SortDir = 'asc' | 'desc';
export type ColumnWidths = Record<string, number>;

export interface BreadcrumbItem {
  label: string;
  id?: string;
}

export interface TreeNodeData {
  id: string;
  name: string;
  iconHint: string;
  iconColor: string;
  iconType?: string;
  children?: TreeNodeData[];
  isExpanded?: boolean;
}

export interface HierarchyFilter {
  type: 'all' | 'segment' | 'category';
  segmentCode?: string;
  categoryCode?: string;
}

export interface TableRow {
  id: string;
  segmentCode: string;
  categoryCode: string;
  logo: string;
  title: string;
  type: string;
  typeSymbol: string;
  segment: string;
  category: string;
  subcategoryLabel: string;
  hierarchy: string;
  quickPhrase: string;
  functionTags: string;
  tags: { label: string; color: TagColor }[];
  date: string;
  company: string;
  starred: boolean;
  rowColor?: RowColor;
  checked?: boolean;
  shortDescription: string;
  url?: string;
  sourceDomain?: string;
  aiSummary?: string;
  keyConcepts?: string[];
  version?: string;
  license?: string;
  author?: string;
  repository?: string;
  stars?: string;
  forks?: string;
  downloads?: string;
  lastUpdated?: string;
  usedBy?: string[];
  description?: string;
  userTags?: { id: string; name: string; color: string }[];
}

export const DEFAULT_SEGMENT_LABELS: Record<string, string> = {
  A: 'AI & Machine Learning', T: 'Technology & Development', F: 'Finance & Economics', S: 'Sports & Fitness',
  H: 'Health & Wellness', B: 'Business & Productivity', E: 'Entertainment & Media', L: 'Lifestyle & Personal',
  X: 'Science & Research', C: 'Creative & Design',
};

export const DEFAULT_CATEGORY_LABELS: Record<string, Record<string, string>> = {
  A: { LLM: 'Large Language Models', AGT: 'AI Agents', FND: 'Foundation Models', MLO: 'MLOps', NLP: 'Natural Language Processing', CVS: 'Computer Vision', GEN: 'Generative AI', ETH: 'AI Ethics', RES: 'AI Research', OTH: 'Other AI' },
  T: { WEB: 'Web Development', MOB: 'Mobile Development', DEV: 'Developer Tools', CLD: 'Cloud & Infrastructure', SEC: 'Security', DAT: 'Data Engineering', API: 'APIs & Integrations', OPS: 'DevOps', HRD: 'Hardware', OTH: 'Other Tech' },
  F: { INV: 'Investing', CRY: 'Crypto & Blockchain', FPA: 'FP&A', BNK: 'Banking', TAX: 'Tax & Accounting', PFN: 'Personal Finance', MKT: 'Markets', REL: 'Real Estate', ECN: 'Economics', OTH: 'Other Finance' },
  S: { NFL: 'NFL Football', FAN: 'Fantasy Sports', FIT: 'Fitness', RUN: 'Running', GYM: 'Gym & Training', NBA: 'Basketball', MLB: 'Baseball', SOC: 'Soccer', OLY: 'Olympics', OTH: 'Other Sports' },
  H: { MED: 'Medical', MNT: 'Mental Health', NUT: 'Nutrition', SLP: 'Sleep', ACC: 'Accessibility', WEL: 'Wellness', FRT: 'Fertility', AGE: 'Aging', DIS: 'Disease', OTH: 'Other Health' },
  B: { STR: 'Strategy', MNG: 'Management', PRD: 'Product', MKT: 'Marketing', SAL: 'Sales', OPS: 'Operations', HRS: 'HR & People', STP: 'Startups', ENT: 'Enterprise', OTH: 'Other Business' },
  E: { GAM: 'Gaming', MUS: 'Music', MOV: 'Movies & TV', STR: 'Streaming', SOC: 'Social Media', POP: 'Pop Culture', POD: 'Podcasts', CEL: 'Celebrities', EVT: 'Events', OTH: 'Other Entertainment' },
  L: { HOM: 'Home', FAS: 'Fashion', FOD: 'Food & Cooking', TRV: 'Travel', REL: 'Relationships', PAR: 'Parenting', PET: 'Pets', HOB: 'Hobbies', GAR: 'Garden', OTH: 'Other Lifestyle' },
  X: { PHY: 'Physics', BIO: 'Biology', CHM: 'Chemistry', AST: 'Astronomy', ENV: 'Environment', MAT: 'Mathematics', ENG: 'Engineering', SOC: 'Social Sciences', PSY: 'Psychology', OTH: 'Other Science' },
  C: { UXD: 'UX Design', GRD: 'Graphic Design', WRT: 'Writing', PHO: 'Photography', VID: 'Video Production', AUD: 'Audio Production', ART: 'Fine Art', ANI: 'Animation', TYP: 'Typography', OTH: 'Other Creative' },
};

export const CONTENT_TYPE_SYMBOLS: Record<string, string> = {
  T: '\u{1F527}', A: '\u{1F4C4}', V: '\u{1F3AC}', P: '\u{1F4DA}', R: '\u{1F4E6}',
  G: '\u{1F4D6}', S: '\u{2601}', C: '\u{1F393}', I: '\u{1F5BC}', N: '\u{1F4F0}',
  K: '\u{1F4DA}', U: '\u{2753}',
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  T: 'Tool', A: 'Website', V: 'Video', P: 'Tutorial',
  R: 'Repo', G: 'Guide', S: 'Social', C: 'Course',
  I: 'Image', N: 'News', K: 'Reference', U: 'Unknown',
};

export const GUMROAD_ICON_COLORS: Record<string, string> = {
  pink: '#ff90e8',
  blue: '#90a8ed',
  green: '#23a094',
  yellow: '#f1c40f',
};

export const SAMPLE_TREE_DATA: TreeNodeData[] = [];
export const SAMPLE_TABLE_DATA: TableRow[] = [];
