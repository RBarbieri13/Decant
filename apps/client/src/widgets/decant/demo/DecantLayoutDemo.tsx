/**
 * DecantLayout Demo Component
 *
 * Full application demo showing all Decant components working together:
 * - TopBar with search, breadcrumbs, view toggle
 * - HierarchyTree sidebar
 * - DataTable main content
 * - PropertiesPanel right panel
 */

import { useState, useCallback } from "preact/hooks";
import DecantLayout from "../containers/DecantLayout";
import HierarchyTree from "../containers/HierarchyTree";
import DataTable from "../containers/DataTable";
import PropertiesPanel from "../containers/PropertiesPanel";
import type { TreeNodeData } from "../composites/TreeNode";
import type { DataTableRowData } from "../composites/DataTableRow";
import type { ExpandedRowData } from "../composites/ExpandedRowCard";
import type { PropertiesPanelData } from "../containers/PropertiesPanel";
import type { ViewMode } from "../atoms/ViewToggle";
import type { BreadcrumbItem } from "../composites/TopBar";
import "../decant-variables.css";

// ============================================================================
// SAMPLE DATA
// ============================================================================

// Tree data for sidebar
const TREE_DATA: TreeNodeData[] = [
    {
        id: "workspace",
        name: "Workspace",
        type: "folder",
        children: [
            {
                id: "development",
                name: "Development",
                type: "folder",
                children: [
                    {
                        id: "tools",
                        name: "Tools",
                        type: "folder",
                        children: [
                            { id: "react", name: "React", type: "component" },
                            { id: "vue", name: "Vue.js", type: "component" },
                            { id: "angular", name: "Angular", type: "component" },
                        ],
                    },
                    {
                        id: "frameworks",
                        name: "Frameworks",
                        type: "folder",
                        children: [
                            { id: "nextjs", name: "Next.js", type: "link" },
                            { id: "nuxt", name: "Nuxt", type: "link" },
                        ],
                    },
                ],
            },
            {
                id: "design",
                name: "Design",
                type: "folder",
                children: [
                    { id: "figma", name: "Figma", type: "image" },
                    { id: "sketch", name: "Sketch", type: "image" },
                ],
            },
            {
                id: "documentation",
                name: "Documentation",
                type: "folder",
                children: [
                    { id: "api-docs", name: "API Docs", type: "document" },
                    { id: "guides", name: "Guides", type: "note" },
                ],
            },
        ],
    },
];

// Table data for main content
const TABLE_DATA: DataTableRowData[] = [
    {
        id: "react",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/512px-React-icon.svg.png",
        title: "React Component Library",
        type: "UI Framework",
        typeSymbol: "@",
        segment: "Frontend",
        category: "UI Framework",
        hierarchy: "Phoenix > Frontend > Components",
        quickPhrase: "Re-usable UI building blocks",
        tags: [
            { label: "React", color: "blue" },
            { label: "Component", color: "green" },
            { label: "JS", color: "yellow" },
        ],
        date: "Oct 25, 2023",
        company: "Meta",
        starred: true,
    },
    {
        id: "vue",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/512px-Vue.js_Logo_2.svg.png",
        title: "Vue.js Framework",
        type: "UI Framework",
        typeSymbol: "@",
        segment: "Frontend",
        category: "Framework",
        hierarchy: "Phoenix > Frontend > Frameworks",
        quickPhrase: "Progressive JavaScript framework",
        tags: [
            { label: "Vue", color: "green" },
            { label: "Framework", color: "blue" },
        ],
        date: "Oct 24, 2023",
        company: "Evan You",
        starred: false,
    },
    {
        id: "angular",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Angular_full_color_logo.svg/512px-Angular_full_color_logo.svg.png",
        title: "Angular Platform",
        type: "UI Framework",
        typeSymbol: "@",
        segment: "Frontend",
        category: "Framework",
        hierarchy: "Phoenix > Frontend > Frameworks",
        quickPhrase: "Platform for building web apps",
        tags: [
            { label: "Angular", color: "pink" },
            { label: "TypeScript", color: "blue" },
        ],
        date: "Oct 23, 2023",
        company: "Google",
        starred: true,
    },
    {
        id: "nextjs",
        logo: "https://assets.vercel.com/image/upload/v1662130559/nextjs/Icon_dark_background.png",
        title: "Next.js",
        type: "Framework",
        typeSymbol: "@",
        segment: "Frontend",
        category: "Framework",
        hierarchy: "Phoenix > Frontend > Frameworks",
        quickPhrase: "React framework for production",
        tags: [
            { label: "Next.js", color: "gray" },
            { label: "React", color: "blue" },
            { label: "SSR", color: "purple" },
        ],
        date: "Oct 22, 2023",
        company: "Vercel",
        starred: false,
    },
    {
        id: "typescript",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/512px-Typescript_logo_2020.svg.png",
        title: "TypeScript",
        type: "Language",
        typeSymbol: "#",
        segment: "Backend",
        category: "Language",
        hierarchy: "Phoenix > Backend > Languages",
        quickPhrase: "Typed superset of JavaScript",
        tags: [
            { label: "TypeScript", color: "blue" },
            { label: "Language", color: "gray" },
        ],
        date: "Oct 21, 2023",
        company: "Microsoft",
        starred: true,
    },
];

// Expanded row data
const EXPANDED_DATA: Record<string, ExpandedRowData> = {
    react: {
        id: "react",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/512px-React-icon.svg.png",
        title: "React Component Library",
        typeBadge: "UI Framework",
        createdBy: "Jordan Walke",
        initialRelease: "May 29, 2013",
        repositoryUrl: "https://github.com/facebook/react",
        repositoryName: "facebook/react",
        stars: "210k",
        forks: "45k",
        usedBy: ["Netflix", "Airbnb", "Instagram", "WhatsApp", "Uber"],
        tags: [
            { label: "React", color: "blue" },
            { label: "Component", color: "green" },
            { label: "JavaScript", color: "yellow" },
            { label: "UI", color: "purple" },
        ],
    },
};

// Properties panel data
const PROPERTIES_DATA: Record<string, PropertiesPanelData> = {
    react: {
        id: "react",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/512px-React-icon.svg.png",
        title: "React Component Library",
        typeBadge: "UI Framework",
        quickStats: {
            stars: "210k",
            forks: "45k",
            license: "MIT",
        },
        general: [
            { label: "Version", value: "18.2.0" },
            { label: "License", value: "MIT" },
            { label: "Author", value: "Meta Open Source" },
            { label: "Repository", value: "github.com/facebook/react", isLink: true },
        ],
        statistics: [
            { label: "Stars", value: "210k", icon: "bxs-star" },
            { label: "Forks", value: "45k", icon: "bx-git-repo-forked" },
            { label: "Downloads", value: "12M/week" },
            { label: "Last Updated", value: "2 days ago" },
        ],
        dependencies: [
            { name: "loose-envify", version: "^1.1.0" },
            { name: "scheduler", version: "^0.23.0" },
        ],
        metadata: [
            { label: "Brand", value: "Facebook" },
            { label: "Category", value: "UI Framework" },
            { label: "Created", value: "May 29, 2013" },
            { label: "Language", value: "JavaScript" },
        ],
        tags: [
            { label: "React", color: "blue" },
            { label: "UI", color: "green" },
            { label: "Frontend", color: "yellow" },
            { label: "Library", color: "purple" },
        ],
        relatedItems: [
            { id: "redux", title: "Redux", type: "Library" },
            { id: "react-router", title: "React Router", type: "Library" },
            { id: "nextjs", title: "Next.js", type: "Framework" },
        ],
        backlinks: [
            { id: "frontend-guide", title: "Frontend Development Guide", source: "Documentation" },
            { id: "component-patterns", title: "Component Patterns", source: "Best Practices" },
        ],
    },
};

// ============================================================================
// DEMO COMPONENT
// ============================================================================

export default function DecantLayoutDemo() {
    // State
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const [selectedTreeId, setSelectedTreeId] = useState<string>("tools");
    const [selectedRowId, setSelectedRowId] = useState<string | null>("react");
    const [rightPanelVisible, setRightPanelVisible] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
        { label: "Workspace", id: "workspace" },
        { label: "Development", id: "development" },
        { label: "Tools", id: "tools" },
    ]);

    // Handlers
    const handleSearchChange = useCallback((query: string) => {
        setSearchQuery(query);
        console.log("Search:", query);
    }, []);

    const handleViewModeChange = useCallback((mode: ViewMode) => {
        setViewMode(mode);
        console.log("View mode:", mode);
    }, []);

    const handleTreeSelect = useCallback((id: string, node: TreeNodeData) => {
        setSelectedTreeId(id);
        console.log("Tree selected:", id, node.name);
        // Update breadcrumbs based on selection
        setBreadcrumbs([
            { label: "Workspace", id: "workspace" },
            { label: node.name, id: id },
        ]);
    }, []);

    const handleRowSelect = useCallback((id: string, row: DataTableRowData) => {
        setSelectedRowId(id);
        setRightPanelVisible(true);
        console.log("Row selected:", id, row.title);
    }, []);

    const handleToggleStar = useCallback((id: string) => {
        console.log("Toggle star:", id);
    }, []);

    const handleRowAction = useCallback((action: string, id: string) => {
        console.log("Row action:", action, id);
    }, []);

    const handlePanelAction = useCallback((action: string, id: string) => {
        console.log("Panel action:", action, id);
    }, []);

    const handleClosePanel = useCallback(() => {
        setRightPanelVisible(false);
    }, []);

    const handleBreadcrumbClick = useCallback((item: BreadcrumbItem, index: number) => {
        console.log("Breadcrumb clicked:", item.label, index);
    }, []);

    const handleToggleSidebar = useCallback(() => {
        setSidebarCollapsed((prev) => !prev);
    }, []);

    const handleSettingsClick = useCallback(() => {
        console.log("Settings clicked");
    }, []);

    const handleUserMenuClick = useCallback(() => {
        console.log("User menu clicked");
    }, []);

    // Get properties data for selected row
    const propertiesData = selectedRowId ? PROPERTIES_DATA[selectedRowId] || null : null;

    return (
        <DecantLayout
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            breadcrumbs={breadcrumbs}
            onBreadcrumbClick={handleBreadcrumbClick}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={handleToggleSidebar}
            rightPanelVisible={rightPanelVisible}
            onToggleRightPanel={() => setRightPanelVisible(!rightPanelVisible)}
            onSettingsClick={handleSettingsClick}
            onUserMenuClick={handleUserMenuClick}
            userName="Robert B."
            sidebar={
                <HierarchyTree
                    data={TREE_DATA}
                    selectedId={selectedTreeId}
                    onSelect={handleTreeSelect}
                    defaultExpandedIds={["workspace", "development", "tools"]}
                />
            }
            rightPanel={
                <PropertiesPanel
                    data={propertiesData}
                    onClose={handleClosePanel}
                    onAction={handlePanelAction}
                />
            }
        >
            <DataTable
                data={TABLE_DATA}
                expandedData={EXPANDED_DATA}
                selectedId={selectedRowId}
                onSelect={handleRowSelect}
                onToggleStar={handleToggleStar}
                onAction={handleRowAction}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                statusText={`Showing ${TABLE_DATA.length} items in "Tools" | 89 total in category | 5,432 total in database`}
            />
        </DecantLayout>
    );
}
