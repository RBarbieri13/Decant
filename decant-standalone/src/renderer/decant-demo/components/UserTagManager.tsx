import React, { useState, useCallback } from 'react';
import type { UserTag } from '../../services/api';

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#6b7280',
  '#0ea5e9', '#d946ef', '#f43f5e', '#84cc16', '#2d5b47',
];

interface UserTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  tags: UserTag[];
  onCreate: (name: string, color: string) => Promise<void>;
  onUpdate: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const UserTagManager: React.FC<UserTagManagerProps> = ({
  isOpen,
  onClose,
  tags,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    setIsCreating(true);
    setError(null);
    try {
      await onCreate(name, newTagColor);
      setNewTagName('');
      setNewTagColor('#3b82f6');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setIsCreating(false);
    }
  }, [newTagName, newTagColor, onCreate]);

  const handleStartEdit = useCallback((tag: UserTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    try {
      await onUpdate(editingId, { name, color: editColor });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    }
  }, [editingId, editName, editColor, onUpdate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this tag? It will be removed from all items.')) return;
    try {
      await onDelete(id);
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    }
  }, [editingId, onDelete]);

  if (!isOpen) return null;

  return (
    <div className="decant-modal-backdrop" onClick={onClose}>
      <div className="decant-tag-manager" onClick={(e) => e.stopPropagation()}>
        <div className="decant-tag-manager__header">
          <h3>Manage User Tags</h3>
          <span className="decant-tag-manager__count">{tags.length} / 20</span>
          <button className="decant-tag-manager__close" onClick={onClose}>
            <i className="bx bx-x" />
          </button>
        </div>

        {error && (
          <div className="decant-tag-manager__error">
            <i className="bx bx-error-circle" /> {error}
            <button onClick={() => setError(null)}><i className="bx bx-x" /></button>
          </div>
        )}

        {/* Create new tag */}
        {tags.length < 20 && (
          <div className="decant-tag-manager__create">
            <input
              type="text"
              className="decant-tag-manager__input"
              placeholder="New tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              maxLength={50}
            />
            <div className="decant-tag-manager__colors">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  className={`decant-tag-manager__color-btn ${newTagColor === c ? 'decant-tag-manager__color-btn--active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewTagColor(c)}
                />
              ))}
            </div>
            <button
              className="decant-tag-manager__create-btn"
              onClick={handleCreate}
              disabled={!newTagName.trim() || isCreating}
            >
              <i className="bx bx-plus" /> Add Tag
            </button>
          </div>
        )}

        {/* Tag list */}
        <div className="decant-tag-manager__list">
          {tags.length === 0 ? (
            <div className="decant-tag-manager__empty">
              No user tags yet. Create your first tag above.
            </div>
          ) : (
            tags.map((tag) => (
              <div key={tag.id} className="decant-tag-manager__item">
                {editingId === tag.id ? (
                  <div className="decant-tag-manager__edit-row">
                    <input
                      type="text"
                      className="decant-tag-manager__input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      maxLength={50}
                      autoFocus
                    />
                    <div className="decant-tag-manager__colors">
                      {TAG_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`decant-tag-manager__color-btn ${editColor === c ? 'decant-tag-manager__color-btn--active' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setEditColor(c)}
                        />
                      ))}
                    </div>
                    <div className="decant-tag-manager__edit-actions">
                      <button className="decant-tag-manager__save-btn" onClick={handleSaveEdit}>Save</button>
                      <button className="decant-tag-manager__cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="decant-tag-manager__display-row">
                    <span
                      className="decant-user-tag decant-user-tag--preview"
                      style={{ backgroundColor: tag.color + '22', color: tag.color, borderColor: tag.color + '44' }}
                    >
                      {tag.name}
                    </span>
                    <div className="decant-tag-manager__actions">
                      <button
                        className="decant-tag-manager__action-btn"
                        onClick={() => handleStartEdit(tag)}
                        title="Edit"
                      >
                        <i className="bx bx-edit" />
                      </button>
                      <button
                        className="decant-tag-manager__action-btn decant-tag-manager__action-btn--danger"
                        onClick={() => handleDelete(tag.id)}
                        title="Delete"
                      >
                        <i className="bx bx-trash" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
