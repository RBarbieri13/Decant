import "./HierarchyLine.css";

interface HierarchyLineProps {
    /** Whether this node has children (shows vertical continuation line) */
    hasChildren?: boolean;
    /** Whether this is the last sibling at this level */
    isLast?: boolean;
    /** Depth level for indentation (0 = root) */
    depth: number;
    /** Array indicating which ancestor levels should show continuation lines */
    ancestorLines?: boolean[];
}

export default function HierarchyLine({
    hasChildren = false,
    isLast = false,
    depth,
    ancestorLines = [],
}: HierarchyLineProps) {
    if (depth === 0) {
        return null;
    }

    return (
        <span className="decant-hierarchy-line" aria-hidden="true">
            {/* Render continuation lines for ancestors */}
            {ancestorLines.map((showLine, index) => (
                <span
                    key={index}
                    className={`decant-hierarchy-line__segment ${
                        showLine ? "decant-hierarchy-line__segment--vertical" : ""
                    }`}
                />
            ))}

            {/* Render the connector for this node */}
            <span
                className={`decant-hierarchy-line__segment decant-hierarchy-line__segment--connector ${
                    isLast ? "decant-hierarchy-line__segment--last" : ""
                }`}
            />
        </span>
    );
}
