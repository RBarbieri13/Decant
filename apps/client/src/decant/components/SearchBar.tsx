/**
 * SearchBar - Search and filter component with view mode toggle
 *
 * Provides search input, content type filters, tag filters,
 * and view mode switching (grid, list, board, masonry).
 */

import { h, Fragment } from 'preact';
import { useState, useCallback, useMemo } from 'preact/hooks';
import type { SpaceViewMode, ContentType } from '../types';
import { CONTENT_TYPE_CONFIGS } from '../types/content';

interface FilterState {
    searchQuery: string;
    contentTypes: string[];
    tags: string[];
    sortBy: 'recent' | 'alphabetical' | 'type' | 'domain';
    sortOrder: 'asc' | 'desc';
}

interface SearchBarProps {
    value: string;
    onChange: (query: string) => void;
    viewMode: SpaceViewMode;
    onViewModeChange: (mode: SpaceViewMode) => void;
    filter: FilterState;
    onFilterChange: (updates: Partial<FilterState>) => void;
}

const VIEW_MODES: Array<{ mode: SpaceViewMode; icon: string; label: string }> = [
    { mode: 'grid', icon: 'bx-grid-alt', label: 'Grid' },
    { mode: 'list', icon: 'bx-list-ul', label: 'List' },
    { mode: 'masonry', icon: 'bx-category', label: 'Masonry' },
    { mode: 'board', icon: 'bx-columns', label: 'Board' },
];

const SORT_OPTIONS = [
    { value: 'recent', label: 'Most Recent' },
    { value: 'alphabetical', label: 'Alphabetical' },
    { value: 'type', label: 'By Type' },
    { value: 'domain', label: 'By Domain' },
];

export function SearchBar({
    value,
    onChange,
    viewMode,
    onViewModeChange,
    filter,
    onFilterChange,
}: SearchBarProps) {
    const [showFilters, setShowFilters] = useState(false);

    const contentTypes = useMemo(() => Object.values(CONTENT_TYPE_CONFIGS), []);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filter.contentTypes.length > 0) count += filter.contentTypes.length;
        if (filter.tags.length > 0) count += filter.tags.length;
        if (filter.sortBy !== 'recent') count += 1;
        return count;
    }, [filter]);

    const handleContentTypeToggle = useCallback((type: ContentType) => {
        const newTypes = filter.contentTypes.includes(type)
            ? filter.contentTypes.filter(t => t !== type)
            : [...filter.contentTypes, type];
        onFilterChange({ contentTypes: newTypes });
    }, [filter.contentTypes, onFilterChange]);

    const handleSortChange = useCallback((sortBy: string) => {
        onFilterChange({ sortBy: sortBy as FilterState['sortBy'] });
    }, [onFilterChange]);

    const handleSortOrderToggle = useCallback(() => {
        onFilterChange({ sortOrder: filter.sortOrder === 'asc' ? 'desc' : 'asc' });
    }, [filter.sortOrder, onFilterChange]);

    const handleClearFilters = useCallback(() => {
        onFilterChange({
            contentTypes: [],
            tags: [],
            sortBy: 'recent',
            sortOrder: 'desc',
        });
    }, [onFilterChange]);

    return (
        <div className="search-bar">
            {/* Search Input */}
            <div className="search-input-wrapper">
                <i className="bx bx-search search-icon" />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search items..."
                    value={value}
                    onInput={(e) => onChange((e.target as HTMLInputElement).value)}
                />
                {value && (
                    <button
                        className="search-clear"
                        onClick={() => onChange('')}
                    >
                        <i className="bx bx-x" />
                    </button>
                )}
            </div>

            {/* Filter Button */}
            <button
                className={`filter-btn ${showFilters ? 'active' : ''} ${activeFilterCount > 0 ? 'has-filters' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
            >
                <i className="bx bx-filter-alt" />
                {activeFilterCount > 0 && (
                    <span className="filter-badge">{activeFilterCount}</span>
                )}
            </button>

            {/* View Mode Toggle */}
            <div className="view-mode-toggle">
                {VIEW_MODES.map(({ mode, icon, label }) => (
                    <button
                        key={mode}
                        className={`view-mode-btn ${viewMode === mode ? 'active' : ''}`}
                        onClick={() => onViewModeChange(mode)}
                        title={label}
                    >
                        <i className={`bx ${icon}`} />
                    </button>
                ))}
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="filter-panel">
                    {/* Content Type Filters */}
                    <div className="filter-section">
                        <h4 className="filter-section-title">Content Type</h4>
                        <div className="filter-chips">
                            {contentTypes.map(config => (
                                <button
                                    key={config.type}
                                    className={`filter-chip ${
                                        filter.contentTypes.includes(config.type) ? 'active' : ''
                                    }`}
                                    onClick={() => handleContentTypeToggle(config.type)}
                                    style={{
                                        '--chip-color': config.color,
                                    } as any}
                                >
                                    <i className={`bx ${config.icon}`} />
                                    <span>{config.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sort Options */}
                    <div className="filter-section">
                        <h4 className="filter-section-title">Sort By</h4>
                        <div className="sort-options">
                            <select
                                className="sort-select"
                                value={filter.sortBy}
                                onChange={(e) => handleSortChange((e.target as HTMLSelectElement).value)}
                            >
                                {SORT_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                className="sort-order-btn"
                                onClick={handleSortOrderToggle}
                                title={filter.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                            >
                                <i className={`bx bx-sort-${filter.sortOrder === 'asc' ? 'up' : 'down'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Filter Actions */}
                    <div className="filter-actions">
                        {activeFilterCount > 0 && (
                            <button
                                className="clear-filters-btn"
                                onClick={handleClearFilters}
                            >
                                Clear all filters
                            </button>
                        )}
                        <button
                            className="close-filters-btn"
                            onClick={() => setShowFilters(false)}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SearchBar;
