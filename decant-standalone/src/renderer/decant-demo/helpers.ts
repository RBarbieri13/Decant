export function getTypeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    'Website': 'website', 'Video': 'video', 'X': 'x', 'Tool': 'tool',
    'Social': 'social', 'Repo': 'repo', 'Tutorial': 'tutorial', 'Course': 'course',
    'Guide': 'guide', 'News': 'news', 'Image': 'image', 'Reference': 'reference',
    'Unknown': 'unknown',
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
  pink: '#ec4899', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  purple: '#a78bfa', orange: '#f97316', teal: '#14b8a6', red: '#ef4444',
};

export const SEGMENT_HEX_MAP: Record<string, string> = {
  A: '#ec4899',  // AI — pink
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
