import { useState, useMemo, useCallback } from "preact/hooks";
import SearchInput from "../atoms/SearchInput";
import TreeNode, { type TreeNodeData } from "../composites/TreeNode";
import "./HierarchyTree.css";

interface HierarchyTreeProps {
    data: TreeNodeData[];
    selectedId?: string | null;
    defaultExpandedIds?: string[];
    onSelect?: (id: string, node: TreeNodeData) => void;
    className?: string;
}

// Helper to find a node by ID
function findNodeById(nodes: TreeNodeData[], id: string): TreeNodeData | null {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
        }
    }
    return null;
}

// Helper to filter tree based on search query
function filterTree(nodes: TreeNodeData[], query: string): TreeNodeData[] {
    if (!query.trim()) return nodes;

    const lowerQuery = query.toLowerCase();

    function nodeMatches(node: TreeNodeData): boolean {
        return node.name.toLowerCase().includes(lowerQuery);
    }

    function filterNode(node: TreeNodeData): TreeNodeData | null {
        const selfMatches = nodeMatches(node);
        const filteredChildren = node.children ? node.children.map(filterNode).filter(Boolean) as TreeNodeData[] : [];

        if (selfMatches || filteredChildren.length > 0) {
            return {
                ...node,
                children: filteredChildren.length > 0 ? filteredChildren : node.children,
            };
        }

        return null;
    }

    return nodes.map(filterNode).filter(Boolean) as TreeNodeData[];
}

// Helper to get all node IDs for expansion
function getAllNodeIds(nodes: TreeNodeData[]): string[] {
    const ids: string[] = [];
    function collect(nodeList: TreeNodeData[]) {
        for (const node of nodeList) {
            ids.push(node.id);
            if (node.children) collect(node.children);
        }
    }
    collect(nodes);
    return ids;
}

export default function HierarchyTree({
    data,
    selectedId = null,
    defaultExpandedIds = [],
    onSelect,
    className = "",
}: HierarchyTreeProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(defaultExpandedIds));
    const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedId);

    // Use controlled or uncontrolled selection
    const currentSelectedId = selectedId !== undefined ? selectedId : internalSelectedId;

    // Filter tree based on search
    const filteredData = useMemo(() => filterTree(data, searchQuery), [data, searchQuery]);

    // When searching, expand all matching nodes
    const effectiveExpandedIds = useMemo(() => {
        if (searchQuery.trim()) {
            return new Set(getAllNodeIds(filteredData));
        }
        return expandedIds;
    }, [searchQuery, filteredData, expandedIds]);

    const handleSelect = useCallback(
        (id: string) => {
            setInternalSelectedId(id);
            if (onSelect) {
                const node = findNodeById(data, id);
                if (node) onSelect(id, node);
            }
        },
        [data, onSelect]
    );

    const handleToggleExpand = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    return (
        <div className={`decant-hierarchy-tree ${className}`}>
            {/* Search input */}
            <div className="decant-hierarchy-tree__search">
                <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search your tree..." />
            </div>

            {/* Tree content */}
            <div className="decant-hierarchy-tree__content" role="tree">
                {filteredData.length === 0 ? (
                    <div className="decant-hierarchy-tree__empty">
                        {searchQuery ? "No matching items found" : "No items"}
                    </div>
                ) : (
                    filteredData.map((node, index) => (
                        <TreeNode
                            key={node.id}
                            node={node}
                            depth={0}
                            isLast={index === filteredData.length - 1}
                            ancestorLines={[]}
                            selectedId={currentSelectedId}
                            expandedIds={effectiveExpandedIds}
                            onSelect={handleSelect}
                            onToggleExpand={handleToggleExpand}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export type { TreeNodeData };
