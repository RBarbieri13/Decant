import React from 'react';
import type { ViewMode, PanelTab } from '../types';

interface TitleBarProps {
  title: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  viewMode,
  onViewModeChange,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="decant-titlebar">
      <h1 className="decant-titlebar__title">{title}</h1>

      <div className="decant-titlebar__spacer" />

      <div className="decant-view-toggle">
        {(['table', 'grid', 'tree', 'list', 'dashboard'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            className={`decant-view-toggle__option ${viewMode === mode ? 'decant-view-toggle__option--active' : ''}`}
            onClick={() => onViewModeChange(mode)}
            title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
          >
            <i
              className={`bx ${
                mode === 'table'
                  ? 'bx-table'
                  : mode === 'grid'
                  ? 'bx-grid-alt'
                  : mode === 'tree'
                  ? 'bx-sitemap'
                  : mode === 'dashboard'
                  ? 'bx-bar-chart-alt-2'
                  : 'bx-list-ul'
              }`}
            />
          </button>
        ))}
      </div>

      <div className="decant-titlebar__tabs">
        <button
          className={`decant-titlebar__tab ${activeTab === 'properties' ? 'decant-titlebar__tab--active' : ''}`}
          onClick={() => onTabChange('properties')}
        >
          PROPERTIES
        </button>
        <button
          className={`decant-titlebar__tab ${activeTab === 'related' ? 'decant-titlebar__tab--active' : ''}`}
          onClick={() => onTabChange('related')}
        >
          RELATED ITEMS
        </button>
        <button
          className={`decant-titlebar__tab ${activeTab === 'backlinks' ? 'decant-titlebar__tab--active' : ''}`}
          onClick={() => onTabChange('backlinks')}
        >
          BACKLINKS
        </button>
      </div>
    </div>
  );
};
