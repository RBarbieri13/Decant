import "./backend.css";

import { useEffect, useState, useMemo } from "preact/hooks";

import { t } from "../../../services/i18n";
import server from "../../../services/server";
import toast from "../../../services/toast";
import Button from "../../react/Button";
import FormCheckbox from "../../react/FormCheckbox";
import FormGroup from "../../react/FormGroup";
import FormSelect from "../../react/FormSelect";
import FormText from "../../react/FormText";
import FormTextBox from "../../react/FormTextBox";
import OptionsSection from "./components/OptionsSection";

// Metadata structure from backend API
interface SettingMetadata {
    name: string;
    label: string;
    type: "string" | "number" | "boolean" | "select";
    category: string;
    description?: string;
    defaultValue?: string;
    options?: Array<{ value: string; label: string }>;
    validation?: {
        required?: boolean;
        min?: number;
        max?: number;
        pattern?: string;
    };
    requiresRestart?: boolean;
    requiresReload?: boolean;
}

// Response from GET /api/backend-settings/metadata
interface MetadataResponse {
    categories: string[];
    metadata: Record<string, SettingMetadata[]>;
}

// Response from GET /api/backend-settings/options
type OptionsResponse = Record<string, { value: string; metadata?: SettingMetadata }>;

interface SettingValue {
    value: string;
    isDirty: boolean;
    validationError?: string;
    metadata?: SettingMetadata;
}

type SettingsState = Record<string, SettingValue>;

type CategoryName = "general" | "appearance" | "editor" | "sync" | "security" | "ai";

const CATEGORY_ORDER: CategoryName[] = [
    "general",
    "appearance",
    "editor",
    "sync",
    "security",
    "ai"
];

const CATEGORY_LABELS: Record<CategoryName, string> = {
    general: "General",
    appearance: "Appearance",
    editor: "Editor",
    sync: "Sync",
    security: "Security",
    ai: "AI"
};

export default function BackendSettings() {
    const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
    const [currentValues, setCurrentValues] = useState<SettingsState>({});
    const [activeCategory, setActiveCategory] = useState<CategoryName>("general");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Load settings metadata and values on mount
    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        setIsLoading(true);
        try {
            // Load metadata and current values in parallel
            const [metadataData, optionsData] = await Promise.all([
                server.get<MetadataResponse>("backend-settings/metadata"),
                server.get<OptionsResponse>("backend-settings/options")
            ]);

            setMetadata(metadataData);

            // Initialize current values from options response
            const initialValues: SettingsState = {};
            for (const [optionName, optionData] of Object.entries(optionsData)) {
                initialValues[optionName] = {
                    value: optionData.value,
                    isDirty: false,
                    metadata: optionData.metadata
                };
            }
            setCurrentValues(initialValues);

            // Set first available category as active
            if (metadataData.categories.length > 0) {
                const firstCategory = CATEGORY_ORDER.find(cat =>
                    metadataData.categories.includes(cat)
                ) || metadataData.categories[0] as CategoryName;
                setActiveCategory(firstCategory);
            }
        } catch (error) {
            toast.showError(t("backend_settings.load_error"));
            console.error("Failed to load backend settings:", error);
        } finally {
            setIsLoading(false);
        }
    }

    // Get settings for the active category from metadata
    const categorySettings = useMemo(() => {
        if (!metadata) return [];
        return metadata.metadata[activeCategory] || [];
    }, [metadata, activeCategory]);

    // Check if any settings are dirty
    const hasDirtySettings = useMemo(() => {
        return Object.values(currentValues).some(v => v.isDirty);
    }, [currentValues]);

    // Check if restart/reload is needed based on dirty settings
    const requiresAction = useMemo(() => {
        let restart = false;
        let reload = false;

        Object.entries(currentValues).forEach(([_key, state]) => {
            if (!state.isDirty) return;
            if (state.metadata?.requiresRestart) restart = true;
            if (state.metadata?.requiresReload) reload = true;
        });

        return { restart, reload };
    }, [currentValues]);

    function updateSetting(name: string, value: string) {
        setCurrentValues(prev => {
            const current = prev[name];
            return {
                ...prev,
                [name]: {
                    ...current,
                    value,
                    isDirty: true,
                    validationError: validateSetting(name, value, current?.metadata)
                }
            };
        });
    }

    function validateSetting(_name: string, value: string, settingMetadata?: SettingMetadata): string | undefined {
        if (!settingMetadata?.validation) return undefined;

        const validation = settingMetadata.validation;

        if (settingMetadata.type === "number") {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return t("backend_settings.validation.number_required");
            }
            if (validation.min !== undefined && numValue < validation.min) {
                return t("backend_settings.validation.min", { min: validation.min });
            }
            if (validation.max !== undefined && numValue > validation.max) {
                return t("backend_settings.validation.max", { max: validation.max });
            }
        }

        if (validation.pattern) {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(value)) {
                return t("backend_settings.validation.pattern");
            }
        }

        if (validation.required && (!value || value.trim() === "")) {
            return t("backend_settings.validation.required");
        }

        return undefined;
    }

    async function saveSettings() {
        // Check for validation errors
        const hasErrors = Object.values(currentValues).some(v => v.validationError);
        if (hasErrors) {
            toast.showError(t("backend_settings.validation_errors"));
            return;
        }

        setIsSaving(true);
        try {
            // Build updates array for bulk-update endpoint
            const updates: Array<{ name: string; value: string }> = [];
            Object.entries(currentValues).forEach(([name, state]) => {
                if (state.isDirty) {
                    updates.push({ name, value: state.value });
                }
            });

            if (updates.length === 0) {
                toast.showMessage(t("backend_settings.no_changes"));
                return;
            }

            await server.post("backend-settings/bulk-update", { updates });

            // Mark all as clean
            setCurrentValues(prev => {
                const updated = { ...prev };
                Object.keys(updated).forEach(key => {
                    updated[key] = { ...updated[key], isDirty: false };
                });
                return updated;
            });

            toast.showMessage(t("backend_settings.saved"));

            // Show restart/reload warnings if needed
            if (requiresAction.restart) {
                toast.showMessage(t("backend_settings.restart_required"), 10000);
            } else if (requiresAction.reload) {
                toast.showMessage(t("backend_settings.reload_required"), 10000);
            }
        } catch (error) {
            toast.showError(t("backend_settings.save_error"));
            console.error("Failed to save backend settings:", error);
        } finally {
            setIsSaving(false);
        }
    }

    function renderControl(settingMeta: SettingMetadata) {
        const state = currentValues[settingMeta.name];
        const currentValue = state?.value ?? settingMeta.defaultValue ?? "";

        switch (settingMeta.type) {
            case "boolean":
                return (
                    <FormCheckbox
                        label={settingMeta.label}
                        currentValue={currentValue === "true"}
                        onChange={value => updateSetting(settingMeta.name, value ? "true" : "false")}
                    />
                );

            case "select":
                return (
                    <FormGroup name={settingMeta.name} label={settingMeta.label} description={settingMeta.description}>
                        <FormSelect
                            values={settingMeta.options || []}
                            currentValue={currentValue}
                            onChange={value => updateSetting(settingMeta.name, value)}
                            keyProperty="value"
                            titleProperty="label"
                        />
                    </FormGroup>
                );

            case "number":
                return (
                    <FormGroup
                        name={settingMeta.name}
                        label={settingMeta.label}
                        description={state?.validationError ? (
                            <span className="text-danger">{state.validationError}</span>
                        ) : settingMeta.description}
                    >
                        <FormTextBox
                            type="number"
                            currentValue={currentValue}
                            onChange={value => updateSetting(settingMeta.name, value)}
                            min={settingMeta.validation?.min}
                            max={settingMeta.validation?.max}
                        />
                    </FormGroup>
                );

            case "string":
            default:
                return (
                    <FormGroup
                        name={settingMeta.name}
                        label={settingMeta.label}
                        description={state?.validationError ? (
                            <span className="text-danger">{state.validationError}</span>
                        ) : settingMeta.description}
                    >
                        <FormTextBox
                            type="text"
                            currentValue={currentValue}
                            onChange={value => updateSetting(settingMeta.name, value)}
                        />
                    </FormGroup>
                );
        }
    }

    if (isLoading) {
        return (
            <div className="backend-settings-loading">
                <FormText>{t("backend_settings.loading")}</FormText>
            </div>
        );
    }

    if (!metadata) {
        return (
            <div className="backend-settings-error">
                <FormText>{t("backend_settings.load_failed")}</FormText>
                <Button text={t("backend_settings.retry")} onClick={loadSettings} />
            </div>
        );
    }

    const availableCategories = CATEGORY_ORDER.filter(cat =>
        metadata.categories.includes(cat)
    );

    return (
        <div className="backend-settings">
            {/* Category Tabs */}
            <div className="backend-settings-tabs">
                {availableCategories.map(category => (
                    <button
                        key={category}
                        className={`backend-settings-tab ${activeCategory === category ? "active" : ""}`}
                        onClick={() => setActiveCategory(category)}
                    >
                        {t(`backend_settings.category.${category}`) || CATEGORY_LABELS[category]}
                    </button>
                ))}
            </div>

            {/* Settings Content */}
            <div className="backend-settings-content">
                {categorySettings.length === 0 ? (
                    <FormText>{t("backend_settings.no_settings_in_category")}</FormText>
                ) : (
                    categorySettings.map(setting => (
                        <OptionsSection key={setting.name}>
                            {renderControl(setting)}
                        </OptionsSection>
                    ))
                )}
            </div>

            {/* Save Button */}
            {hasDirtySettings && (
                <div className="backend-settings-actions">
                    <Button
                        text={t("backend_settings.save")}
                        onClick={saveSettings}
                        disabled={isSaving}
                    />
                    {requiresAction.restart && (
                        <div className="backend-settings-warning">
                            <FormText>{t("backend_settings.restart_warning")}</FormText>
                        </div>
                    )}
                    {requiresAction.reload && (
                        <div className="backend-settings-warning">
                            <FormText>{t("backend_settings.reload_warning")}</FormText>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
