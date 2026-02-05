import { useState, useMemo, useCallback } from "preact/hooks";
import ViewToggle, { type ViewMode } from "../atoms/ViewToggle";
import DataTableRow, { type DataTableRowData } from "../composites/DataTableRow";
import ExpandedRowCard, { type ExpandedRowData } from "../composites/ExpandedRowCard";
import "./DataTable.css";

export type SortDirection = "asc" | "desc" | null;
export type SortableColumn = "title" | "segment" | "category" | "date" | "company";

interface DataTableProps {
    /** Row data to display */
    data: DataTableRowData[];
    /** Extended data for expanded view (keyed by row id) */
    expandedData?: Record<string, ExpandedRowData>;
    /** Currently selected row ID */
    selectedId?: string | null;
    /** Callback when row is selected */
    onSelect?: (id: string, row: DataTableRowData) => void;
    /** Callback when row action is triggered */
    onAction?: (action: string, id: string) => void;
    /** Callback when star is toggled */
    onToggleStar?: (id: string) => void;
    /** Current view mode */
    viewMode?: ViewMode;
    /** Callback when view mode changes */
    onViewModeChange?: (mode: ViewMode) => void;
    /** Status bar text */
    statusText?: string;
    /** Additional CSS class */
    className?: string;
}

interface ColumnConfig {
    key: SortableColumn | string;
    label: string;
    sortable: boolean;
    width?: string;
}

const COLUMNS: ColumnConfig[] = [
    { key: "expand", label: "", sortable: false },
    { key: "logo", label: "Logo", sortable: false },
    { key: "title", label: "Title", sortable: true },
    { key: "type", label: "@Type", sortable: false },
    { key: "segment", label: "Segment", sortable: true },
    { key: "category", label: "Category", sortable: true },
    { key: "hierarchy", label: "Hierarchy", sortable: false },
    { key: "quickPhrase", label: "Quick Phrase", sortable: false },
    { key: "tags", label: "Tags", sortable: false },
    { key: "date", label: "Date", sortable: true },
    { key: "company", label: "Company", sortable: true },
    { key: "star", label: "★", sortable: false },
];

export default function DataTable({
    data,
    expandedData = {},
    selectedId = null,
    onSelect,
    onAction,
    onToggleStar,
    viewMode = "table",
    onViewModeChange,
    statusText = "",
    className = "",
}: DataTableProps) {
    const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedId);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [sortColumn, setSortColumn] = useState<SortableColumn | null>("title");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [internalViewMode, setInternalViewMode] = useState<ViewMode>(viewMode);

    // Use controlled or uncontrolled selection
    const currentSelectedId = selectedId !== undefined ? selectedId : internalSelectedId;
    const currentViewMode = onViewModeChange ? viewMode : internalViewMode;

    // Sort data
    const sortedData = useMemo(() => {
        if (!sortColumn || !sortDirection) return data;

        return [...data].sort((a, b) => {
            const aVal = a[sortColumn as keyof DataTableRowData] as string;
            const bVal = b[sortColumn as keyof DataTableRowData] as string;

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });
    }, [data, sortColumn, sortDirection]);

    const handleSelect = useCallback(
        (id: string) => {
            setInternalSelectedId(id);
            if (onSelect) {
                const row = data.find((r) => r.id === id);
                if (row) onSelect(id, row);
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

    const handleToggleStar = useCallback(
        (id: string) => {
            if (onToggleStar) onToggleStar(id);
        },
        [onToggleStar]
    );

    const handleAction = useCallback(
        (action: string, id: string) => {
            if (onAction) onAction(action, id);
        },
        [onAction]
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

    const handleSort = useCallback((column: SortableColumn) => {
        setSortColumn((prev) => {
            if (prev === column) {
                setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
                return column;
            }
            setSortDirection("asc");
            return column;
        });
    }, []);

    return (
        <div className={`decant-data-table ${className}`}>
            {/* Top bar with view toggle */}
            <div className="decant-data-table__toolbar">
                <div className="decant-data-table__breadcrumb">
                    <span>Decant</span>
                    <i className="bx bx-chevron-right" />
                    <span>Development</span>
                    <i className="bx bx-chevron-right" />
                    <span>Tools</span>
                </div>
                <ViewToggle activeView={currentViewMode} onViewChange={handleViewModeChange} />
            </div>

            {/* Column headers */}
            <div className="decant-data-table__header" role="row">
                {COLUMNS.map((col) => (
                    <div
                        key={col.key}
                        className={`decant-data-table__header-cell decant-data-table__header-cell--${col.key} ${
                            col.sortable ? "decant-data-table__header-cell--sortable" : ""
                        } ${sortColumn === col.key ? "decant-data-table__header-cell--sorted" : ""}`}
                        onClick={col.sortable ? () => handleSort(col.key as SortableColumn) : undefined}
                        role="columnheader"
                        aria-sort={
                            sortColumn === col.key
                                ? sortDirection === "asc"
                                    ? "ascending"
                                    : "descending"
                                : undefined
                        }
                    >
                        <span>{col.label}</span>
                        {col.sortable && sortColumn === col.key && (
                            <i className={`bx ${sortDirection === "asc" ? "bx-chevron-up" : "bx-chevron-down"}`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Data rows */}
            <div className="decant-data-table__body" role="rowgroup">
                {sortedData.map((row) => (
                    <div key={row.id}>
                        <DataTableRow
                            data={row}
                            isSelected={currentSelectedId === row.id}
                            isExpanded={expandedIds.has(row.id)}
                            onSelect={handleSelect}
                            onToggleExpand={handleToggleExpand}
                            onToggleStar={handleToggleStar}
                        />
                        {expandedIds.has(row.id) && expandedData[row.id] && (
                            <ExpandedRowCard data={expandedData[row.id]} onAction={handleAction} />
                        )}
                    </div>
                ))}
            </div>

            {/* Status bar */}
            {statusText && (
                <div className="decant-data-table__status">
                    {statusText}
                </div>
            )}
        </div>
    );
}

export type { DataTableRowData, ExpandedRowData, ViewMode };
