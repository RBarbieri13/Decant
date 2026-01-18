/**
 * Space Item Component
 *
 * Displays a single Space in the sidebar with color indicator.
 */

import type { DecantSpace } from "../types/workspace.types.js";
import { SPACE_COLOR_MAP } from "../types/workspace.types.js";

interface SpaceItemProps {
    space: DecantSpace;
    isSelected: boolean;
    onClick: () => void;
}

export function SpaceItem({ space, isSelected, onClick }: SpaceItemProps) {
    const colorValue = SPACE_COLOR_MAP[space.color];

    return (
        <div
            className={`space-item ${isSelected ? 'space-item--selected' : ''}`}
            onClick={onClick}
            style={isSelected ? { backgroundColor: colorValue + '20' } : undefined}
        >
            <span
                className="space-item__color-dot"
                style={{ backgroundColor: colorValue }}
            />
            <span className="space-item__title">{space.title}</span>
            <span className="space-item__count">{space.collectionCount}</span>
        </div>
    );
}

export default SpaceItem;
