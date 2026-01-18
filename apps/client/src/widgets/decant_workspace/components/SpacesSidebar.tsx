/**
 * Spaces Sidebar Component
 *
 * Left panel showing all Spaces for navigation.
 */

import { useWorkspace, useWorkspaceActions } from "../context/WorkspaceContext.js";
import { SpaceItem } from "./SpaceItem.js";

interface SpacesSidebarProps {
    onAddSpace?: () => void;
}

export function SpacesSidebar({ onAddSpace }: SpacesSidebarProps) {
    const { state, selectedSpace } = useWorkspace();
    const { selectSpace } = useWorkspaceActions();

    return (
        <aside className="spaces-sidebar">
            <header className="spaces-sidebar__header">
                <h2 className="spaces-sidebar__title">Spaces</h2>
                {onAddSpace && (
                    <button
                        className="gum-button gum-button--primary"
                        onClick={onAddSpace}
                        title="Add new Space"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                        +
                    </button>
                )}
            </header>

            <div className="spaces-sidebar__list">
                {state.spaces.length === 0 && !state.isLoading && (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--gum-gray)' }}>
                        <p style={{ marginBottom: '12px' }}>No Spaces yet</p>
                        {onAddSpace && (
                            <button
                                className="gum-button gum-button--secondary"
                                onClick={onAddSpace}
                            >
                                Create your first Space
                            </button>
                        )}
                    </div>
                )}

                {state.spaces.map((space) => (
                    <SpaceItem
                        key={space.noteId}
                        space={space}
                        isSelected={selectedSpace?.noteId === space.noteId}
                        onClick={() => selectSpace(space.noteId)}
                    />
                ))}
            </div>

            <footer className="spaces-sidebar__footer">
                <div style={{ fontSize: '12px', color: 'var(--gum-gray)' }}>
                    {state.spaces.length} Space{state.spaces.length !== 1 ? 's' : ''}
                </div>
            </footer>
        </aside>
    );
}

export default SpacesSidebar;
