export function getTypeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    'Website': 'website', 'Video': 'video', 'X': 'x', 'Tool': 'tool',
    'Social': 'social', 'Repo': 'repo', 'Tutorial': 'tutorial', 'Course': 'course',
    'Guide': 'guide', 'News': 'news', 'Image': 'image', 'Reference': 'reference',
    'Service': 'service', 'Article': 'article', 'Unknown': 'unknown',
  };
  return map[type] || 'unknown';
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = d.getUTCDate();
  const mm = d.getUTCMonth() + 1;
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function formatRelativeDate(dateStr: string): { display: string; full: string } {
  const full = formatDate(dateStr);
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (isNaN(diffDays)) return { display: full, full };
    if (diffDays < 1) return { display: 'Today', full };
    if (diffDays === 1) return { display: 'Yesterday', full };
    if (diffDays < 7) return { display: `${diffDays}d ago`, full };
    if (diffDays < 30) return { display: `${Math.floor(diffDays / 7)}wk ago`, full };
    if (diffDays < 180) return { display: `${Math.floor(diffDays / 30)}mo ago`, full };
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months[date.getMonth()];
    const y = String(date.getFullYear()).slice(2);
    return { display: `${m} '${y}`, full };
  } catch {
    return { display: full, full };
  }
}

export const SEGMENT_COLOR_HEX: Record<string, string> = {
  pink: '#2bae82', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  purple: '#a78bfa', orange: '#f97316', teal: '#14b8a6', red: '#ef4444',
};

export const SEGMENT_HEX_MAP: Record<string, string> = {
  A: '#2bae82',  // AI — teal accent
  T: '#3b82f6',  // Technology — blue
  F: '#22c55e',  // Finance — green
  S: '#eab308',  // Sports — yellow
  H: '#a78bfa',  // Health — purple
  B: '#f97316',  // Business — orange
  E: '#14b8a6',  // Entertainment — teal
  L: '#ef4444',  // Lifestyle — red
  X: '#3b82f6',  // Science — blue
  C: '#a78bfa',  // Creative — purple
};

/** Get the hex color for a segment code character (e.g. 'A' → '#2bae82') */
export function getSegmentHex(segCode: string): string {
  const char = (segCode || '').charAt(0).toUpperCase();
  return SEGMENT_HEX_MAP[char] || '#6b7280';
}

/** Get a style object for a segment pill/badge: { color, backgroundColor, borderColor } */
export function getSegmentStyle(segCode: string): { color: string; backgroundColor: string; borderColor: string } {
  const hex = getSegmentHex(segCode);
  return { color: hex, backgroundColor: hex + '18', borderColor: hex + '50' };
}

// ============================================================================
// BRUTALISM BADGE HELPERS
// ============================================================================

/** Map content type code to brutalism CLASS badge */
export function getClassBadge(contentTypeCode: string): { label: string; bg: string; text: string } {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    T: { label: 'TOOL',    bg: '#dbeafe', text: '#1e40af' },
    A: { label: 'ARTICLE', bg: '#fef3c7', text: '#92400e' },
    V: { label: 'VIDEO',   bg: '#fce7f3', text: '#9d174d' },
    R: { label: 'REPO',    bg: '#dcfce7', text: '#166534' },
    S: { label: 'SERVICE', bg: '#f3e8ff', text: '#6b21a8' },
    W: { label: 'WEBSITE', bg: '#f1f5f9', text: '#334155' },
    X: { label: 'SOCIAL',  bg: '#e0e7ff', text: '#3730a3' },
    N: { label: 'NEWS',    bg: '#fef2f2', text: '#991b1b' },
    C: { label: 'COURSE',  bg: '#ecfdf5', text: '#065f46' },
    G: { label: 'GUIDE',   bg: '#fffbeb', text: '#78350f' },
    I: { label: 'IMAGE',   bg: '#fdf4ff', text: '#86198f' },
    U: { label: 'TUTORIAL',bg: '#f0fdfa', text: '#134e4a' },
  };
  const code = (contentTypeCode || 'W').charAt(0).toUpperCase();
  return map[code] || { label: 'NODE', bg: '#f1f5f9', text: '#334155' };
}

/** Map segment code to brutalism CONTEXT badge */
export function getContextBadge(segmentCode: string): { label: string; bg: string; text: string } {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    A: { label: 'PROD-AI',    bg: '#f3e8ff', text: '#7e22ce' },
    T: { label: 'DEV-TOOLS',  bg: '#e2e8f0', text: '#334155' },
    F: { label: 'MARKET',     bg: '#fef9c3', text: '#854d0e' },
    B: { label: 'INFRA',      bg: '#dbeafe', text: '#1e40af' },
    S: { label: 'SPORTS',     bg: '#dcfce7', text: '#166534' },
    H: { label: 'HEALTH',     bg: '#fce7f3', text: '#9d174d' },
    E: { label: 'MEDIA',      bg: '#ccfbf1', text: '#115e59' },
    L: { label: 'LIFESTYLE',  bg: '#fee2e2', text: '#991b1b' },
    X: { label: 'SCIENCE',    bg: '#e0e7ff', text: '#3730a3' },
    C: { label: 'CREATIVE',   bg: '#fdf4ff', text: '#86198f' },
  };
  const code = (segmentCode || '').charAt(0).toUpperCase();
  return map[code] || { label: 'GENERAL', bg: '#f1f5f9', text: '#334155' };
}

/** Return shortened ID: "#" + first 4 hex chars */
export function shortId(uuid: string): string {
  if (!uuid) return '#0000';
  const clean = uuid.replace(/-/g, '');
  return '#' + clean.slice(0, 4);
}

/** Get RGBA background for glyph/expanded card areas */
export function getSegmentGlyphBg(segCode: string): string {
  const hex = getSegmentHex(segCode);
  // Convert hex to rgba with 0.1 alpha
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.1)`;
}
