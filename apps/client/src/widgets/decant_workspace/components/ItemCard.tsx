/**
 * Item Card Component
 *
 * Displays an individual item (bookmark/note) in the Decant workspace.
 * Features Gumroad "Pop-Brutalist" styling.
 */

import type { DecantItem, ViewMode } from "../types/workspace.types.js";
import { ContentTypeBadge } from "./ContentTypeBadge.js";

interface ItemCardProps {
    item: DecantItem;
    viewMode: ViewMode;
    onClick?: () => void;
    onDragStart?: (e: DragEvent) => void;
}

export function ItemCard({ item, viewMode, onClick, onDragStart }: ItemCardProps) {
    const handleClick = () => {
        if (item.sourceUrl) {
            window.open(item.sourceUrl, '_blank');
        }
        onClick?.();
    };

    const handleDragStart = (e: DragEvent) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('application/decant-item', JSON.stringify({
                noteId: item.noteId,
                title: item.title
            }));
            e.dataTransfer.effectAllowed = 'move';
        }
        onDragStart?.(e);
    };

    const viewClass = viewMode === 'list' ? 'item-card--list' :
                      viewMode === 'compact' ? 'item-card--compact' : '';

    return (
        <div
            className={`item-card ${viewClass}`}
            onClick={handleClick}
            draggable
            onDragStart={handleDragStart}
            title={item.title}
        >
            <div className="item-card__header">
                {item.favicon ? (
                    <img
                        src={item.favicon}
                        alt=""
                        className="item-card__favicon"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : (
                    <span className="item-card__favicon-placeholder">
                        {item.title.charAt(0).toUpperCase()}
                    </span>
                )}
                <ContentTypeBadge type={item.contentType} />
            </div>

            <h4 className="item-card__title">{item.title}</h4>

            {viewMode === 'grid' && item.aiSummary && (
                <p className="item-card__summary">{item.aiSummary}</p>
            )}

            {viewMode === 'grid' && item.tags.length > 0 && (
                <div className="item-card__tags">
                    {item.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="item-card__tag">{tag}</span>
                    ))}
                    {item.tags.length > 3 && (
                        <span className="item-card__tag">+{item.tags.length - 3}</span>
                    )}
                </div>
            )}
        </div>
    );
}

export default ItemCard;
