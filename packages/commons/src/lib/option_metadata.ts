/**
 * Settings metadata infrastructure for Trilium Notes.
 * Provides type definitions for option validation, UI rendering, and configuration.
 */

import type { OptionNames } from "./options_interface.js";

/**
 * Types of validation rules that can be applied to settings.
 */
export type ValidationRuleType = "range" | "pattern" | "enum" | "custom";

/**
 * Defines a validation rule for a setting value.
 */
export interface ValidationRule {
    /** The type of validation to perform. */
    type: ValidationRuleType;
    /** Minimum value for range validation. */
    min?: number;
    /** Maximum value for range validation. */
    max?: number;
    /** Regular expression pattern for pattern validation. */
    pattern?: string;
    /** Human-readable description of the pattern for error messages. */
    patternDescription?: string;
    /** List of allowed values for enum validation. */
    allowedValues?: string[];
    /** Name of a custom validator function to use. */
    validatorName?: string;
    /** Custom error message to display when validation fails. */
    errorMessage?: string;
}

/**
 * Types of UI controls that can be used to edit settings.
 */
export type ControlType =
    | "text"
    | "number"
    | "checkbox"
    | "select"
    | "textarea"
    | "time-selector"
    | "locale-selector"
    | "custom";

/**
 * Categories for organizing settings in the UI.
 */
export type SettingsCategory =
    | "appearance"
    | "editor"
    | "sync"
    | "backup"
    | "security"
    | "ai"
    | "advanced"
    | "system";

/**
 * Configuration options for UI controls.
 */
export interface ControlConfig {
    /** Options for select/dropdown controls. */
    options?: Array<{ value: string; label: string }>;
    /** Step increment for number inputs. */
    step?: number;
    /** Unit label to display (e.g., "px", "ms", "%"). */
    unit?: string;
    /** Number of rows for textarea controls. */
    rows?: number;
    /** Name of a custom component to render. */
    componentName?: string;
}

/**
 * Complete metadata definition for a single option/setting.
 */
export interface OptionMetadata {
    /** Internal option name (key in OptionDefinitions). */
    name: OptionNames;
    /** Human-readable display name for the UI. */
    displayName: string;
    /** Detailed description of what this setting does. */
    description?: string;
    /** Category for grouping in the settings UI. */
    category: SettingsCategory;
    /** Whether the setting can be edited by users. */
    isEditable: boolean;
    /** Whether the setting is synced across instances. */
    isSynced: boolean;
    /** Default value when not explicitly set. */
    defaultValue: string | number | boolean;
    /** Expected data type of the value. */
    dataType: "string" | "number" | "boolean";
    /** Type of UI control to render. */
    controlType: ControlType;
    /** Validation rules to apply. */
    validation?: ValidationRule[];
    /** Whether the value contains sensitive data (e.g., API keys). */
    isSensitive?: boolean;
    /** Whether changing this setting requires an application restart. */
    requiresRestart?: boolean;
    /** Whether changing this setting requires a page reload. */
    requiresReload?: boolean;
    /** Additional configuration for the UI control. */
    controlConfig?: ControlConfig;
    /** Names of related settings that may be affected. */
    relatedSettings?: OptionNames[];
    /** Order for display within the category (lower = first). */
    displayOrder?: number;
}

/**
 * A registry mapping option names to their metadata.
 */
export type OptionMetadataRegistry = Partial<Record<OptionNames, OptionMetadata>>;

/**
 * Represents a single validation error.
 */
export interface ValidationError {
    /** The field/option name that failed validation. */
    field: string;
    /** The validation rule that was violated. */
    rule: string;
    /** Human-readable error message. */
    message: string;
    /** The actual value that failed validation. */
    actualValue?: unknown;
}

/**
 * Result of validating one or more option values.
 */
export interface ValidationResult {
    /** Whether all validations passed. */
    isValid: boolean;
    /** List of validation errors (empty if isValid is true). */
    errors: ValidationError[];
}
