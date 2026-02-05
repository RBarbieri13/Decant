import "./TabBar.css";

export interface Tab {
    id: string;
    label: string;
    count?: number;
}

interface TabBarProps {
    tabs: Tab[];
    activeTabId: string;
    onTabChange: (tabId: string) => void;
    className?: string;
}

export default function TabBar({ tabs, activeTabId, onTabChange, className = "" }: TabBarProps) {
    return (
        <div className={`decant-tab-bar ${className}`} role="tablist">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className={`decant-tab-bar__tab ${activeTabId === tab.id ? "decant-tab-bar__tab--active" : ""}`}
                    onClick={() => onTabChange(tab.id)}
                    role="tab"
                    aria-selected={activeTabId === tab.id}
                    aria-controls={`tabpanel-${tab.id}`}
                >
                    <span className="decant-tab-bar__label">{tab.label}</span>
                    {tab.count !== undefined && (
                        <span className="decant-tab-bar__count">{tab.count}</span>
                    )}
                </button>
            ))}
        </div>
    );
}
