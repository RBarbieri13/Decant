/**
 * @module
 *
 * Option validation service for Trilium Notes settings.
 * Validates option values against metadata-defined validation rules.
 *
 * Supports multiple validation types:
 * - `range` - numeric min/max validation
 * - `pattern` - regex pattern validation
 * - `enum` - allowed values list validation
 * - `custom` - named custom validators
 */

import type {
    OptionNames,
    ValidationRule,
    ValidationResult,
    ValidationError,
    OptionMetadata,
    OptionMetadataRegistry
} from "@triliumnext/commons";

/**
 * Custom validator function signature.
 * Returns null if valid, or an error message if invalid.
 */
export type CustomValidator = (value: string, optionName: string) => Promise<string | null> | string | null;

/**
 * Registry of custom validators by name.
 */
const customValidators: Map<string, CustomValidator> = new Map();

/**
 * Option metadata registry - maps option names to their metadata.
 * This should be populated by the option_metadata_registry service.
 */
let metadataRegistry: OptionMetadataRegistry = {};

/**
 * Sets the metadata registry to use for validation.
 * @param registry - The registry mapping option names to their metadata.
 */
function setMetadataRegistry(registry: OptionMetadataRegistry): void {
    metadataRegistry = registry;
}

/**
 * Gets the current metadata registry.
 */
function getMetadataRegistry(): OptionMetadataRegistry {
    return metadataRegistry;
}

/**
 * Registers a custom validator function.
 * @param name - The validator name (referenced in ValidationRule.validatorName).
 * @param validator - The validator function.
 */
function registerCustomValidator(name: string, validator: CustomValidator): void {
    customValidators.set(name, validator);
}

/**
 * Unregisters a custom validator.
 * @param name - The validator name to remove.
 */
function unregisterCustomValidator(name: string): void {
    customValidators.delete(name);
}

/**
 * Gets a registered custom validator by name.
 * @param name - The validator name.
 * @returns The validator function, or undefined if not found.
 */
function getCustomValidator(name: string): CustomValidator | undefined {
    return customValidators.get(name);
}

/**
 * Validates a value against a range rule.
 */
function validateRange(value: string, rule: ValidationRule, optionName: string): ValidationError | null {
    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
        return {
            field: optionName,
            rule: "range",
            message: rule.errorMessage || `Value must be a number`,
            actualValue: value
        };
    }

    if (rule.min !== undefined && numValue < rule.min) {
        return {
            field: optionName,
            rule: "range",
            message: rule.errorMessage || `Value must be at least ${rule.min}`,
            actualValue: numValue
        };
    }

    if (rule.max !== undefined && numValue > rule.max) {
        return {
            field: optionName,
            rule: "range",
            message: rule.errorMessage || `Value must be at most ${rule.max}`,
            actualValue: numValue
        };
    }

    return null;
}

/**
 * Validates a value against a pattern rule.
 */
function validatePattern(value: string, rule: ValidationRule, optionName: string): ValidationError | null {
    if (!rule.pattern) {
        return null;
    }

    try {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(value)) {
            return {
                field: optionName,
                rule: "pattern",
                message: rule.errorMessage || rule.patternDescription || `Value does not match required pattern`,
                actualValue: value
            };
        }
    } catch (e) {
        // Invalid regex pattern in rule definition
        return {
            field: optionName,
            rule: "pattern",
            message: `Invalid pattern configuration: ${rule.pattern}`,
            actualValue: value
        };
    }

    return null;
}

/**
 * Validates a value against an enum rule.
 */
function validateEnum(value: string, rule: ValidationRule, optionName: string): ValidationError | null {
    if (!rule.allowedValues || rule.allowedValues.length === 0) {
        return null;
    }

    if (!rule.allowedValues.includes(value)) {
        return {
            field: optionName,
            rule: "enum",
            message: rule.errorMessage || `Value must be one of: ${rule.allowedValues.join(", ")}`,
            actualValue: value
        };
    }

    return null;
}

/**
 * Validates a value against a custom validator.
 */
async function validateCustom(value: string, rule: ValidationRule, optionName: string): Promise<ValidationError | null> {
    if (!rule.validatorName) {
        return null;
    }

    const validator = customValidators.get(rule.validatorName);
    if (!validator) {
        return {
            field: optionName,
            rule: "custom",
            message: `Custom validator '${rule.validatorName}' not found`,
            actualValue: value
        };
    }

    try {
        const errorMessage = await validator(value, optionName);
        if (errorMessage) {
            return {
                field: optionName,
                rule: "custom",
                message: rule.errorMessage || errorMessage,
                actualValue: value
            };
        }
    } catch (e) {
        return {
            field: optionName,
            rule: "custom",
            message: `Validator error: ${e instanceof Error ? e.message : "Unknown error"}`,
            actualValue: value
        };
    }

    return null;
}

/**
 * Validates a single rule against a value.
 */
async function validateRule(value: string, rule: ValidationRule, optionName: string): Promise<ValidationError | null> {
    switch (rule.type) {
        case "range":
            return validateRange(value, rule, optionName);
        case "pattern":
            return validatePattern(value, rule, optionName);
        case "enum":
            return validateEnum(value, rule, optionName);
        case "custom":
            return await validateCustom(value, rule, optionName);
        default:
            return null;
    }
}

/**
 * Validates a single option value against its metadata rules.
 * @param optionName - The name of the option to validate.
 * @param value - The value to validate.
 * @returns A ValidationResult indicating success or failure with errors.
 */
async function validateOption(optionName: string, value: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    const metadata = metadataRegistry[optionName as OptionNames];
    if (!metadata || !metadata.validation || metadata.validation.length === 0) {
        // No validation rules defined - consider valid
        return { isValid: true, errors: [] };
    }

    for (const rule of metadata.validation) {
        const error = await validateRule(value, rule, optionName);
        if (error) {
            errors.push(error);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates multiple option values against their metadata rules.
 * @param options - A record of option names to values.
 * @returns A record of option names to their ValidationResult.
 */
async function validateOptions(options: Record<string, string>): Promise<Record<string, ValidationResult>> {
    const results: Record<string, ValidationResult> = {};

    const validationPromises = Object.entries(options).map(async ([name, value]) => {
        results[name] = await validateOption(name, value);
    });

    await Promise.all(validationPromises);

    return results;
}

/**
 * Validates option values and returns a combined result.
 * @param options - A record of option names to values.
 * @returns A single ValidationResult combining all validation errors.
 */
async function validateOptionsAggregate(options: Record<string, string>): Promise<ValidationResult> {
    const individualResults = await validateOptions(options);
    const allErrors: ValidationError[] = [];

    for (const result of Object.values(individualResults)) {
        allErrors.push(...result.errors);
    }

    return {
        isValid: allErrors.length === 0,
        errors: allErrors
    };
}

/**
 * Validates a value against explicit validation rules (without using the registry).
 * Useful for ad-hoc validation or testing.
 * @param value - The value to validate.
 * @param rules - The validation rules to apply.
 * @param optionName - The option name (used for error messages).
 * @returns A ValidationResult indicating success or failure.
 */
async function validateWithRules(
    value: string,
    rules: ValidationRule[],
    optionName: string = "value"
): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
        const error = await validateRule(value, rule, optionName);
        if (error) {
            errors.push(error);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// ============================================================================
// Built-in Custom Validators
// ============================================================================

/**
 * Validates a URL format.
 * Accepts http:// and https:// URLs.
 */
const syncServerUrlValidator: CustomValidator = (value: string): string | null => {
    if (!value || value.trim() === "") {
        // Empty is allowed - sync server is optional
        return null;
    }

    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return "URL must use http:// or https:// protocol";
        }
        return null;
    } catch {
        return "Invalid URL format";
    }
};

/**
 * Validates a port number (1-65535).
 */
const portNumberValidator: CustomValidator = (value: string): string | null => {
    const port = parseInt(value, 10);

    if (isNaN(port)) {
        return "Port must be a number";
    }

    if (port < 1 || port > 65535) {
        return "Port must be between 1 and 65535";
    }

    return null;
};

/**
 * Validates an API key format (non-empty string with minimum length).
 */
const apiKeyValidator: CustomValidator = (value: string): string | null => {
    if (!value || value.trim() === "") {
        // Empty is allowed - makes the provider unavailable
        return null;
    }

    if (value.trim().length < 10) {
        return "API key seems too short";
    }

    return null;
};

/**
 * Validates a locale code format (e.g., "en", "en-US", "zh-CN").
 */
const localeValidator: CustomValidator = (value: string): string | null => {
    if (!value || value.trim() === "") {
        return "Locale is required";
    }

    // Basic locale pattern: 2-3 letter language code, optional region
    const localePattern = /^[a-z]{2,3}(-[A-Z]{2})?$/;
    if (!localePattern.test(value)) {
        return "Invalid locale format (e.g., 'en', 'en-US', 'zh-CN')";
    }

    return null;
};

// Register built-in validators
registerCustomValidator("syncServerUrl", syncServerUrlValidator);
registerCustomValidator("portNumber", portNumberValidator);
registerCustomValidator("apiKey", apiKeyValidator);
registerCustomValidator("locale", localeValidator);

export default {
    validateOption,
    validateOptions,
    validateOptionsAggregate,
    validateWithRules,
    registerCustomValidator,
    unregisterCustomValidator,
    getCustomValidator,
    setMetadataRegistry,
    getMetadataRegistry
};
