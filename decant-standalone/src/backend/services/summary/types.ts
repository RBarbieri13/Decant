// ============================================================
// Node Summary Types
// Structured AI-generated summary for the detail panel
// ============================================================

export interface SummaryCategory {
  label: string;
  color: 'blue' | 'teal' | 'coral' | 'pink' | 'gray' | 'green' | 'amber' | 'red' | 'purple';
}

export interface SummaryStat {
  label: string;
  value: string;
  color?: 'success' | 'danger' | 'warning' | 'info' | null;
}

export interface SummaryEntity {
  name: string;
  abbreviation: string;
  role: string;
  color: 'blue' | 'teal' | 'coral' | 'pink' | 'gray' | 'green' | 'amber' | 'red' | 'purple';
}

export interface SummaryRelationship {
  from: string;
  to: string;
  label: string;
}

export interface SummaryTimelineItem {
  date: string;
  description: string;
  status: 'complete' | 'active' | 'upcoming';
}

export interface SummaryQuickOutline {
  heading: string;
  bullets: string[];
}

export interface NodeSummary {
  category: SummaryCategory;
  title: string;
  summary: string;
  quick_outline: SummaryQuickOutline;
  stats: SummaryStat[];
  entities: SummaryEntity[];
  relationships: SummaryRelationship[];
  timeline: SummaryTimelineItem[];
  tags: string[];
  link_label: string | null;
}
