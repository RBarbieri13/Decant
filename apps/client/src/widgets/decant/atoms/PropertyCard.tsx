import { useState } from "preact/hooks";
import "./PropertyCard.css";

export interface PropertyField {
    label: string;
    value: string;
    isLink?: boolean;
    linkUrl?: string;
    icon?: string;
}

interface PropertyCardProps {
    title: string;
    fields: PropertyField[];
    collapsible?: boolean;
    defaultExpanded?: boolean;
    badge?: string | number;
    className?: string;
}

export default function PropertyCard({
    title,
    fields,
    collapsible = false,
    defaultExpanded = true,
    badge,
    className = "",
}: PropertyCardProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const handleToggle = () => {
        if (collapsible) {
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div className={`decant-property-card ${className}`}>
            <div
                className={`decant-property-card__header ${collapsible ? "decant-property-card__header--clickable" : ""}`}
                onClick={handleToggle}
                role={collapsible ? "button" : undefined}
                aria-expanded={collapsible ? isExpanded : undefined}
            >
                <h4 className="decant-property-card__title">{title}</h4>
                {badge !== undefined && (
                    <span className="decant-property-card__badge">{badge}</span>
                )}
                {collapsible && (
                    <i className={`bx ${isExpanded ? "bx-chevron-up" : "bx-chevron-down"} decant-property-card__chevron`} />
                )}
            </div>

            {(!collapsible || isExpanded) && (
                <div className="decant-property-card__content">
                    {fields.map((field, index) => (
                        <div key={index} className="decant-property-card__field">
                            <span className="decant-property-card__label">{field.label}</span>
                            {field.isLink && field.linkUrl ? (
                                <a
                                    href={field.linkUrl}
                                    className="decant-property-card__value decant-property-card__value--link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {field.icon && <i className={`bx ${field.icon}`} />}
                                    {field.value}
                                </a>
                            ) : (
                                <span className="decant-property-card__value">
                                    {field.icon && <i className={`bx ${field.icon}`} />}
                                    {field.value}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
