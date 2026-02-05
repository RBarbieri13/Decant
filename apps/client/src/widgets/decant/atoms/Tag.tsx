import "./Tag.css";

export type TagColor = "blue" | "yellow" | "pink" | "green" | "purple" | "gray";

interface TagProps {
    /** Tag label text */
    label: string;
    /** Color variant */
    color?: TagColor;
    /** Size variant */
    size?: "sm" | "md";
    /** Click handler */
    onClick?: () => void;
    /** Additional CSS class */
    className?: string;
}

export default function Tag({
    label,
    color = "blue",
    size = "sm",
    onClick,
    className = "",
}: TagProps) {
    const isClickable = !!onClick;

    const handleClick = () => {
        if (onClick) onClick();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <span
            className={`decant-tag decant-tag--${color} decant-tag--${size} ${
                isClickable ? "decant-tag--clickable" : ""
            } ${className}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={isClickable ? 0 : undefined}
            role={isClickable ? "button" : undefined}
        >
            {label}
        </span>
    );
}
