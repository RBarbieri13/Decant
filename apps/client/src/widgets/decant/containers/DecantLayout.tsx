import { useState, useCallback } from "preact/hooks";
import type { ComponentChildren } from "preact";
import TopBar, { type BreadcrumbItem } from "../composites/TopBar";
import type { ViewMode } from "../atoms/ViewToggle";
import "./DecantLayout.css";

interface DecantLayoutProps {
    /** Left sidebar content (typically HierarchyTree) */
    sidebar?: ComponentChildren;
    /** Main content area */
    children: ComponentChildren;
    /** Right panel content (typically PropertiesPanel) */
    rightPanel?: ComponentChildren;
    /** Whether right panel is visible */
    rightPanelVisible?: boolean;
    /** Callback to toggle right panel */
    onToggleRightPanel?: () => void;
    /** Sidebar width in pixels */
    sidebarWidth?: number;
    /** Right panel width in pixels */
    rightPanelWidth?: number;
    /** Whether sidebar is collapsible */
    sidebarCollapsible?: boolean;
    /** Whether sidebar is collapsed */
    sidebarCollapsed?: boolean;
    /** Callback to toggle sidebar */
    onToggleSidebar?: () => void;
    /** Search query for top bar */
    searchQuery?: string;
    /** Callback when search changes */
    onSearchChange?: (query: string) => void;
    /** Breadcrumb items */
    breadcrumbs?: BreadcrumbItem[];
    /** Callback when breadcrumb is clicked */
    onBreadcrumbClick?: (item: BreadcrumbItem, index: number) => void;
    /** Current view mode */
    viewMode?: ViewMode;
    /** Callback when view mode changes */
    onViewModeChange?: (mode: ViewMode) => void;
    /** User name */
    userName?: string;
    /** User avatar URL */
    userAvatar?: string;
    /** Callback when settings clicked */
    onSettingsClick?: () => void;
    /** Callback when user menu clicked */
    onUserMenuClick?: () => void;
    /** Additional CSS class */
    className?: string;
}

export default function DecantLayout({
    sidebar,
    children,
    rightPanel,
    rightPanelVisible = false,
    onToggleRightPanel,
    sidebarWidth = 260,
    rightPanelWidth = 320,
    sidebarCollapsible = true,
    sidebarCollapsed = false,
    onToggleSidebar,
    searchQuery: controlledSearchQuery,
    onSearchChange,
    breadcrumbs = [{ label: "Workspace" }],
    onBreadcrumbClick,
    viewMode: controlledViewMode,
    onViewModeChange,
    userName,
    userAvatar,
    onSettingsClick,
    onUserMenuClick,
    className = "",
}: DecantLayoutProps) {
    // Internal state for uncontrolled mode
    const [internalSearchQuery, setInternalSearchQuery] = useState("");
    const [internalViewMode, setInternalViewMode] = useState<ViewMode>("table");
    const [internalSidebarCollapsed, setInternalSidebarCollapsed] = useState(sidebarCollapsed);

    // Use controlled or uncontrolled values
    const searchQuery = controlledSearchQuery ?? internalSearchQuery;
    const viewMode = controlledViewMode ?? internalViewMode;
    const isSidebarCollapsed = onToggleSidebar ? sidebarCollapsed : internalSidebarCollapsed;

    const handleSearchChange = useCallback(
        (query: string) => {
            if (onSearchChange) {
                onSearchChange(query);
            } else {
                setInternalSearchQuery(query);
            }
        },
        [onSearchChange]
    );

    const handleViewModeChange = useCallback(
        (mode: ViewMode) => {
            if (onViewModeChange) {
                onViewModeChange(mode);
            } else {
                setInternalViewMode(mode);
            }
        },
        [onViewModeChange]
    );

    const handleToggleSidebar = useCallback(() => {
        if (onToggleSidebar) {
            onToggleSidebar();
        } else {
            setInternalSidebarCollapsed((prev) => !prev);
        }
    }, [onToggleSidebar]);

    return (
        <div className={`decant-layout ${className}`}>
            {/* Top Bar */}
            <TopBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                breadcrumbs={breadcrumbs}
                onBreadcrumbClick={onBreadcrumbClick}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                userName={userName}
                userAvatar={userAvatar}
                onSettingsClick={onSettingsClick}
                onUserMenuClick={onUserMenuClick}
            />

            {/* Main content area */}
            <div className="decant-layout__body">
                {/* Sidebar */}
                {sidebar && (
                    <aside
                        className={`decant-layout__sidebar ${
                            isSidebarCollapsed ? "decant-layout__sidebar--collapsed" : ""
                        }`}
                        style={{
                            width: isSidebarCollapsed ? 0 : sidebarWidth,
                        }}
                    >
                        <div className="decant-layout__sidebar-content">
                            {sidebar}
                        </div>
                        {sidebarCollapsible && (
                            <button
                                type="button"
                                className="decant-layout__sidebar-toggle"
                                onClick={handleToggleSidebar}
                                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            >
                                <i
                                    className={`bx ${
                                        isSidebarCollapsed ? "bx-chevron-right" : "bx-chevron-left"
                                    }`}
                                />
                            </button>
                        )}
                    </aside>
                )}

                {/* Main content */}
                <main className="decant-layout__main">
                    {children}
                </main>

                {/* Right panel */}
                {rightPanel && rightPanelVisible && (
                    <aside
                        className="decant-layout__right-panel"
                        style={{ width: rightPanelWidth }}
                    >
                        {rightPanel}
                    </aside>
                )}
            </div>
        </div>
    );
}

export type { BreadcrumbItem };
