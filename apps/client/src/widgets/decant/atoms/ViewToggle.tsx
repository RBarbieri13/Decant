import "./ViewToggle.css";

export type ViewMode = "table" | "grid" | "tree" | "list";

interface ViewToggleProps {
    /** Current active view */
    activeView: ViewMode;
    /** Callback when view changes */
    onViewChange: (view: ViewMode) => void;
    /** Additional CSS class */
    className?: string;
}

const VIEW_OPTIONS: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: "table", icon: "bx-table", label: "Table" },
    { mode: "grid", icon: "bx-grid-alt", label: "Grid" },
    { mode: "tree", icon: "bx-git-branch", label: "Tree" },
    { mode: "list", icon: "bx-list-ul", label: "List" },
];

export default function ViewToggle({
    activeView,
    onViewChange,
    className = "",
}: ViewToggleProps) {
    return (
        <div className={`decant-view-toggle ${className}`} role="tablist">
            {VIEW_OPTIONS.map(({ mode, icon, label }) => (
                <button
                    key={mode}
                    type="button"
                    className={`decant-view-toggle__option ${
                        activeView === mode ? "decant-view-toggle__option--active" : ""
                    }`}
                    onClick={() => onViewChange(mode)}
                    role="tab"
                    aria-selected={activeView === mode}
                    aria-label={`${label} view`}
                >
                    <i className={`bx ${icon}`} />
                    <span>{label}</span>
                </button>
            ))}
        </div>
    );
}
