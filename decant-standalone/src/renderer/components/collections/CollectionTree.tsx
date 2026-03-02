// ============================================================
// CollectionTree
// Renders the recursive collection folder tree
// ============================================================

import { CollectionTreeNode } from '../../services/api';
import { CollectionTreeItem } from './CollectionTreeItem';

interface CollectionTreeProps {
  collections: CollectionTreeNode[];
  expandedIds: Set<string>;
  renamingId: string | null;
  selectedId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function CollectionTree({
  collections,
  expandedIds,
  renamingId,
  selectedId,
  onToggleExpand,
  onSelect,
  onRename,
  onCancelRename,
  onContextMenu,
}: CollectionTreeProps) {
  if (collections.length === 0) {
    return (
      <div className="collection-tree-empty">
        <p className="collection-tree-empty__text">No collections yet</p>
        <p className="collection-tree-empty__hint">
          Create your first collection to organize items your way.
        </p>
      </div>
    );
  }

  return (
    <div className="collection-tree" role="tree">
      {collections.map(node => (
        <CollectionTreeItem
          key={node.id}
          node={node}
          level={0}
          expandedIds={expandedIds}
          renamingId={renamingId}
          selectedId={selectedId}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onRename={onRename}
          onCancelRename={onCancelRename}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
