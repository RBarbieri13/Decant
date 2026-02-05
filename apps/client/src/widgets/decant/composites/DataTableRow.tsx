import { useCallback } from "preact/hooks";
import LogoIcon from "../atoms/LogoIcon";
import Tag, { type TagColor } from "../atoms/Tag";
import StarButton from "../atoms/StarButton";
import "./DataTableRow.css";

export interface DataTableRowData {
    id: string;
    logo: string;
    title: string;
    type: string;
    typeSymbol?: string;
    segment: string;
    category: string;
    hierarchy: string;
    quickPhrase: string;
    tags: { label: string; color: TagColor }[];
    date: string;
    company: string;
    starred: boolean;
}

interface DataTableRowProps {
    data: DataTableRowData;
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: (id: string) => void;
    onToggleExpand: (id: string) => void;
    onToggleStar: (id: string) => void;
}

export default function DataTableRow({
    data,
    isSelected,
    isExpanded,
    onSelect,
    onToggleExpand,
    onToggleStar,
}: DataTableRowProps) {
    const handleRowClick = useCallback(() => {
        onSelect(data.id);
    }, [data.id, onSelect]);

    const handleExpandClick = useCallback(
        (e: Event) => {
            e.stopPropagation();
            onToggleExpand(data.id);
        },
        [data.id, onToggleExpand]
    );

    const handleStarToggle = useCallback(() => {
        onToggleStar(data.id);
    }, [data.id, onToggleStar]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(data.id);
            }
        },
        [data.id, onSelect]
    );

    return (
        <div
            className={`decant-data-row ${isSelected ? "decant-data-row--selected" : ""} ${
                isExpanded ? "decant-data-row--expanded" : ""
            }`}
            onClick={handleRowClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="row"
            aria-selected={isSelected}
            aria-expanded={isExpanded}
        >
            {/* Expand toggle */}
            <div className="decant-data-row__cell decant-data-row__cell--expand">
                <button
                    type="button"
                    className="decant-data-row__expand-btn"
                    onClick={handleExpandClick}
                    aria-label={isExpanded ? "Collapse row" : "Expand row"}
                >
                    <i className={`bx ${isExpanded ? "bx-chevron-down" : "bx-chevron-right"}`} />
                </button>
            </div>

            {/* Logo */}
            <div className="decant-data-row__cell decant-data-row__cell--logo">
                <LogoIcon src={data.logo} alt={data.title} size="md" />
            </div>

            {/* Title */}
            <div className="decant-data-row__cell decant-data-row__cell--title">
                <span className="decant-data-row__title-text">{data.title}</span>
            </div>

            {/* Type symbol */}
            <div className="decant-data-row__cell decant-data-row__cell--type">
                <span className="decant-data-row__type-symbol">{data.typeSymbol || "@"}</span>
            </div>

            {/* Segment */}
            <div className="decant-data-row__cell decant-data-row__cell--segment">
                {data.segment}
            </div>

            {/* Category */}
            <div className="decant-data-row__cell decant-data-row__cell--category">
                {data.category}
            </div>

            {/* Hierarchy breadcrumb */}
            <div className="decant-data-row__cell decant-data-row__cell--hierarchy">
                <span className="decant-data-row__hierarchy-text">{data.hierarchy}</span>
            </div>

            {/* Quick phrase */}
            <div className="decant-data-row__cell decant-data-row__cell--phrase">
                <span className="decant-data-row__phrase-text">{data.quickPhrase}</span>
            </div>

            {/* Tags */}
            <div className="decant-data-row__cell decant-data-row__cell--tags">
                <div className="decant-data-row__tags">
                    {data.tags.slice(0, 3).map((tag, index) => (
                        <Tag key={index} label={tag.label} color={tag.color} size="sm" />
                    ))}
                </div>
            </div>

            {/* Date */}
            <div className="decant-data-row__cell decant-data-row__cell--date">
                {data.date}
            </div>

            {/* Company */}
            <div className="decant-data-row__cell decant-data-row__cell--company">
                {data.company}
            </div>

            {/* Star */}
            <div className="decant-data-row__cell decant-data-row__cell--star">
                <StarButton starred={data.starred} onToggle={handleStarToggle} size="md" />
            </div>
        </div>
    );
}
