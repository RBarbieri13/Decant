/**
 * SpacesSidebar - Left sidebar navigation for Spaces (collections)
 *
 * Displays system spaces (All, Recent, Favorites) and user-created spaces
 * with support for drag-and-drop reordering and space management.
 */

import { h, Fragment } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import type { Space, SpaceCreateRequest, SpaceUpdateRequest, SpaceTheme } from '../types';
import { SYSTEM_SPACES, DEFAULT_SPACE_COLORS, DEFAULT_SPACE_ICONS } from '../types/space';

interface SpacesSidebarProps {
    spaces: Space[];
    activeSpaceId: string;
    collapsed: boolean;
    onSpaceSelect: (spaceId: string) => void;
    onSpaceCreate: (data: SpaceCreateRequest) => Promise<Space>;
    onSpaceUpdate: (spaceId: string, data: SpaceUpdateRequest) => Promise<void>;
    onSpaceDelete: (spaceId: string) => Promise<void>;
    onToggleCollapse: () => void;
}

interface SpaceItemProps {
    space: Space;
    isActive: boolean;
    isCollapsed: boolean;
    onSelect: () => void;
    onUpdate?: (data: SpaceUpdateRequest) => void;
    onDelete?: () => void;
}

function SpaceItem({
    space,
    isActive,
    isCollapsed,
    onSelect,
    onUpdate,
    onDelete
}: SpaceItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(space.name);
    const [showMenu, setShowMenu] = useState(false);

    const handleSaveName = useCallback(() => {
        if (editName.trim() && editName !== space.name && onUpdate) {
            onUpdate({ name: editName.trim() });
        }
        setIsEditing(false);
    }, [editName, space.name, onUpdate]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveName();
        } else if (e.key === 'Escape') {
            setEditName(space.name);
            setIsEditing(false);
        }
    }, [handleSaveName, space.name]);

    return (
        <div
            className={`space-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}
            onClick={onSelect}
            draggable={!isEditing && !!onUpdate}
            title={isCollapsed ? space.name : undefined}
        >
            <span
                className="space-icon"
                style={{
                    backgroundColor: space.theme?.color || '#6B7280',
                    color: 'white'
                }}
            >
                <i className={`bx ${space.theme?.icon || 'bx-folder'}`} />
            </span>

            {!isCollapsed && (
                <>
                    {isEditing ? (
                        <input
                            type="text"
                            className="space-name-input"
                            value={editName}
                            onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                            onBlur={handleSaveName}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="space-name">{space.name}</span>
                    )}

                    <span className="space-count">{space.itemCount}</span>

                    {onUpdate && (
                        <div className="space-actions">
                            <button
                                className="space-menu-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(!showMenu);
                                }}
                            >
                                <i className="bx bx-dots-horizontal-rounded" />
                            </button>

                            {showMenu && (
                                <div
                                    className="space-menu"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button onClick={() => {
                                        setIsEditing(true);
                                        setShowMenu(false);
                                    }}>
                                        <i className="bx bx-edit" /> Rename
                                    </button>
                                    <button onClick={() => {
                                        // Open color/icon picker
                                        setShowMenu(false);
                                    }}>
                                        <i className="bx bx-palette" /> Customize
                                    </button>
                                    <hr />
                                    <button
                                        className="danger"
                                        onClick={() => {
                                            if (onDelete) onDelete();
                                            setShowMenu(false);
                                        }}
                                    >
                                        <i className="bx bx-trash" /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export function SpacesSidebar({
    spaces,
    activeSpaceId,
    collapsed,
    onSpaceSelect,
    onSpaceCreate,
    onSpaceUpdate,
    onSpaceDelete,
    onToggleCollapse,
}: SpacesSidebarProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [newSpaceName, setNewSpaceName] = useState('');

    const systemSpaces = [
        { id: SYSTEM_SPACES.ALL_ITEMS, name: 'All Items', icon: 'bx-grid-alt', color: '#6B7280' },
        { id: SYSTEM_SPACES.RECENT, name: 'Recent', icon: 'bx-time', color: '#3B82F6' },
        { id: SYSTEM_SPACES.FAVORITES, name: 'Favorites', icon: 'bx-star', color: '#F59E0B' },
        { id: SYSTEM_SPACES.INBOX, name: 'Inbox', icon: 'bx-inbox', color: '#8B5CF6' },
    ];

    const handleCreateSpace = useCallback(async () => {
        if (!newSpaceName.trim()) return;

        const randomColor = DEFAULT_SPACE_COLORS[Math.floor(Math.random() * DEFAULT_SPACE_COLORS.length)];
        const randomIcon = DEFAULT_SPACE_ICONS[Math.floor(Math.random() * DEFAULT_SPACE_ICONS.length)];

        await onSpaceCreate({
            name: newSpaceName.trim(),
            theme: { color: randomColor, icon: randomIcon },
        });

        setNewSpaceName('');
        setIsCreating(false);
    }, [newSpaceName, onSpaceCreate]);

    const handleCreateKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCreateSpace();
        } else if (e.key === 'Escape') {
            setNewSpaceName('');
            setIsCreating(false);
        }
    }, [handleCreateSpace]);

    // Sort user spaces by position
    const sortedSpaces = [...spaces].sort((a, b) => a.position - b.position);
    const activeSpaces = sortedSpaces.filter(s => !s.isArchived);
    const archivedSpaces = sortedSpaces.filter(s => s.isArchived);

    return (
        <aside className={`decant-sidebar ${collapsed ? 'collapsed' : ''}`}>
            {/* Logo / Collapse Toggle */}
            <div className="sidebar-header">
                {!collapsed && (
                    <div className="sidebar-logo">
                        <i className="bx bx-collection" />
                        <span>Decant</span>
                    </div>
                )}
                <button
                    className="collapse-btn"
                    onClick={onToggleCollapse}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <i className={`bx ${collapsed ? 'bx-chevron-right' : 'bx-chevron-left'}`} />
                </button>
            </div>

            {/* System Spaces */}
            <nav className="sidebar-section">
                {!collapsed && <h3 className="section-title">Quick Access</h3>}
                <div className="space-list">
                    {systemSpaces.map(sys => (
                        <SpaceItem
                            key={sys.id}
                            space={{
                                id: sys.id,
                                noteId: '',
                                name: sys.name,
                                theme: { icon: sys.icon, color: sys.color },
                                viewMode: 'grid',
                                position: 0,
                                itemCount: 0,
                                createdAt: '',
                                updatedAt: '',
                                isDefault: false,
                                isArchived: false,
                            }}
                            isActive={activeSpaceId === sys.id}
                            isCollapsed={collapsed}
                            onSelect={() => onSpaceSelect(sys.id)}
                        />
                    ))}
                </div>
            </nav>

            {/* User Spaces */}
            <nav className="sidebar-section spaces-section">
                {!collapsed && (
                    <div className="section-header">
                        <h3 className="section-title">Spaces</h3>
                        <button
                            className="add-space-btn"
                            onClick={() => setIsCreating(true)}
                            title="Create new space"
                        >
                            <i className="bx bx-plus" />
                        </button>
                    </div>
                )}

                <div className="space-list">
                    {/* New Space Input */}
                    {isCreating && !collapsed && (
                        <div className="space-item creating">
                            <span className="space-icon" style={{ backgroundColor: '#3B82F6' }}>
                                <i className="bx bx-folder" />
                            </span>
                            <input
                                type="text"
                                className="space-name-input"
                                placeholder="Space name..."
                                value={newSpaceName}
                                onInput={(e) => setNewSpaceName((e.target as HTMLInputElement).value)}
                                onBlur={() => {
                                    if (!newSpaceName.trim()) setIsCreating(false);
                                }}
                                onKeyDown={handleCreateKeyDown}
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Active Spaces */}
                    {activeSpaces.map(space => (
                        <SpaceItem
                            key={space.id}
                            space={space}
                            isActive={activeSpaceId === space.id}
                            isCollapsed={collapsed}
                            onSelect={() => onSpaceSelect(space.id)}
                            onUpdate={(data) => onSpaceUpdate(space.id, data)}
                            onDelete={() => onSpaceDelete(space.id)}
                        />
                    ))}

                    {/* Add Space Button (collapsed mode) */}
                    {collapsed && (
                        <button
                            className="space-item add-btn"
                            onClick={() => {
                                onToggleCollapse();
                                setTimeout(() => setIsCreating(true), 100);
                            }}
                            title="Create new space"
                        >
                            <span className="space-icon" style={{ backgroundColor: '#E5E7EB' }}>
                                <i className="bx bx-plus" style={{ color: '#6B7280' }} />
                            </span>
                        </button>
                    )}
                </div>
            </nav>

            {/* Archived Spaces */}
            {archivedSpaces.length > 0 && !collapsed && (
                <nav className="sidebar-section archived-section">
                    <h3 className="section-title">
                        <i className="bx bx-archive" /> Archived
                    </h3>
                    <div className="space-list">
                        {archivedSpaces.map(space => (
                            <SpaceItem
                                key={space.id}
                                space={space}
                                isActive={activeSpaceId === space.id}
                                isCollapsed={collapsed}
                                onSelect={() => onSpaceSelect(space.id)}
                                onUpdate={(data) => onSpaceUpdate(space.id, data)}
                                onDelete={() => onSpaceDelete(space.id)}
                            />
                        ))}
                    </div>
                </nav>
            )}

            {/* Archive Link */}
            {!collapsed && (
                <div className="sidebar-footer">
                    <SpaceItem
                        space={{
                            id: SYSTEM_SPACES.ARCHIVE,
                            noteId: '',
                            name: 'Archive',
                            theme: { icon: 'bx-archive', color: '#9CA3AF' },
                            viewMode: 'grid',
                            position: 0,
                            itemCount: 0,
                            createdAt: '',
                            updatedAt: '',
                            isDefault: false,
                            isArchived: false,
                        }}
                        isActive={activeSpaceId === SYSTEM_SPACES.ARCHIVE}
                        isCollapsed={collapsed}
                        onSelect={() => onSpaceSelect(SYSTEM_SPACES.ARCHIVE)}
                    />
                </div>
            )}
        </aside>
    );
}

export default SpacesSidebar;
