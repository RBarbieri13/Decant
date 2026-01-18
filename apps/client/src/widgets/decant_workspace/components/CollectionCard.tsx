/**
 * Collection Card Component
 *
 * Displays a collection with its items in a grid/list layout.
 */

import type { DecantCollection, ViewMode } from "../types/workspace.types.js";
import { ItemCard } from "./ItemCard.js";

interface CollectionCardProps {
    collection: DecantCollection;
    viewMode: ViewMode;
    searchQuery?: string;
}

export function CollectionCard({ collection, viewMode, searchQuery = '' }: CollectionCardProps) {
    // Filter items based on search query
    const filteredItems = searchQuery
        ? collection.items.filter(item =>
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
            item.aiSummary?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : collection.items;

    // Don't render if no items match the search
    if (searchQuery && filteredItems.length === 0) {
        return null;
    }

    const itemsClassName = viewMode === 'list' ? 'collection-card__items--list' :
                           viewMode === 'compact' ? 'collection-card__items--compact' : '';

    return (
        <div className="collection-card">
            <header className="collection-card__header">
                <h3 className="collection-card__title">{collection.title}</h3>
                <span className="collection-card__count">
                    {filteredItems.length}
                    {searchQuery && filteredItems.length !== collection.items.length
                        ? ` / ${collection.items.length}`
                        : ''
                    } item{filteredItems.length !== 1 ? 's' : ''}
                </span>
            </header>

            <div className={`collection-card__items ${itemsClassName}`}>
                {filteredItems.length === 0 ? (
                    <div style={{
                        gridColumn: '1 / -1',
                        padding: '24px',
                        textAlign: 'center',
                        color: 'var(--gum-gray)'
                    }}>
                        No items in this collection
                    </div>
                ) : (
                    filteredItems.map((item) => (
                        <ItemCard
                            key={item.noteId}
                            item={item}
                            viewMode={viewMode}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default CollectionCard;
