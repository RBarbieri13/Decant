import "./LogoIcon.css";

interface LogoIconProps {
    /** URL to the logo image */
    src: string;
    /** Alt text for accessibility */
    alt: string;
    /** Size variant */
    size?: "sm" | "md" | "lg" | "xl";
    /** Optional fallback icon class (boxicon) if image fails to load */
    fallbackIcon?: string;
    /** Additional CSS class */
    className?: string;
}

const SIZE_MAP = {
    sm: 20,
    md: 24,
    lg: 32,
    xl: 48,
};

export default function LogoIcon({
    src,
    alt,
    size = "md",
    fallbackIcon = "bx-cube",
    className = "",
}: LogoIconProps) {
    const pixelSize = SIZE_MAP[size];

    const handleError = (e: Event) => {
        const img = e.target as HTMLImageElement;
        img.style.display = "none";
        const fallback = img.nextElementSibling as HTMLElement;
        if (fallback) {
            fallback.style.display = "flex";
        }
    };

    return (
        <span
            className={`decant-logo-icon decant-logo-icon--${size} ${className}`}
            style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
        >
            <img
                src={src}
                alt={alt}
                className="decant-logo-icon__img"
                onError={handleError}
                loading="lazy"
            />
            <span
                className="decant-logo-icon__fallback"
                style={{ display: "none" }}
                aria-hidden="true"
            >
                <i className={`bx ${fallbackIcon}`} />
            </span>
        </span>
    );
}
