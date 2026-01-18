/**
 * Content Type Badge Component
 *
 * Visual indicator for content type (YouTube, Article, GitHub, etc.)
 */

import type { ContentType } from "../types/workspace.types.js";
import { CONTENT_TYPE_CONFIG } from "../types/workspace.types.js";

interface ContentTypeBadgeProps {
    type: ContentType;
    showLabel?: boolean;
}

export function ContentTypeBadge({ type, showLabel = false }: ContentTypeBadgeProps) {
    const config = CONTENT_TYPE_CONFIG[type] || CONTENT_TYPE_CONFIG.other;

    return (
        <span
            className="content-type-badge"
            style={{ backgroundColor: config.color + '20' }}
            title={config.label}
        >
            <span className="content-type-badge__icon">{config.icon}</span>
            {showLabel && <span className="content-type-badge__label">{config.label}</span>}
        </span>
    );
}

export default ContentTypeBadge;
