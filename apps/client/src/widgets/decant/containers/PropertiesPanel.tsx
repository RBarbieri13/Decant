import { useState, useCallback } from "preact/hooks";
import LogoIcon from "../atoms/LogoIcon";
import TabBar, { type Tab } from "../atoms/TabBar";
import PropertyCard, { type PropertyField } from "../atoms/PropertyCard";
import Tag, { type TagColor } from "../atoms/Tag";
import "./PropertiesPanel.css";

export interface PropertiesPanelData {
    id: string;
    logo: string;
    title: string;
    typeBadge: string;
    quickStats: {
        stars: string;
        forks: string;
        license: string;
    };
    general: PropertyField[];
    statistics: PropertyField[];
    dependencies: { name: string; version?: string }[];
    metadata: PropertyField[];
    tags?: { label: string; color: TagColor }[];
    relatedItems?: { id: string; title: string; type: string }[];
    backlinks?: { id: string; title: string; source: string }[];
}

interface PropertiesPanelProps {
    data: PropertiesPanelData | null;
    onClose: () => void;
    onAction: (action: string, id: string) => void;
    className?: string;
}

const TABS: Tab[] = [
    { id: "properties", label: "Properties" },
    { id: "related", label: "Related Items" },
    { id: "backlinks", label: "Backlinks" },
];

export default function PropertiesPanel({
    data,
    onClose,
    onAction,
    className = "",
}: PropertiesPanelProps) {
    const [activeTab, setActiveTab] = useState("properties");

    const handleAction = useCallback(
        (action: string) => {
            if (data) {
                onAction(action, data.id);
            }
        },
        [data, onAction]
    );

    if (!data) {
        return (
            <div className={`decant-properties-panel decant-properties-panel--empty ${className}`}>
                <div className="decant-properties-panel__empty-state">
                    <i className="bx bx-info-circle" />
                    <p>Select an item to view its properties</p>
                </div>
            </div>
        );
    }

    // Prepare tabs with counts
    const tabsWithCounts: Tab[] = TABS.map((tab) => {
        if (tab.id === "related" && data.relatedItems) {
            return { ...tab, count: data.relatedItems.length };
        }
        if (tab.id === "backlinks" && data.backlinks) {
            return { ...tab, count: data.backlinks.length };
        }
        return tab;
    });

    return (
        <div className={`decant-properties-panel ${className}`}>
            {/* Hero Header */}
            <div className="decant-properties-panel__header">
                <button
                    type="button"
                    className="decant-properties-panel__close"
                    onClick={onClose}
                    aria-label="Close panel"
                >
                    <i className="bx bx-x" />
                </button>

                <div className="decant-properties-panel__hero">
                    <LogoIcon src={data.logo} alt={data.title} size="xl" />
                    <h2 className="decant-properties-panel__title">{data.title}</h2>
                    <span className="decant-properties-panel__badge">{data.typeBadge}</span>
                    <div className="decant-properties-panel__quick-stats">
                        <span>★ {data.quickStats.stars}</span>
                        <span className="decant-properties-panel__stat-divider">•</span>
                        <span>🍴 {data.quickStats.forks}</span>
                        <span className="decant-properties-panel__stat-divider">•</span>
                        <span>{data.quickStats.license}</span>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <TabBar tabs={tabsWithCounts} activeTabId={activeTab} onTabChange={setActiveTab} />

            {/* Content Area */}
            <div className="decant-properties-panel__content">
                {activeTab === "properties" && (
                    <div className="decant-properties-panel__cards">
                        {/* General Card */}
                        <PropertyCard title="General" fields={data.general} />

                        {/* Statistics Card */}
                        <PropertyCard title="Statistics" fields={data.statistics} />

                        {/* Dependencies Card */}
                        {data.dependencies.length > 0 && (
                            <PropertyCard
                                title="Dependencies"
                                badge={data.dependencies.length}
                                collapsible
                                defaultExpanded
                                fields={data.dependencies.map((dep) => ({
                                    label: dep.name,
                                    value: dep.version || "",
                                }))}
                            />
                        )}

                        {/* Metadata Card */}
                        <PropertyCard title="Metadata" fields={data.metadata} />

                        {/* Tags */}
                        {data.tags && data.tags.length > 0 && (
                            <div className="decant-properties-panel__tags-section">
                                <h4 className="decant-properties-panel__section-title">Tags</h4>
                                <div className="decant-properties-panel__tags">
                                    {data.tags.map((tag, index) => (
                                        <Tag key={index} label={tag.label} color={tag.color} size="md" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "related" && (
                    <div className="decant-properties-panel__list">
                        {data.relatedItems && data.relatedItems.length > 0 ? (
                            data.relatedItems.map((item) => (
                                <div key={item.id} className="decant-properties-panel__list-item">
                                    <span className="decant-properties-panel__list-title">{item.title}</span>
                                    <span className="decant-properties-panel__list-type">{item.type}</span>
                                </div>
                            ))
                        ) : (
                            <p className="decant-properties-panel__empty-list">No related items</p>
                        )}
                    </div>
                )}

                {activeTab === "backlinks" && (
                    <div className="decant-properties-panel__list">
                        {data.backlinks && data.backlinks.length > 0 ? (
                            data.backlinks.map((item) => (
                                <div key={item.id} className="decant-properties-panel__list-item">
                                    <span className="decant-properties-panel__list-title">{item.title}</span>
                                    <span className="decant-properties-panel__list-source">{item.source}</span>
                                </div>
                            ))
                        ) : (
                            <p className="decant-properties-panel__empty-list">No backlinks found</p>
                        )}
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div className="decant-properties-panel__actions">
                <button
                    type="button"
                    className="decant-properties-panel__action-btn"
                    onClick={() => handleAction("open")}
                >
                    <i className="bx bx-link-external" />
                    Open
                </button>
                <button
                    type="button"
                    className="decant-properties-panel__action-btn"
                    onClick={() => handleAction("edit")}
                >
                    <i className="bx bx-edit" />
                    Edit
                </button>
                <button
                    type="button"
                    className="decant-properties-panel__action-btn"
                    onClick={() => handleAction("link")}
                >
                    <i className="bx bx-link" />
                    Link
                </button>
                <button
                    type="button"
                    className="decant-properties-panel__action-btn"
                    onClick={() => handleAction("share")}
                >
                    <i className="bx bx-share-alt" />
                    Share
                </button>
            </div>
        </div>
    );
}

export type { PropertiesPanelData };
