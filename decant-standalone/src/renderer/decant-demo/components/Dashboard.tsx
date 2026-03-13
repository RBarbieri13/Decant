import React, { useMemo } from 'react';
import { TableRow } from '../types';

interface DashboardProps {
  data: TableRow[];
  onNavigateSegment?: (segCode: string) => void;
  onNavigateCategory?: (segCode: string, catCode: string) => void;
  onToggleStarred?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  onNavigateSegment,
  onNavigateCategory,
  onToggleStarred,
}) => {
  const stats = useMemo(() => {
    const total = data.length;
    const starred = data.filter(d => d.starred).length;
    const unclassified = data.filter(d => !d.segmentCode || d.segment === 'Uncategorized').length;
    const classifiedPct = total > 0 ? Math.round(((total - unclassified) / total) * 100) : 0;

    // Recent items (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = data.filter(d => new Date(d.date) >= sevenDaysAgo).length;

    // Segment distribution
    const segments = new Map<string, { label: string; code: string; count: number }>();
    for (const item of data) {
      const key = item.segmentCode || 'UNK';
      if (!segments.has(key)) {
        segments.set(key, { label: item.segment || 'Unknown', code: key, count: 0 });
      }
      segments.get(key)!.count++;
    }

    // Top categories
    const categories = new Map<string, { label: string; segCode: string; catCode: string; count: number }>();
    for (const item of data) {
      const key = `${item.segmentCode}-${item.categoryCode}`;
      if (!categories.has(key)) {
        categories.set(key, { label: item.category, segCode: item.segmentCode, catCode: item.categoryCode, count: 0 });
      }
      categories.get(key)!.count++;
    }

    // Recent items list
    const recentItems = [...data]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    // Content type distribution
    const types = new Map<string, number>();
    for (const item of data) {
      types.set(item.type, (types.get(item.type) || 0) + 1);
    }

    return {
      total,
      starred,
      unclassified,
      classifiedPct,
      recent,
      segments: [...segments.values()].sort((a, b) => b.count - a.count),
      topCategories: [...categories.values()].sort((a, b) => b.count - a.count).slice(0, 8),
      recentItems,
      types: [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, [data]);

  const segmentColors: Record<string, string> = {
    A: '#ec4899', H: '#ec4899', C: '#ec4899',
    T: '#3b82f6', B: '#3b82f6', X: '#3b82f6',
    F: '#22c55e', L: '#22c55e',
    S: '#eab308', E: '#eab308',
  };

  return (
    <div className="decant-dashboard">
      {/* Stat Cards Row */}
      <div className="decant-dashboard__stats">
        <div className="decant-dashboard__stat-card">
          <div className="decant-dashboard__stat-value">{stats.total.toLocaleString()}</div>
          <div className="decant-dashboard__stat-label">Total Items</div>
        </div>
        <div className="decant-dashboard__stat-card decant-dashboard__stat-card--accent">
          <div className="decant-dashboard__stat-value">{stats.recent}</div>
          <div className="decant-dashboard__stat-label">Added This Week</div>
        </div>
        <div className="decant-dashboard__stat-card" onClick={onToggleStarred} style={{ cursor: 'pointer' }}>
          <div className="decant-dashboard__stat-value">{stats.starred}</div>
          <div className="decant-dashboard__stat-label">Starred</div>
        </div>
        <div className="decant-dashboard__stat-card">
          <div className="decant-dashboard__stat-value">{stats.classifiedPct}%</div>
          <div className="decant-dashboard__stat-label">Classified</div>
          <div className="decant-dashboard__progress-bar">
            <div className="decant-dashboard__progress-fill" style={{ width: `${stats.classifiedPct}%` }} />
          </div>
        </div>
      </div>

      <div className="decant-dashboard__grid">
        {/* Segment Distribution */}
        <div className="decant-dashboard__card">
          <h3 className="decant-dashboard__card-title">Segment Distribution</h3>
          <div className="decant-dashboard__segments">
            {stats.segments.map(seg => {
              const pct = stats.total > 0 ? Math.round((seg.count / stats.total) * 100) : 0;
              const color = segmentColors[seg.code.charAt(0).toUpperCase()] || '#6b7280';
              return (
                <div
                  key={seg.code}
                  className="decant-dashboard__segment-row"
                  onClick={() => onNavigateSegment?.(seg.code)}
                >
                  <span className="decant-dashboard__segment-dot" style={{ backgroundColor: color }} />
                  <span className="decant-dashboard__segment-label">{seg.label}</span>
                  <span className="decant-dashboard__segment-count">{seg.count}</span>
                  <div className="decant-dashboard__segment-bar">
                    <div className="decant-dashboard__segment-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Categories */}
        <div className="decant-dashboard__card">
          <h3 className="decant-dashboard__card-title">Top Categories</h3>
          <div className="decant-dashboard__categories">
            {stats.topCategories.map((cat, i) => (
              <div
                key={i}
                className="decant-dashboard__category-row"
                onClick={() => onNavigateCategory?.(cat.segCode, cat.catCode)}
              >
                <span className="decant-dashboard__category-rank">#{i + 1}</span>
                <span className="decant-dashboard__category-label">{cat.label}</span>
                <span className="decant-dashboard__category-count">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content Types */}
        <div className="decant-dashboard__card">
          <h3 className="decant-dashboard__card-title">Content Types</h3>
          <div className="decant-dashboard__types">
            {stats.types.map(([type, count]) => (
              <div key={type} className="decant-dashboard__type-chip">
                <span className="decant-dashboard__type-name">{type}</span>
                <span className="decant-dashboard__type-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="decant-dashboard__card decant-dashboard__card--wide">
          <h3 className="decant-dashboard__card-title">Recent Activity</h3>
          <div className="decant-dashboard__recent">
            {stats.recentItems.map(item => (
              <div key={item.id} className="decant-dashboard__recent-item">
                <img src={item.logo} alt="" className="decant-dashboard__recent-favicon" />
                <div className="decant-dashboard__recent-info">
                  <span className="decant-dashboard__recent-title">{item.title}</span>
                  <span className="decant-dashboard__recent-meta">
                    {item.segment} &middot; {item.category} &middot; {item.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
