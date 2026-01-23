import type { OptionNames } from "@triliumnext/commons";
import type { Request } from "express";

import ValidationError from "../../errors/validation_error.js";
import config from "../../services/config.js";
import log from "../../services/log.js";
import optionService from "../../services/options.js";
import optionAudit from "../../services/option_audit.js";
import optionValidation from "../../services/option_validation.js";

// Sensitive option name patterns - values should be redacted in logs
const SENSITIVE_OPTION_PATTERNS = [
    /key/i,
    /password/i,
    /secret/i,
    /token/i,
    /credential/i
];

/**
 * Masks a value if the option name indicates it's sensitive.
 * @param optionName - The name of the option
 * @param value - The value to potentially mask
 * @returns The original value or "***REDACTED***" if sensitive
 */
function maskSensitiveValue(optionName: string, value: string): string {
    const isSensitive = SENSITIVE_OPTION_PATTERNS.some(pattern => pattern.test(optionName));
    return isSensitive ? "***REDACTED***" : value;
}

// Settings metadata structure
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
}

// Settings categories with their metadata
const SETTINGS_METADATA: Record<string, SettingMetadata[]> = {
    general: [
        {
            name: "locale",
            label: "Language",
            type: "select",
            category: "general",
            description: "Application language"
        },
        {
            name: "theme",
            label: "Theme",
            type: "select",
            category: "general",
            description: "Application theme"
        },
        {
            name: "zoomFactor",
            label: "Zoom Factor",
            type: "number",
            category: "general",
            description: "UI zoom level",
            validation: { min: 0.5, max: 2.0 }
        }
    ],
    editor: [
        {
            name: "textNoteEditorType",
            label: "Text Editor Type",
            type: "select",
            category: "editor",
            description: "Default text note editor"
        },
        {
            name: "codeLineWrapEnabled",
            label: "Code Line Wrap",
            type: "boolean",
            category: "editor",
            description: "Enable line wrapping in code editor"
        },
        {
            name: "vimKeymapEnabled",
            label: "Vim Keymap",
            type: "boolean",
            category: "editor",
            description: "Enable Vim keyboard shortcuts"
        }
    ],
    sync: [
        {
            name: "syncServerHost",
            label: "Sync Server Host",
            type: "string",
            category: "sync",
            description: "Sync server URL"
        },
        {
            name: "syncServerTimeout",
            label: "Sync Server Timeout",
            type: "number",
            category: "sync",
            description: "Timeout in seconds",
            validation: { min: 5, max: 300 }
        }
    ],
    security: [
        {
            name: "protectedSessionTimeout",
            label: "Protected Session Timeout",
            type: "number",
            category: "security",
            description: "Protected session timeout value"
        },
        {
            name: "protectedSessionTimeoutTimeScale",
            label: "Protected Session Timeout Scale",
            type: "select",
            category: "security",
            description: "Time scale for protected session timeout",
            options: [
                { value: "seconds", label: "Seconds" },
                { value: "minutes", label: "Minutes" },
                { value: "hours", label: "Hours" }
            ]
        }
    ],
    appearance: [
        {
            name: "mainFontSize",
            label: "Main Font Size",
            type: "number",
            category: "appearance",
            description: "Main UI font size in pixels",
            validation: { min: 8, max: 32 }
        },
        {
            name: "mainFontFamily",
            label: "Main Font Family",
            type: "string",
            category: "appearance",
            description: "Main UI font family"
        },
        {
            name: "treeFontSize",
            label: "Tree Font Size",
            type: "number",
            category: "appearance",
            description: "Tree view font size in pixels",
            validation: { min: 8, max: 32 }
        }
    ],
    ai: [
        {
            name: "aiEnabled",
            label: "AI Features Enabled",
            type: "boolean",
            category: "ai",
            description: "Enable AI/LLM features"
        },
        {
            name: "aiSelectedProvider",
            label: "AI Provider",
            type: "select",
            category: "ai",
            description: "Selected AI provider",
            options: [
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Anthropic" },
                { value: "ollama", label: "Ollama" }
            ]
        },
        {
            name: "aiTemperature",
            label: "AI Temperature",
            type: "number",
            category: "ai",
            description: "AI response creativity (0.0-2.0)",
            validation: { min: 0.0, max: 2.0 }
        }
    ]
};

// Options allowed to be updated via backend settings API
const ALLOWED_OPTIONS = new Set<OptionNames>([
    "eraseEntitiesAfterTimeInSeconds",
    "eraseEntitiesAfterTimeScale",
    "protectedSessionTimeout",
    "protectedSessionTimeoutTimeScale",
    "revisionSnapshotTimeInterval",
    "revisionSnapshotTimeIntervalTimeScale",
    "revisionSnapshotNumberLimit",
    "zoomFactor",
    "theme",
    "codeBlockTheme",
    "codeBlockWordWrap",
    "codeNoteTheme",
    "syncServerHost",
    "syncServerTimeout",
    "syncProxy",
    "hoistedNoteId",
    "mainFontSize",
    "mainFontFamily",
    "treeFontSize",
    "treeFontFamily",
    "detailFontSize",
    "detailFontFamily",
    "monospaceFontSize",
    "monospaceFontFamily",
    "vimKeymapEnabled",
    "codeLineWrapEnabled",
    "spellCheckEnabled",
    "spellCheckLanguageCode",
    "imageMaxWidthHeight",
    "imageJpegQuality",
    "headingStyle",
    "autoCollapseNoteTree",
    "autoReadonlySizeText",
    "customDateTimeFormat",
    "autoReadonlySizeCode",
    "overrideThemeFonts",
    "dailyBackupEnabled",
    "weeklyBackupEnabled",
    "monthlyBackupEnabled",
    "motionEnabled",
    "shadowsEnabled",
    "smoothScrollEnabled",
    "backdropEffectsEnabled",
    "maxContentWidth",
    "centerContent",
    "compressImages",
    "downloadImagesAutomatically",
    "minTocHeadings",
    "highlightsList",
    "checkForUpdates",
    "disableTray",
    "eraseUnusedAttachmentsAfterSeconds",
    "eraseUnusedAttachmentsAfterTimeScale",
    "customSearchEngineName",
    "customSearchEngineUrl",
    "editedNotesOpenInRibbon",
    "locale",
    "formattingLocale",
    "firstDayOfWeek",
    "firstWeekOfYear",
    "minDaysInFirstWeek",
    "languages",
    "textNoteEditorType",
    "textNoteEditorMultilineToolbar",
    "textNoteEmojiCompletionEnabled",
    "textNoteCompletionEnabled",
    "textNoteSlashCommandsEnabled",
    "layoutOrientation",
    "backgroundEffects",
    "allowedHtmlTags",
    "splitEditorOrientation",
    "experimentalFeatures",
    "newLayout",
    "aiEnabled",
    "aiTemperature",
    "aiSystemPrompt",
    "aiSelectedProvider",
    "openaiApiKey",
    "openaiBaseUrl",
    "openaiDefaultModel",
    "anthropicApiKey",
    "anthropicBaseUrl",
    "anthropicDefaultModel",
    "ollamaBaseUrl",
    "ollamaDefaultModel",
    "mfaEnabled",
    "mfaMethod"
]);

interface OptionUpdate {
    name: string;
    value: string;
}

interface BulkUpdateRequest {
    updates: OptionUpdate[];
}

interface ValidationResult {
    valid: boolean;
    errors: Record<string, string>;
}

// GET /api/backend-settings/metadata
// Returns settings metadata by category
function getMetadata(req: Request) {
    const category = req.query.category as string | undefined;

    if (category && SETTINGS_METADATA[category]) {
        return {
            category,
            settings: SETTINGS_METADATA[category]
        };
    }

    return {
        categories: Object.keys(SETTINGS_METADATA),
        metadata: SETTINGS_METADATA
    };
}

// GET /api/backend-settings/options
// Returns all backend settings with current values and metadata
function getOptions() {
    const optionMap = optionService.getOptionMap();
    const resultMap: Record<string, { value: string; metadata?: SettingMetadata }> = {};

    for (const optionName in optionMap) {
        if (isAllowed(optionName)) {
            const metadata = findMetadata(optionName);
            resultMap[optionName] = {
                value: optionMap[optionName as OptionNames],
                metadata
            };
        }
    }

    // Add database readonly flag if applicable
    if (config.General.readOnly) {
        resultMap["databaseReadonly"] = {
            value: "true"
        };
    }

    return resultMap;
}

// PUT /api/backend-settings/option/:name
// Updates a single setting with validation
async function updateOption(req: Request) {
    const { name } = req.params;
    const { value } = req.body;

    if (!isAllowed(name)) {
        throw new ValidationError(`Option '${name}' is not allowed to be changed`);
    }

    // Use the validation service for options with metadata registry rules
    const serviceValidation = await optionValidation.validateOption(name, value);
    if (!serviceValidation.isValid) {
        const errorMessage = serviceValidation.errors.map(e => e.message).join(", ");
        throw new ValidationError(errorMessage || "Validation failed");
    }

    // Fall back to local validation for options without registry rules
    const localValidation = validateOptionLocal(name, value);
    if (!localValidation.valid) {
        throw new ValidationError(localValidation.errors[name] || "Validation failed");
    }

    // Get old value for audit logging
    const oldValue = optionService.getOption(name as OptionNames);

    // Log with masked sensitive values
    const maskedValue = maskSensitiveValue(name, value);
    log.info(`Updating backend setting '${name}' to '${maskedValue}'`);

    optionService.setOption(name as OptionNames, value);

    // Log the change to audit trail
    optionAudit.logOptionChange(
        name,
        oldValue,
        value,
        oldValue === null ? 'create' : 'update',
        {
            ipAddress: req.ip
        }
    );

    return {
        success: true,
        name,
        value
    };
}

// POST /api/backend-settings/validate
// Validates options without saving
function validateOptions(req: Request) {
    const options = req.body.options as Record<string, string>;
    const result: ValidationResult = {
        valid: true,
        errors: {}
    };

    for (const name in options) {
        const validation = validateOptionLocal(name, options[name]);
        if (!validation.valid) {
            result.valid = false;
            result.errors[name] = validation.errors[name] || "Validation failed";
        }
    }

    return result;
}

// POST /api/backend-settings/bulk-update
// Updates multiple settings atomically
function bulkUpdate(req: Request) {
    const { updates } = req.body as BulkUpdateRequest;

    if (!Array.isArray(updates)) {
        throw new ValidationError("Updates must be an array");
    }

    // Validate all updates first
    const validationErrors: Record<string, string> = {};
    for (const update of updates) {
        if (!isAllowed(update.name)) {
            validationErrors[update.name] = "Not allowed to be changed";
            continue;
        }

        const validation = validateOption(update.name, update.value);
        if (!validation.valid) {
            validationErrors[update.name] = validation.errors[update.name] || "Validation failed";
        }
    }

    if (Object.keys(validationErrors).length > 0) {
        throw new ValidationError(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }

    // Apply all updates
    const results: Array<{ name: string; value: string; success: boolean }> = [];
    for (const update of updates) {
        try {
            const oldValue = optionService.getOption(update.name as OptionNames);
            const maskedValue = maskSensitiveValue(update.name, update.value);
            log.info(`Bulk updating backend setting '${update.name}' to '${maskedValue}'`);
            optionService.setOption(update.name as OptionNames, update.value);

            // Log to audit trail
            optionAudit.logOptionChange(
                update.name,
                oldValue,
                update.value,
                oldValue === null ? 'create' : 'update',
                { ipAddress: req.ip }
            );

            results.push({
                name: update.name,
                value: update.value,
                success: true
            });
        } catch (error) {
            log.error(`Failed to update setting '${update.name}': ${error}`);
            results.push({
                name: update.name,
                value: update.value,
                success: false
            });
        }
    }

    return {
        success: results.every(r => r.success),
        results
    };
}

// GET /api/backend-settings/export
// Exports settings as JSON
function exportSettings() {
    const optionMap = optionService.getOptionMap();
    const exportData: Record<string, string> = {};

    for (const optionName in optionMap) {
        if (isAllowed(optionName)) {
            exportData[optionName] = optionMap[optionName as OptionNames];
        }
    }

    return {
        version: "1.0",
        exportDate: new Date().toISOString(),
        settings: exportData
    };
}

// POST /api/backend-settings/import
// Imports settings from JSON
function importSettings(req: Request) {
    const { settings } = req.body;

    if (!settings || typeof settings !== "object") {
        throw new ValidationError("Invalid import data: settings must be an object");
    }

    // Validate all settings first
    const validationErrors: Record<string, string> = {};
    for (const name in settings) {
        if (!isAllowed(name)) {
            validationErrors[name] = "Not allowed to be changed";
            continue;
        }

        const validation = validateOption(name, settings[name]);
        if (!validation.valid) {
            validationErrors[name] = validation.errors[name] || "Validation failed";
        }
    }

    if (Object.keys(validationErrors).length > 0) {
        throw new ValidationError(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }

    // Apply all settings
    const results: Array<{ name: string; value: string; success: boolean }> = [];
    for (const name in settings) {
        try {
            const oldValue = optionService.getOption(name as OptionNames);
            const maskedValue = maskSensitiveValue(name, settings[name]);
            log.info(`Importing backend setting '${name}' with value '${maskedValue}'`);
            optionService.setOption(name as OptionNames, settings[name]);

            // Log to audit trail
            optionAudit.logOptionChange(
                name,
                oldValue,
                settings[name],
                oldValue === null ? 'create' : 'update',
                {
                    ipAddress: req.ip,
                    changeReason: 'Imported from settings backup'
                }
            );

            results.push({
                name,
                value: settings[name],
                success: true
            });
        } catch (error) {
            log.error(`Failed to import setting '${name}': ${error}`);
            results.push({
                name,
                value: settings[name],
                success: false
            });
        }
    }

    return {
        success: results.every(r => r.success),
        imported: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
    };
}

// GET /api/backend-settings/audit-log
// Returns audit log entries from the audit service
function getAuditLog(req: Request) {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const optionName = req.query.optionName as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const changeType = req.query.changeType as 'create' | 'update' | 'delete' | undefined;

    const result = optionAudit.getAuditLog({
        optionName,
        startDate,
        endDate,
        changeType,
        limit,
        offset
    });

    return result;
}

// Helper function to check if option is allowed
function isAllowed(name: string): boolean {
    return (ALLOWED_OPTIONS as Set<string>).has(name)
        || name.startsWith("keyboardShortcuts")
        || name.endsWith("Collapsed")
        || name.startsWith("hideArchivedNotes");
}

// Helper function to find metadata for an option
function findMetadata(optionName: string): SettingMetadata | undefined {
    for (const category in SETTINGS_METADATA) {
        const metadata = SETTINGS_METADATA[category].find(m => m.name === optionName);
        if (metadata) {
            return metadata;
        }
    }
    return undefined;
}

// Helper function to validate a single option using local metadata
function validateOptionLocal(name: string, value: string): ValidationResult {
    const result: ValidationResult = {
        valid: true,
        errors: {}
    };

    const metadata = findMetadata(name);
    if (!metadata) {
        // No metadata means no specific validation rules
        return result;
    }

    const validation = metadata.validation;
    if (!validation) {
        return result;
    }

    // Type-specific validation
    if (metadata.type === "number") {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            result.valid = false;
            result.errors[name] = "Value must be a number";
            return result;
        }

        if (validation.min !== undefined && numValue < validation.min) {
            result.valid = false;
            result.errors[name] = `Value must be at least ${validation.min}`;
            return result;
        }

        if (validation.max !== undefined && numValue > validation.max) {
            result.valid = false;
            result.errors[name] = `Value must be at most ${validation.max}`;
            return result;
        }
    }

    if (metadata.type === "boolean") {
        if (value !== "true" && value !== "false") {
            result.valid = false;
            result.errors[name] = "Value must be 'true' or 'false'";
            return result;
        }
    }

    if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
            result.valid = false;
            result.errors[name] = "Value does not match required pattern";
            return result;
        }
    }

    if (validation.required && (!value || value.trim() === "")) {
        result.valid = false;
        result.errors[name] = "Value is required";
        return result;
    }

    return result;
}

export default {
    getMetadata,
    getOptions,
    updateOption,
    validateOptions,
    bulkUpdate,
    exportSettings,
    importSettings,
    getAuditLog
};
