// ============================================================
// Environment Configuration
// Zod-validated configuration with type safety
// ============================================================

import { z } from 'zod';
import { log } from '../logger/index.js';

/**
 * Configuration schema with Zod validation
 * All environment variables are validated at startup
 */
const ConfigSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database Configuration
  DATABASE_PATH: z.string().optional(),

  // Rate Limiting Configuration
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(60000),
  RATE_LIMIT_MAX: z.coerce.number().min(1).default(100),
  RATE_LIMIT_IMPORT_MAX: z.coerce.number().min(1).default(10),
  RATE_LIMIT_SETTINGS_MAX: z.coerce.number().min(1).default(5),

  // CORS Configuration
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  // API Authentication
  // If set, all /api/* routes (except /api/health) require this token.
  // Send as: Authorization: Bearer <token>
  // For SSE (/api/events), token can also be provided via ?token=<token>
  DECANT_ACCESS_TOKEN: z.string().min(16).optional(),

  // Security Configuration
  DECANT_MASTER_KEY: z.string().min(32).optional(),

  // OpenAI Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // Apify Configuration (for Twitter/X scraping)
  APIFY_API_KEY: z.string().optional(),

  // Logging Configuration
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
  LOG_FORMAT: z.enum(['json', 'pretty']).optional(),

  // Scraper Configuration
  SCRAPER_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(30000),
  SCRAPER_MAX_SIZE_BYTES: z.coerce.number().min(1024).default(5 * 1024 * 1024), // 5MB default
});

/**
 * Inferred TypeScript type from schema
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Validate environment variables and return typed config
 * Exits process with error message if validation fails
 */
function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n========================================');
    console.error('CONFIGURATION ERROR');
    console.error('========================================\n');
    console.error('Failed to validate environment configuration:\n');

    // Format each error nicely
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'unknown';
      console.error(`  - ${path}: ${issue.message}`);

      // Add helpful hints for common issues
      if (path === 'DECANT_MASTER_KEY' && issue.code === 'too_small') {
        console.error('    Hint: DECANT_MASTER_KEY must be at least 32 characters');
        console.error('    Generate one with: openssl rand -base64 32');
      }
      if (path === 'PORT' && issue.code === 'invalid_type') {
        console.error('    Hint: PORT must be a valid number between 1-65535');
      }
    }

    console.error('\n========================================');
    console.error('Please check your .env file or environment variables');
    console.error('See .env.example for reference');
    console.error('========================================\n');

    process.exit(1);
  }

  return result.data;
}

/**
 * Validated configuration object
 * Access environment variables through this typed object
 */
export const config = loadConfig();

/**
 * Log configuration summary (safe values only)
 */
export function logConfigSummary(): void {
  log.info('Configuration loaded', {
    port: config.PORT,
    nodeEnv: config.NODE_ENV,
    logLevel: config.LOG_LEVEL,
    databasePath: config.DATABASE_PATH || 'default',
    rateLimitMax: config.RATE_LIMIT_MAX,
    rateLimitImportMax: config.RATE_LIMIT_IMPORT_MAX,
    hasAccessToken: !!config.DECANT_ACCESS_TOKEN,
    hasOpenAIKey: !!config.OPENAI_API_KEY,
    openAIModel: config.OPENAI_MODEL,
    hasMasterKey: !!config.DECANT_MASTER_KEY,
    scraperTimeout: config.SCRAPER_TIMEOUT_MS,
    scraperMaxSize: config.SCRAPER_MAX_SIZE_BYTES,
  });
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return config.NODE_ENV === 'development';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return config.NODE_ENV === 'test';
}

/**
 * Get CORS origins as array (if configured)
 */
export function getCorsOrigins(): string[] | undefined {
  if (!config.CORS_ALLOWED_ORIGINS) {
    return undefined;
  }
  return config.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
}

export default config;
