import "./StarButton.css";

interface StarButtonProps {
    /** Whether the item is starred/favorited */
    starred: boolean;
    /** Click handler to toggle star */
    onToggle: () => void;
    /** Size variant */
    size?: "sm" | "md" | "lg";
    /** Additional CSS class */
    className?: string;
}

const SIZE_MAP = {
    sm: 14,
    md: 16,
    lg: 20,
};

export default function StarButton({
    starred,
    onToggle,
    size = "md",
    className = "",
}: StarButtonProps) {
    const iconSize = SIZE_MAP[size];

    const handleClick = (e: Event) => {
        e.stopPropagation();
        onToggle();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
        }
    };

    return (
        <button
            type="button"
            className={`decant-star-button decant-star-button--${size} ${
                starred ? "decant-star-button--starred" : ""
            } ${className}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            aria-label={starred ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={starred}
            style={{ fontSize: `${iconSize}px` }}
        >
            <i className={`bx ${starred ? "bxs-star" : "bx-star"}`} />
        </button>
    );
}
