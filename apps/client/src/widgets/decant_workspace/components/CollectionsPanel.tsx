/**
 * Collections Panel Component
 *
 * Main content area showing collections and items for the selected Space.
 */

import { useWorkspace } from "../context/WorkspaceContext.js";
import { CollectionCard } from "./CollectionCard.js";

interface CollectionsPanelProps {
    onAddCollection?: () => void;
}

export function CollectionsPanel({ onAddCollection }: CollectionsPanelProps) {
    const { state, selectedSpace } = useWorkspace();

    if (state.isLoading) {
        return (
            <div className="collections-panel collections-panel--empty">
                <div className="workspace-loading">
                    <div className="workspace-loading__spinner" />
                </div>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="collections-panel collections-panel--empty">
                <div className="workspace-error">
                    <div className="workspace-error__icon">⚠️</div>
                    <p className="workspace-error__message">{state.error}</p>
                    <button className="gum-button" onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!selectedSpace) {
        return (
            <div className="collections-panel collections-panel--empty">
                <div className="collections-panel__empty-state">
                    <div className="collections-panel__empty-icon">📚</div>
                    <h3 className="collections-panel__empty-title">
                        {state.spaces.length === 0
                            ? 'Welcome to Decant'
                            : 'Select a Space'
                        }
                    </h3>
                    <p className="collections-panel__empty-text">
                        {state.spaces.length === 0
                            ? 'Create your first Space to start organizing your knowledge.'
                            : 'Choose a Space from the sidebar to view its collections.'
                        }
                    </p>
                </div>
            </div>
        );
    }

    if (selectedSpace.collections.length === 0) {
        return (
            <div className="collections-panel collections-panel--empty">
                <div className="collections-panel__empty-state">
                    <div className="collections-panel__empty-icon">📁</div>
                    <h3 className="collections-panel__empty-title">
                        No Collections Yet
                    </h3>
                    <p className="collections-panel__empty-text">
                        Create collections to organize items in "{selectedSpace.title}".
                    </p>
                    {onAddCollection && (
                        <button
                            className="gum-button gum-button--primary"
                            onClick={onAddCollection}
                        >
                            Create Collection
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Filter collections based on search query
    const filteredCollections = selectedSpace.collections.filter(collection => {
        if (!state.searchQuery) return true;

        // Check if collection title matches
        if (collection.title.toLowerCase().includes(state.searchQuery.toLowerCase())) {
            return true;
        }

        // Check if any items match
        return collection.items.some(item =>
            item.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            item.tags.some(tag => tag.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
            item.aiSummary?.toLowerCase().includes(state.searchQuery.toLowerCase())
        );
    });

    if (state.searchQuery && filteredCollections.length === 0) {
        return (
            <div className="collections-panel collections-panel--empty">
                <div className="collections-panel__empty-state">
                    <div className="collections-panel__empty-icon">🔍</div>
                    <h3 className="collections-panel__empty-title">
                        No Results Found
                    </h3>
                    <p className="collections-panel__empty-text">
                        No items match "{state.searchQuery}" in "{selectedSpace.title}".
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="collections-panel">
            {filteredCollections.map((collection) => (
                <CollectionCard
                    key={collection.noteId}
                    collection={collection}
                    viewMode={state.viewMode}
                    searchQuery={state.searchQuery}
                />
            ))}
        </div>
    );
}

export default CollectionsPanel;
