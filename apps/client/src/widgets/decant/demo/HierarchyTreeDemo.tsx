/**
 * HierarchyTree Demo Component
 *
 * This file provides sample data and a demo wrapper to preview the HierarchyTree component.
 * Import this component to see the tree in action with realistic data.
 */

import HierarchyTree, { type TreeNodeData } from "../containers/HierarchyTree";
import "../decant-variables.css";

// Sample data matching the mockup design
export const SAMPLE_TREE_DATA: TreeNodeData[] = [
    {
        id: "decant-core",
        name: "Decant Core",
        type: "folder",
        children: [
            { id: "data-models", name: "Data Models", type: "document" },
            { id: "api-integration", name: "API Integration", type: "link" },
            {
                id: "user-interface",
                name: "User Interface",
                type: "image",
                children: [
                    { id: "documentation", name: "Documentation", type: "note" },
                    {
                        id: "project-phoenix",
                        name: "Project Phoenix",
                        type: "folder",
                        children: [
                            {
                                id: "frontend",
                                name: "Frontend",
                                type: "folder",
                                children: [
                                    {
                                        id: "components",
                                        name: "Components",
                                        type: "folder",
                                        children: [
                                            { id: "buttons", name: "Buttons", type: "component" },
                                            { id: "forms", name: "Forms", type: "component" },
                                            { id: "modals", name: "Modals", type: "component" },
                                        ],
                                    },
                                    { id: "layouts", name: "Layouts", type: "folder" },
                                    { id: "styles", name: "Styles", type: "style" },
                                    { id: "assets", name: "Assets", type: "image" },
                                ],
                            },
                            { id: "backend", name: "Backend", type: "folder" },
                            { id: "tests", name: "Tests", type: "test" },
                        ],
                    },
                ],
            },
            { id: "templates", name: "Templates", type: "folder" },
            { id: "archives", name: "Archives", type: "folder" },
            { id: "settings", name: "Settings", type: "settings" },
            {
                id: "resources",
                name: "Resources",
                type: "folder",
                children: [
                    { id: "guidelines", name: "Guidelines", type: "document" },
                    { id: "brand-assets", name: "Brand Assets", type: "image" },
                    { id: "external-tools", name: "External Tools", type: "link" },
                ],
            },
            {
                id: "team-space",
                name: "Team Space",
                type: "folder",
                children: [
                    { id: "members", name: "Members", type: "person" },
                    { id: "meeting-notes", name: "Meeting Notes", type: "note" },
                ],
            },
        ],
    },
];

// Default expanded nodes to match the mockup
export const DEFAULT_EXPANDED = [
    "decant-core",
    "user-interface",
    "project-phoenix",
    "frontend",
    "components",
    "resources",
    "team-space",
];

interface HierarchyTreeDemoProps {
    width?: number | string;
    height?: number | string;
}

export default function HierarchyTreeDemo({ width = 280, height = 600 }: HierarchyTreeDemoProps) {
    const handleSelect = (id: string, node: TreeNodeData) => {
        console.log("Selected:", id, node.name);
    };

    return (
        <div
            style={{
                width: typeof width === "number" ? `${width}px` : width,
                height: typeof height === "number" ? `${height}px` : height,
                border: "1px solid var(--decant-border-light, #e0ddd9)",
                borderRadius: "8px",
                overflow: "hidden",
            }}
        >
            <HierarchyTree
                data={SAMPLE_TREE_DATA}
                defaultExpandedIds={DEFAULT_EXPANDED}
                selectedId="project-phoenix"
                onSelect={handleSelect}
            />
        </div>
    );
}
