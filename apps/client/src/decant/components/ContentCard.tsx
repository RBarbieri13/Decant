/**
 * ContentCard - Visual card component for individual content items
 *
 * Displays thumbnail, title, metadata, tags, and quick actions.
 * Supports multiple view modes (grid, list, compact).
 */

import { h, Fragment } from 'preact';
import { useState, useCallback, useMemo } from 'preact/hooks';
import type { ContentItem, SpaceViewMode, ContentType } from '../types';
import { CONTENT_TYPE_CONFIGS } from '../types/content';

interface ContentCardProps {
    item: ContentItem;
    viewMode: SpaceViewMode;
    isSelected: boolean;
    isDragging: boolean;
    onClick: (e: MouseEvent) => void;
    onDragStart: (e: DragEvent) => void;
    onDragEnd: () => void;
    onDelete: () => void;
    onUpdate: (data: Partial<ContentItem>) => void;
}

export function ContentCard({
    item,
    viewMode,
    isSelected,
    isDragging,
    onClick,
    onDragStart,
    onDragEnd,
    onDelete,
    onUpdate,
}: ContentCardProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [imageError, setImageError] = useState(false);

    const typeConfig = CONTENT_TYPE_CONFIGS[item.type];

    // Format relative time
    const relativeTime = useMemo(() => {
        const date = new Date(item.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }, [item.createdAt]);

    // Get display tags (limit to 3)
    const displayTags = useMemo(() => {
        const tags = item.aiAnalysis?.tags || [];
        return tags.slice(0, 3);
    }, [item.aiAnalysis?.tags]);

    const handleOpen = useCallback((e: MouseEvent) => {
        e.stopPropagation();
        window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
    }, [item.sourceUrl]);

    const handleToggleFavorite = useCallback((e: MouseEvent) => {
        e.stopPropagation();
        onUpdate({ isPinned: !item.isPinned });
    }, [item.isPinned, onUpdate]);

    const handleDelete = useCallback((e: MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        onDelete();
    }, [onDelete]);

    const handleMenuToggle = useCallback((e: MouseEvent) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
    }, [showMenu]);

    // Thumbnail or fallback
    const thumbnailUrl = imageError ? null : item.metadata.thumbnail;
    const hasThumbnail = !!thumbnailUrl;

    // CSS classes
    const cardClasses = [
        'content-card',
        `type-${item.type}`,
        `view-${viewMode}`,
        isSelected && 'selected',
        isDragging && 'dragging',
        item.isPinned && 'pinned',
        !hasThumbnail && 'no-thumbnail',
    ].filter(Boolean).join(' ');

    return (
        <article
            className={cardClasses}
            onClick={onClick}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            {/* Selection Checkbox */}
            <div className="card-checkbox">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            {/* Thumbnail */}
            {viewMode !== 'list' && (
                <div className="card-thumbnail">
                    {hasThumbnail ? (
                        <img
                            src={thumbnailUrl}
                            alt=""
                            loading="lazy"
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <div
                            className="thumbnail-fallback"
                            style={{ backgroundColor: typeConfig.color + '20' }}
                        >
                            <i
                                className={`bx ${typeConfig.icon}`}
                                style={{ color: typeConfig.color }}
                            />
                        </div>
                    )}

                    {/* Type Badge */}
                    <span
                        className="type-badge"
                        style={{ backgroundColor: typeConfig.color }}
                    >
                        <i className={`bx ${typeConfig.icon}`} />
                        {viewMode === 'grid' && <span>{typeConfig.label}</span>}
                    </span>

                    {/* Duration (for video/podcast) */}
                    {item.metadata.duration && (
                        <span className="duration-badge">
                            {item.metadata.duration}
                        </span>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="card-content">
                {/* Favicon + Domain */}
                <div className="card-source">
                    {item.metadata.favicon && (
                        <img
                            src={item.metadata.favicon}
                            alt=""
                            className="favicon"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    )}
                    <span className="domain">{item.metadata.domain}</span>
                    {viewMode === 'list' && (
                        <span
                            className="type-badge-inline"
                            style={{ color: typeConfig.color }}
                        >
                            <i className={`bx ${typeConfig.icon}`} />
                            {typeConfig.label}
                        </span>
                    )}
                </div>

                {/* Title */}
                <h3 className="card-title">
                    {item.isPinned && <i className="bx bxs-star pin-icon" />}
                    {item.metadata.title || 'Untitled'}
                </h3>

                {/* Description / Summary */}
                {viewMode !== 'masonry' && (item.aiAnalysis?.summary || item.metadata.description) && (
                    <p className="card-description">
                        {item.aiAnalysis?.summary || item.metadata.description}
                    </p>
                )}

                {/* Tags */}
                {displayTags.length > 0 && (
                    <div className="card-tags">
                        {displayTags.map(tag => (
                            <span key={tag} className="tag">
                                {tag}
                            </span>
                        ))}
                        {(item.aiAnalysis?.tags?.length || 0) > 3 && (
                            <span className="tag-more">
                                +{(item.aiAnalysis?.tags?.length || 0) - 3}
                            </span>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="card-footer">
                    <span className="card-time" title={new Date(item.createdAt).toLocaleString()}>
                        {relativeTime}
                    </span>

                    <div className="card-actions">
                        <button
                            className={`action-btn ${item.isPinned ? 'active' : ''}`}
                            onClick={handleToggleFavorite}
                            title={item.isPinned ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <i className={`bx ${item.isPinned ? 'bxs-star' : 'bx-star'}`} />
                        </button>
                        <button
                            className="action-btn"
                            onClick={handleOpen}
                            title="Open in new tab"
                        >
                            <i className="bx bx-link-external" />
                        </button>
                        <button
                            className="action-btn"
                            onClick={handleMenuToggle}
                            title="More options"
                        >
                            <i className="bx bx-dots-vertical-rounded" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Dropdown Menu */}
            {showMenu && (
                <div className="card-menu" onClick={(e) => e.stopPropagation()}>
                    <button onClick={handleOpen}>
                        <i className="bx bx-link-external" /> Open
                    </button>
                    <button onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(item.sourceUrl);
                        setShowMenu(false);
                    }}>
                        <i className="bx bx-copy" /> Copy URL
                    </button>
                    <button onClick={handleToggleFavorite}>
                        <i className={`bx ${item.isPinned ? 'bx-star' : 'bxs-star'}`} />
                        {item.isPinned ? 'Unfavorite' : 'Favorite'}
                    </button>
                    <hr />
                    <button onClick={(e) => {
                        e.stopPropagation();
                        onUpdate({ isArchived: !item.isArchived });
                        setShowMenu(false);
                    }}>
                        <i className="bx bx-archive" />
                        {item.isArchived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button className="danger" onClick={handleDelete}>
                        <i className="bx bx-trash" /> Delete
                    </button>
                </div>
            )}
        </article>
    );
}

export default ContentCard;
