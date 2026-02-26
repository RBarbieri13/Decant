// ============================================================
// Comprehensive Icon Database for Hierarchy Tree
// ============================================================
// All icons use the Boxicons library (https://boxicons.com)
// Prefix conventions: bx- (regular), bxs- (solid), bxl- (logo)

// ============================================================
// Segment Icons (top-level hierarchy nodes)
// ============================================================

export const SEGMENT_ICONS: Record<string, string> = {
  A: 'bxs-brain',
  T: 'bxs-chip',
  F: 'bxs-bank',
  S: 'bxs-trophy',
  H: 'bxs-heart',
  B: 'bxs-briefcase-alt-2',
  E: 'bxs-movie-play',
  L: 'bxs-home-heart',
  X: 'bxs-flask',
  C: 'bxs-palette',
};

// ============================================================
// Category Icons (second-level hierarchy nodes)
// Every category code gets a unique, semantically appropriate icon
// ============================================================

export const CATEGORY_ICONS: Record<string, Record<string, string>> = {
  // AI & Machine Learning (A)
  A: {
    LLM: 'bxs-conversation',
    AGT: 'bxs-bot',
    FND: 'bxs-cube-alt',
    MLO: 'bxs-server',
    NLP: 'bxs-message-rounded-dots',
    CVS: 'bxs-camera',
    GEN: 'bxs-magic-wand',
    ETH: 'bxs-shield-alt-2',
    RES: 'bxs-book-content',
    OTH: 'bxs-category',
  },

  // Technology & Development (T)
  T: {
    WEB: 'bxs-globe',
    MOB: 'bxs-mobile',
    DEV: 'bxs-terminal',
    CLD: 'bxs-cloud',
    SEC: 'bxs-lock-alt',
    DAT: 'bxs-data',
    API: 'bxs-plug',
    OPS: 'bxs-cog',
    HRD: 'bxs-microchip',
    OTH: 'bxs-category',
  },

  // Finance & Economics (F)
  F: {
    INV: 'bxs-bar-chart-alt-2',
    CRY: 'bxl-bitcoin',
    FPA: 'bxs-spreadsheet',
    BNK: 'bxs-bank',
    TAX: 'bxs-receipt',
    PFN: 'bxs-wallet',
    MKT: 'bxs-trending-up',
    REL: 'bxs-building-house',
    ECN: 'bxs-analyse',
    OTH: 'bxs-category',
  },

  // Sports & Fitness (S)
  S: {
    NFL: 'bx-football',
    FAN: 'bxs-star',
    FIT: 'bxs-heart-circle',
    RUN: 'bx-run',
    GYM: 'bxs-dumbbell',
    NBA: 'bx-basketball',
    MLB: 'bx-baseball',
    SOC: 'bx-football',
    OLY: 'bxs-medal',
    OTH: 'bxs-category',
  },

  // Health & Wellness (H)
  H: {
    MED: 'bxs-first-aid',
    MNT: 'bxs-brain',
    NUT: 'bxs-leaf',
    SLP: 'bxs-moon',
    ACC: 'bxs-universal-access',
    WEL: 'bxs-spa',
    FRT: 'bxs-baby-carriage',
    AGE: 'bxs-hourglass',
    DIS: 'bxs-virus',
    OTH: 'bxs-category',
  },

  // Business & Productivity (B)
  B: {
    STR: 'bxs-chess',
    MNG: 'bxs-user-badge',
    PRD: 'bxs-box',
    MKT: 'bxs-megaphone',
    SAL: 'bxs-dollar-circle',
    OPS: 'bxs-cog',
    HRS: 'bxs-group',
    STP: 'bxs-rocket',
    ENT: 'bxs-buildings',
    OTH: 'bxs-category',
  },

  // Entertainment & Media (E)
  E: {
    GAM: 'bxs-joystick',
    MUS: 'bxs-music',
    MOV: 'bxs-film',
    STR: 'bxs-tv',
    SOC: 'bxs-chat',
    POP: 'bxs-star',
    POD: 'bxs-microphone',
    CEL: 'bxs-crown',
    EVT: 'bxs-calendar-event',
    OTH: 'bxs-category',
  },

  // Lifestyle & Personal (L)
  L: {
    HOM: 'bxs-home',
    FAS: 'bxs-t-shirt',
    FOD: 'bxs-bowl-hot',
    TRV: 'bxs-plane-alt',
    REL: 'bxs-heart',
    PAR: 'bxs-baby-carriage',
    PET: 'bxs-dog',
    HOB: 'bxs-paint',
    GAR: 'bxs-tree',
    OTH: 'bxs-category',
  },

  // Science & Research (X)
  X: {
    PHY: 'bxs-atom',
    BIO: 'bxs-vial',
    CHM: 'bxs-flask',
    AST: 'bxs-planet',
    ENV: 'bxs-leaf',
    MAT: 'bxs-calculator',
    ENG: 'bxs-wrench',
    SOC: 'bxs-group',
    PSY: 'bxs-brain',
    OTH: 'bxs-category',
  },

  // Creative & Design (C)
  C: {
    UXD: 'bxs-layout',
    GRD: 'bxs-brush',
    WRT: 'bxs-pencil',
    PHO: 'bxs-camera',
    VID: 'bxs-video',
    AUD: 'bxs-music',
    ART: 'bxs-palette',
    ANI: 'bxs-ghost',
    TYP: 'bxs-font-family',
    OTH: 'bxs-category',
  },
};

// ============================================================
// Content Type Icons (leaf-level nodes / item type indicator)
// ============================================================

export const CONTENT_TYPE_ICONS: Record<string, string> = {
  T: 'bxs-wrench',
  A: 'bxs-file',
  V: 'bxs-video',
  P: 'bxs-book-content',
  R: 'bxl-github',
  G: 'bxs-book-reader',
  S: 'bxs-cloud',
  C: 'bxs-graduation',
  I: 'bxs-image',
  N: 'bxs-news',
  K: 'bxs-book-bookmark',
  U: 'bxs-file-blank',
};

// ============================================================
// Organization Icons (known companies/orgs)
// ============================================================

export const ORGANIZATION_ICONS: Record<string, string> = {
  ANTH: 'bxs-bot',
  OAIA: 'bxs-brain',
  GOOG: 'bxl-google',
  MSFT: 'bxl-microsoft',
  META: 'bxl-meta',
  AMZN: 'bxl-amazon',
  AAPL: 'bxl-apple',
  NFLX: 'bxs-tv',
  NVDA: 'bxs-chip',
  GHUB: 'bxl-github',
  STRP: 'bxs-credit-card',
  TWTR: 'bxl-twitter',
  LINK: 'bxl-linkedin',
  SPOT: 'bxl-spotify',
  SLCK: 'bxl-slack',
  ZOOM: 'bxs-video',
  FIGM: 'bxl-figma',
  NTON: 'bxs-notepad',
  DSCR: 'bxl-discord',
  RDIT: 'bxl-reddit',
  YCTB: 'bxs-rocket',
  HWRD: 'bxs-graduation',
  STFD: 'bxs-graduation',
  MIT_: 'bxs-graduation',
  UNKN: 'bxs-buildings',
};

// ============================================================
// Keyword-Based Icon Lookup
// Maps common keywords found in node titles or categories to icons
// Used as a fallback when no specific category icon matches
// ============================================================

export const KEYWORD_ICONS: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['terminal', 'cli', 'command', 'shell', 'bash'], icon: 'bxs-terminal' },
  { keywords: ['code', 'coding', 'programming', 'develop'], icon: 'bx-code-alt' },
  { keywords: ['work', 'job', 'career', 'employ'], icon: 'bxs-briefcase' },
  { keywords: ['money', 'payment', 'pay', 'billing'], icon: 'bxs-dollar-circle' },
  { keywords: ['email', 'mail', 'inbox', 'newsletter'], icon: 'bxs-envelope' },
  { keywords: ['chat', 'message', 'conversation', 'discuss'], icon: 'bxs-chat' },
  { keywords: ['database', 'sql', 'postgres', 'mongo', 'redis'], icon: 'bxs-data' },
  { keywords: ['api', 'endpoint', 'rest', 'graphql'], icon: 'bxs-plug' },
  { keywords: ['cloud', 'aws', 'azure', 'gcp', 'deploy'], icon: 'bxs-cloud' },
  { keywords: ['security', 'auth', 'password', 'encrypt'], icon: 'bxs-lock-alt' },
  { keywords: ['test', 'testing', 'qa', 'quality'], icon: 'bxs-check-shield' },
  { keywords: ['analytics', 'metrics', 'dashboard', 'monitor'], icon: 'bxs-bar-chart-alt-2' },
  { keywords: ['design', 'ui', 'ux', 'interface'], icon: 'bxs-layout' },
  { keywords: ['photo', 'image', 'picture', 'visual'], icon: 'bxs-image' },
  { keywords: ['video', 'stream', 'youtube', 'film'], icon: 'bxs-video' },
  { keywords: ['audio', 'music', 'sound', 'podcast'], icon: 'bxs-music' },
  { keywords: ['book', 'read', 'library', 'reference'], icon: 'bxs-book' },
  { keywords: ['learn', 'course', 'education', 'tutor'], icon: 'bxs-graduation' },
  { keywords: ['search', 'find', 'discover', 'explore'], icon: 'bxs-search' },
  { keywords: ['map', 'location', 'geo', 'navigate'], icon: 'bxs-map' },
  { keywords: ['calendar', 'schedule', 'event', 'date'], icon: 'bxs-calendar' },
  { keywords: ['file', 'document', 'doc', 'pdf'], icon: 'bxs-file-doc' },
  { keywords: ['folder', 'directory', 'organize'], icon: 'bxs-folder' },
  { keywords: ['user', 'profile', 'account', 'person'], icon: 'bxs-user' },
  { keywords: ['team', 'group', 'collab', 'community'], icon: 'bxs-group' },
  { keywords: ['robot', 'automat', 'bot', 'agent'], icon: 'bxs-bot' },
  { keywords: ['chart', 'graph', 'visual', 'plot'], icon: 'bxs-chart' },
  { keywords: ['network', 'connect', 'link', 'node'], icon: 'bx-network-chart' },
  { keywords: ['server', 'host', 'infra', 'backend'], icon: 'bxs-server' },
  { keywords: ['mobile', 'phone', 'app', 'ios', 'android'], icon: 'bxs-mobile' },
  { keywords: ['web', 'website', 'browser', 'internet'], icon: 'bxs-globe' },
  { keywords: ['git', 'version', 'repo', 'commit'], icon: 'bxl-git' },
  { keywords: ['python', 'django', 'flask'], icon: 'bxl-python' },
  { keywords: ['javascript', 'typescript', 'react', 'node'], icon: 'bxl-javascript' },
  { keywords: ['docker', 'container', 'kubernetes'], icon: 'bxl-docker' },
  { keywords: ['game', 'gaming', 'play', 'esport'], icon: 'bxs-joystick' },
  { keywords: ['news', 'press', 'journal', 'media'], icon: 'bxs-news' },
  { keywords: ['health', 'medical', 'doctor', 'clinic'], icon: 'bxs-first-aid' },
  { keywords: ['food', 'recipe', 'cook', 'restaurant'], icon: 'bxs-bowl-hot' },
  { keywords: ['travel', 'flight', 'hotel', 'vacation'], icon: 'bxs-plane-alt' },
  { keywords: ['shopping', 'store', 'ecommerce', 'buy'], icon: 'bxs-cart' },
  { keywords: ['sport', 'fitness', 'exercise', 'athlete'], icon: 'bxs-trophy' },
  { keywords: ['crypto', 'bitcoin', 'blockchain', 'web3'], icon: 'bxl-bitcoin' },
  { keywords: ['ai', 'artificial', 'intelligence', 'neural'], icon: 'bxs-brain' },
  { keywords: ['machine learning', 'ml', 'model', 'train'], icon: 'bxs-chip' },
  { keywords: ['writing', 'blog', 'article', 'content'], icon: 'bxs-edit' },
  { keywords: ['startup', 'founder', 'venture', 'incubator'], icon: 'bxs-rocket' },
  { keywords: ['marketing', 'advertis', 'campaign', 'brand'], icon: 'bxs-megaphone' },
  { keywords: ['legal', 'law', 'compliance', 'regulat'], icon: 'bxs-book-alt' },
  { keywords: ['science', 'research', 'experiment', 'lab'], icon: 'bxs-flask' },
  { keywords: ['math', 'calcul', 'statistic', 'formula'], icon: 'bxs-calculator' },
  { keywords: ['space', 'astro', 'nasa', 'planet'], icon: 'bxs-planet' },
  { keywords: ['weather', 'climate', 'environment'], icon: 'bxs-sun' },
  { keywords: ['home', 'house', 'apartment', 'real estate'], icon: 'bxs-home' },
  { keywords: ['car', 'vehicle', 'auto', 'transport'], icon: 'bxs-car' },
  { keywords: ['fashion', 'clothing', 'wear', 'style'], icon: 'bxs-t-shirt' },
  { keywords: ['pet', 'dog', 'cat', 'animal'], icon: 'bxs-dog' },
  { keywords: ['garden', 'plant', 'nature', 'outdoor'], icon: 'bxs-tree' },
];

// ============================================================
// Icon Lookup Utility Functions
// ============================================================

export function getSegmentIcon(segmentCode: string): string {
  return SEGMENT_ICONS[segmentCode] || 'bxs-folder';
}

export function getCategoryIcon(segmentCode: string, categoryCode: string): string {
  return CATEGORY_ICONS[segmentCode]?.[categoryCode] || 'bxs-folder';
}

export function getContentTypeIcon(contentTypeCode: string): string {
  return CONTENT_TYPE_ICONS[contentTypeCode] || 'bxs-file';
}

export function getOrganizationIcon(orgCode: string): string {
  return ORGANIZATION_ICONS[orgCode] || 'bxs-buildings';
}

export function getIconByKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const entry of KEYWORD_ICONS) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return entry.icon;
    }
  }
  return null;
}
