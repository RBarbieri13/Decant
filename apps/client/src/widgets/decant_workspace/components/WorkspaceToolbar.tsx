/**
 * Workspace Toolbar Component
 *
 * Search, view mode toggle, and action buttons.
 */

import { useWorkspaceState, useWorkspaceActions } from "../context/WorkspaceContext.js";
import type { ViewMode } from "../types/workspace.types.js";

interface WorkspaceToolbarProps {
    onAddUrl?: () => void;
    onRefresh?: () => void;
}

const VIEW_MODES: { mode: ViewMode; icon: string; title: string }[] = [
    { mode: 'grid', icon: '⊞', title: 'Grid view' },
    { mode: 'list', icon: '☰', title: 'List view' },
    { mode: 'compact', icon: '⊟', title: 'Compact view' }
];

export function WorkspaceToolbar({ onAddUrl, onRefresh }: WorkspaceToolbarProps) {
    const state = useWorkspaceState();
    const { setSearchQuery, setViewMode, refresh } = useWorkspaceActions();

    const handleSearchChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        setSearchQuery(target.value);
    };

    const handleRefresh = () => {
        refresh();
        onRefresh?.();
    };

    return (
        <div className="workspace-toolbar">
            <div className="workspace-toolbar__search">
                <input
                    type="text"
                    className="gum-input workspace-toolbar__search-input"
                    placeholder="Search items..."
                    value={state.searchQuery}
                    onInput={handleSearchChange}
                />
            </div>

            <div className="workspace-toolbar__actions">
                {onAddUrl && (
                    <button
                        className="gum-button gum-button--primary"
                        onClick={onAddUrl}
                        title="Add URL"
                    >
                        + Add URL
                    </button>
                )}

                <button
                    className="gum-button"
                    onClick={handleRefresh}
                    title="Refresh"
                    disabled={state.isLoading}
                >
                    🔄
                </button>

                <div className="workspace-toolbar__view-toggle">
                    {VIEW_MODES.map(({ mode, icon, title }) => (
                        <button
                            key={mode}
                            className={`workspace-toolbar__view-btn ${
                                state.viewMode === mode ? 'workspace-toolbar__view-btn--active' : ''
                            }`}
                            onClick={() => setViewMode(mode)}
                            title={title}
                        >
                            {icon}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default WorkspaceToolbar;
