import { useState, useCallback } from "preact/hooks";
import TypeIcon, { type ContentType } from "../atoms/TypeIcon";
import "./TreeNode.css";

export interface TreeNodeData {
    id: string;
    name: string;
    type: ContentType;
    children?: TreeNodeData[];
}

interface TreeNodeProps {
    node: TreeNodeData;
    depth: number;
    isLast: boolean;
    ancestorLines: boolean[];
    selectedId: string | null;
    expandedIds: Set<string>;
    onSelect: (id: string) => void;
    onToggleExpand: (id: string) => void;
}

export default function TreeNode({
    node,
    depth,
    isLast,
    ancestorLines,
    selectedId,
    expandedIds,
    onSelect,
    onToggleExpand,
}: TreeNodeProps) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;

    const handleClick = useCallback(() => {
        onSelect(node.id);
    }, [node.id, onSelect]);

    const handleToggle = useCallback(
        (e: Event) => {
            e.stopPropagation();
            onToggleExpand(node.id);
        },
        [node.id, onToggleExpand]
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(node.id);
            } else if (e.key === "ArrowRight" && hasChildren && !isExpanded) {
                e.preventDefault();
                onToggleExpand(node.id);
            } else if (e.key === "ArrowLeft" && hasChildren && isExpanded) {
                e.preventDefault();
                onToggleExpand(node.id);
            }
        },
        [node.id, hasChildren, isExpanded, onSelect, onToggleExpand]
    );

    // Calculate child ancestor lines - add current level's line status
    const childAncestorLines = [...ancestorLines, !isLast];

    return (
        <div className="decant-tree-node" role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
            {/* Node row */}
            <div
                className={`decant-tree-node__row ${isSelected ? "decant-tree-node__row--selected" : ""}`}
                style={{ paddingLeft: `${depth * 16}px` }}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                tabIndex={0}
            >
                {/* Hierarchy connector lines */}
                {depth > 0 && (
                    <span className="decant-tree-node__lines" aria-hidden="true">
                        {ancestorLines.map((showLine, index) => (
                            <span
                                key={index}
                                className={`decant-tree-node__line-segment ${
                                    showLine ? "decant-tree-node__line-segment--vertical" : ""
                                }`}
                            />
                        ))}
                        <span
                            className={`decant-tree-node__line-segment decant-tree-node__line-segment--connector ${
                                isLast ? "decant-tree-node__line-segment--last" : ""
                            }`}
                        />
                    </span>
                )}

                {/* Expand/collapse toggle */}
                <button
                    type="button"
                    className={`decant-tree-node__toggle ${hasChildren ? "" : "decant-tree-node__toggle--hidden"}`}
                    onClick={handleToggle}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    tabIndex={-1}
                >
                    <i className={`bx ${isExpanded ? "bx-chevron-down" : "bx-chevron-right"}`} />
                </button>

                {/* Icon */}
                <TypeIcon type={node.type} size="md" />

                {/* Label */}
                <span className="decant-tree-node__label">{node.name}</span>
            </div>

            {/* Children (if expanded) */}
            {hasChildren && isExpanded && (
                <div className="decant-tree-node__children" role="group">
                    {node.children!.map((child, index) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            isLast={index === node.children!.length - 1}
                            ancestorLines={childAncestorLines}
                            selectedId={selectedId}
                            expandedIds={expandedIds}
                            onSelect={onSelect}
                            onToggleExpand={onToggleExpand}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
