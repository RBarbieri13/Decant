import LogoIcon from "../atoms/LogoIcon";
import Tag, { type TagColor } from "../atoms/Tag";
import "./ExpandedRowCard.css";

export interface ExpandedRowData {
    id: string;
    logo: string;
    title: string;
    typeBadge: string;
    createdBy: string;
    initialRelease: string;
    repositoryUrl: string;
    repositoryName: string;
    stars: string;
    forks: string;
    usedBy: string[];
    tags: { label: string; color: TagColor }[];
}

interface ExpandedRowCardProps {
    data: ExpandedRowData;
    onAction: (action: string, id: string) => void;
}

export default function ExpandedRowCard({ data, onAction }: ExpandedRowCardProps) {
    const handleAction = (action: string) => () => {
        onAction(action, data.id);
    };

    return (
        <div className="decant-expanded-card">
            <div className="decant-expanded-card__content">
                {/* Left: Logo */}
                <div className="decant-expanded-card__logo">
                    <LogoIcon src={data.logo} alt={data.title} size="xl" />
                </div>

                {/* Center: Details */}
                <div className="decant-expanded-card__details">
                    {/* Header with title and badge */}
                    <div className="decant-expanded-card__header">
                        <h3 className="decant-expanded-card__title">{data.title}</h3>
                        <span className="decant-expanded-card__badge">{data.typeBadge}</span>
                    </div>

                    {/* Metadata grid */}
                    <div className="decant-expanded-card__meta">
                        <div className="decant-expanded-card__meta-item">
                            <span className="decant-expanded-card__meta-label">Created by:</span>
                            <span className="decant-expanded-card__meta-value">{data.createdBy}</span>
                        </div>
                        <div className="decant-expanded-card__meta-item">
                            <span className="decant-expanded-card__meta-label">Initial release:</span>
                            <span className="decant-expanded-card__meta-value">{data.initialRelease}</span>
                        </div>
                        <div className="decant-expanded-card__meta-item">
                            <span className="decant-expanded-card__meta-label">Repository:</span>
                            <a
                                href={data.repositoryUrl}
                                className="decant-expanded-card__meta-link"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {data.repositoryName}
                            </a>
                        </div>
                        <div className="decant-expanded-card__meta-item">
                            <span className="decant-expanded-card__meta-label">Stars:</span>
                            <span className="decant-expanded-card__meta-value">{data.stars}</span>
                        </div>
                        <div className="decant-expanded-card__meta-item">
                            <span className="decant-expanded-card__meta-label">Forks:</span>
                            <span className="decant-expanded-card__meta-value">{data.forks}</span>
                        </div>
                    </div>

                    {/* Used by */}
                    <div className="decant-expanded-card__used-by">
                        <span className="decant-expanded-card__meta-label">Used by:</span>
                        <span className="decant-expanded-card__meta-value">
                            {data.usedBy.join(", ")}
                        </span>
                    </div>

                    {/* Tags */}
                    {data.tags.length > 0 && (
                        <div className="decant-expanded-card__tags">
                            {data.tags.map((tag, index) => (
                                <Tag key={index} label={tag.label} color={tag.color} size="md" />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="decant-expanded-card__actions">
                <button
                    type="button"
                    className="decant-expanded-card__action-btn decant-expanded-card__action-btn--primary"
                    onClick={handleAction("open")}
                >
                    Open
                </button>
                <button
                    type="button"
                    className="decant-expanded-card__action-btn"
                    onClick={handleAction("edit")}
                >
                    Edit
                </button>
                <button
                    type="button"
                    className="decant-expanded-card__action-btn"
                    onClick={handleAction("link")}
                >
                    Link
                </button>
                <button
                    type="button"
                    className="decant-expanded-card__action-btn"
                    onClick={handleAction("share")}
                >
                    Share
                </button>
                <button
                    type="button"
                    className="decant-expanded-card__action-btn"
                    onClick={handleAction("learn-more")}
                >
                    Learn More
                </button>
            </div>
        </div>
    );
}
