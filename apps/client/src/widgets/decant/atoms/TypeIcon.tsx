import "./TypeIcon.css";

export type ContentType =
    | "folder"
    | "document"
    | "code"
    | "link"
    | "image"
    | "video"
    | "audio"
    | "component"
    | "style"
    | "test"
    | "settings"
    | "person"
    | "note";

interface TypeIconProps {
    type: ContentType;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const TYPE_CONFIG: Record<ContentType, { icon: string; color: string; label: string }> = {
    folder: { icon: "bx-folder", color: "#8B6914", label: "Folder" },
    document: { icon: "bx-file", color: "#2196F3", label: "Document" },
    code: { icon: "bx-code-alt", color: "#9C27B0", label: "Code" },
    link: { icon: "bx-link", color: "#7B1FA2", label: "Link" },
    image: { icon: "bx-image", color: "#E91E63", label: "Image" },
    video: { icon: "bx-video", color: "#FF5722", label: "Video" },
    audio: { icon: "bx-music", color: "#4CAF50", label: "Audio" },
    component: { icon: "bx-extension", color: "#FF9800", label: "Component" },
    style: { icon: "bx-palette", color: "#E040FB", label: "Style" },
    test: { icon: "bx-test-tube", color: "#4CAF50", label: "Test" },
    settings: { icon: "bx-cog", color: "#607D8B", label: "Settings" },
    person: { icon: "bx-user", color: "#FF9800", label: "Person" },
    note: { icon: "bx-note", color: "#009688", label: "Note" },
};

const SIZE_MAP = {
    sm: 14,
    md: 16,
    lg: 20,
};

export default function TypeIcon({ type, size = "md", className = "" }: TypeIconProps) {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.document;
    const iconSize = SIZE_MAP[size];

    return (
        <span
            className={`decant-type-icon decant-type-icon--${size} ${className}`}
            style={{ color: config.color, fontSize: `${iconSize}px` }}
            title={config.label}
            aria-label={config.label}
        >
            <i className={`bx ${config.icon}`} />
        </span>
    );
}

export { TYPE_CONFIG };
