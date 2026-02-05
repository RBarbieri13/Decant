import { useCallback } from "preact/hooks";
import ViewToggle, { type ViewMode } from "../atoms/ViewToggle";
import "./TopBar.css";

export interface BreadcrumbItem {
    label: string;
    id?: string;
}

interface TopBarProps {
    /** Search query value */
    searchQuery: string;
    /** Callback when search query changes */
    onSearchChange: (query: string) => void;
    /** Breadcrumb navigation items */
    breadcrumbs: BreadcrumbItem[];
    /** Callback when breadcrumb is clicked */
    onBreadcrumbClick?: (item: BreadcrumbItem, index: number) => void;
    /** Current view mode */
    viewMode: ViewMode;
    /** Callback when view mode changes */
    onViewModeChange: (mode: ViewMode) => void;
    /** User name to display */
    userName?: string;
    /** User avatar URL */
    userAvatar?: string;
    /** Callback when settings is clicked */
    onSettingsClick?: () => void;
    /** Callback when user menu is clicked */
    onUserMenuClick?: () => void;
    /** Additional CSS class */
    className?: string;
}

export default function TopBar({
    searchQuery,
    onSearchChange,
    breadcrumbs,
    onBreadcrumbClick,
    viewMode,
    onViewModeChange,
    userName,
    userAvatar,
    onSettingsClick,
    onUserMenuClick,
    className = "",
}: TopBarProps) {
    const handleSearchInput = useCallback(
        (e: Event) => {
            onSearchChange((e.target as HTMLInputElement).value);
        },
        [onSearchChange]
    );

    const handleSearchClear = useCallback(() => {
        onSearchChange("");
    }, [onSearchChange]);

    const handleKeyboardShortcut = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault();
            const input = document.querySelector(".decant-topbar__search-input") as HTMLInputElement;
            input?.focus();
        }
    }, []);

    // Add keyboard shortcut listener
    if (typeof window !== "undefined") {
        window.addEventListener("keydown", handleKeyboardShortcut);
    }

    return (
        <header className={`decant-topbar ${className}`}>
            {/* Brand section - forest green background */}
            <div className="decant-topbar__brand">
                <div className="decant-topbar__logo">
                    <i className="bx bxs-flask" />
                </div>
                <span className="decant-topbar__wordmark">Decant</span>
            </div>

            {/* Toolbar section - tan/cream background */}
            <div className="decant-topbar__toolbar">
                {/* Search */}
                <div className="decant-topbar__search">
                    <i className="bx bx-search decant-topbar__search-icon" />
                    <input
                        type="text"
                        className="decant-topbar__search-input"
                        value={searchQuery}
                        onInput={handleSearchInput}
                        placeholder="Search..."
                        aria-label="Search Decant"
                    />
                    {searchQuery ? (
                        <button
                            type="button"
                            className="decant-topbar__search-clear"
                            onClick={handleSearchClear}
                            aria-label="Clear search"
                        >
                            <i className="bx bx-x" />
                        </button>
                    ) : (
                        <kbd className="decant-topbar__search-shortcut">⌘K</kbd>
                    )}
                </div>

                {/* Breadcrumbs */}
                <nav className="decant-topbar__breadcrumbs" aria-label="Breadcrumb">
                    {breadcrumbs.map((item, index) => (
                        <span key={index} className="decant-topbar__breadcrumb-item">
                            {index > 0 && (
                                <i className="bx bx-chevron-right decant-topbar__breadcrumb-separator" />
                            )}
                            <button
                                type="button"
                                className={`decant-topbar__breadcrumb-link ${
                                    index === breadcrumbs.length - 1
                                        ? "decant-topbar__breadcrumb-link--active"
                                        : ""
                                }`}
                                onClick={() => onBreadcrumbClick?.(item, index)}
                            >
                                {item.label}
                            </button>
                        </span>
                    ))}
                </nav>

                {/* Spacer */}
                <div className="decant-topbar__spacer" />

                {/* View Toggle */}
                <ViewToggle
                    activeView={viewMode}
                    onViewChange={onViewModeChange}
                    className="decant-topbar__view-toggle"
                />

                {/* Divider */}
                <div className="decant-topbar__divider" />

                {/* Settings */}
                <button
                    type="button"
                    className="decant-topbar__icon-btn"
                    onClick={onSettingsClick}
                    aria-label="Settings"
                >
                    <i className="bx bx-cog" />
                </button>

                {/* User */}
                <button
                    type="button"
                    className="decant-topbar__user"
                    onClick={onUserMenuClick}
                    aria-label="User menu"
                >
                    {userAvatar ? (
                        <img
                            src={userAvatar}
                            alt={userName || "User"}
                            className="decant-topbar__user-avatar"
                        />
                    ) : (
                        <div className="decant-topbar__user-avatar decant-topbar__user-avatar--placeholder">
                            <i className="bx bx-user" />
                        </div>
                    )}
                    <i className="bx bx-chevron-down decant-topbar__user-chevron" />
                </button>
            </div>
        </header>
    );
}
