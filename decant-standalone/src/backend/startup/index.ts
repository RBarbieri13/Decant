// ============================================================
// Startup Validation Module
// Validates environment, database, LLM connectivity, and disk space
// before server initialization
// ============================================================

import fs from 'fs';
import path from 'path';
import os from 'os';
import { config } from '../config/index.js';
import { log } from '../logger/index.js';
import { getDatabasePath, getDatabase } from '../database/connection.js';
import { getMigrationStatus, getPendingMigrations, runPendingMigrations } from '../database/migrations/index.js';
import { createProvider, type LLMProvider } from '../services/llm/provider.js';

// ============================================================
// Types and Interfaces
// ============================================================

export interface EnvironmentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variables: {
    PORT: number;
    NODE_ENV: string;
    LOG_LEVEL: string;
    DATABASE_PATH: string;
    hasOpenAIKey: boolean;
    hasMasterKey: boolean;
  };
}

export interface LLMConnectivityResult {
  available: boolean;
  provider: 'openai' | null;
  model: string | null;
  error: string | null;
}

export interface DatabaseMigrationResult {
  ready: boolean;
  pendingCount: number;
  pendingMigrations: string[];
  appliedCount: number;
  errors: string[];
  warnings: string[];
}

export interface DiskSpaceResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    path: string;
    freeBytes: number;
    freeGB: number;
  };
}

export interface StartupFeatures {
  aiClassification: boolean;
  aiEnrichment: boolean;
  backgroundQueue: boolean;
  encryption: boolean;
}

export interface StartupValidationResult {
  canStart: boolean;
  warnings: string[];
  errors: string[];
  features: StartupFeatures;
  details: {
    environment: EnvironmentValidationResult;
    llm: LLMConnectivityResult;
    database: DatabaseMigrationResult;
    diskSpace: DiskSpaceResult;
  };
}

// ============================================================
// Environment Variable Validation
// ============================================================

/**
 * Validate environment variables and configuration
 * This runs after config.ts has already validated with Zod
 */
export function validateEnvironment(): EnvironmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate PORT
  if (config.PORT < 1 || config.PORT > 65535) {
    errors.push(`Invalid PORT: ${config.PORT} (must be between 1-65535)`);
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(config.NODE_ENV)) {
    errors.push(`Invalid NODE_ENV: ${config.NODE_ENV} (must be one of: ${validEnvs.join(', ')})`);
  }

  // Warn if no LLM API key is configured
  if (!config.OPENAI_API_KEY) {
    warnings.push('No OPENAI_API_KEY configured - AI features will be disabled');
  }

  // Warn if no master key is configured (encryption disabled)
  if (!config.DECANT_MASTER_KEY) {
    warnings.push('No DECANT_MASTER_KEY configured - encryption features disabled');
  }

  // Production-specific warnings
  if (config.NODE_ENV === 'production') {
    if (config.LOG_LEVEL === 'debug' || config.LOG_LEVEL === 'trace') {
      warnings.push(`Log level '${config.LOG_LEVEL}' may generate excessive logs in production`);
    }
    if (!config.DECANT_MASTER_KEY) {
      warnings.push('Running in production without DECANT_MASTER_KEY - consider enabling encryption');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    variables: {
      PORT: config.PORT,
      NODE_ENV: config.NODE_ENV,
      LOG_LEVEL: config.LOG_LEVEL,
      DATABASE_PATH: config.DATABASE_PATH || 'default',
      hasOpenAIKey: !!config.OPENAI_API_KEY,
      hasMasterKey: !!config.DECANT_MASTER_KEY,
    },
  };
}

// ============================================================
// LLM Connectivity Check
// ============================================================

/**
 * Test LLM connectivity with a lightweight request
 * This is non-blocking - if it fails, we just disable AI features
 */
export async function checkLLMConnectivity(): Promise<LLMConnectivityResult> {
  // If no API key, skip check
  if (!config.OPENAI_API_KEY) {
    return {
      available: false,
      provider: null,
      model: null,
      error: 'No API key configured',
    };
  }

  try {
    // Create a provider instance (don't use singleton yet)
    const provider = createProvider({
      type: 'openai',
      apiKey: config.OPENAI_API_KEY,
      model: config.OPENAI_MODEL,
      retryOptions: {
        maxAttempts: 2,
        initialDelayMs: 500,
        maxDelayMs: 2000,
      },
    });

    // Make a minimal test request (single token response)
    const result = await provider.complete(
      [
        {
          role: 'user',
          content: 'Respond with only the word "ok"',
        },
      ],
      {
        maxTokens: 10,
        temperature: 0,
      }
    );

    return {
      available: true,
      provider: 'openai',
      model: result.model,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      provider: null,
      model: null,
      error: errorMessage,
    };
  }
}

// ============================================================
// Database Migration Status
// ============================================================

/**
 * Check database migration status
 * Returns pending migrations and any issues
 */
export function checkDatabaseMigrations(): DatabaseMigrationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const db = getDatabase();
    const status = getMigrationStatus(db);
    const pending = getPendingMigrations(db);

    const appliedCount = status.filter(m => m.applied).length;
    const pendingCount = pending.length;

    if (pendingCount > 0) {
      warnings.push(
        `${pendingCount} pending database migration(s): ${pending.map(m => m.name).join(', ')}`
      );
    }

    return {
      ready: true,
      pendingCount,
      pendingMigrations: pending.map(m => m.name),
      appliedCount,
      errors,
      warnings,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to check database migrations: ${errorMessage}`);

    return {
      ready: false,
      pendingCount: 0,
      pendingMigrations: [],
      appliedCount: 0,
      errors,
      warnings,
    };
  }
}

/**
 * Auto-run pending migrations if configured to do so
 */
export function runPendingMigrationsIfNeeded(): string[] {
  const db = getDatabase();
  return runPendingMigrations(db);
}

// ============================================================
// Disk Space Check
// ============================================================

/**
 * Check available disk space for the database directory
 */
export function checkDiskSpace(): DiskSpaceResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const dbPath = getDatabasePath();
  const dataDir = path.dirname(dbPath);

  // Check if directory exists and is writable
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Test write access
    const testFile = path.join(dataDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Database directory not writable: ${errorMessage}`);
    return {
      ok: false,
      errors,
      warnings,
      stats: {
        path: dataDir,
        freeBytes: 0,
        freeGB: 0,
      },
    };
  }

  // Check available disk space (platform-specific)
  try {
    // Get disk space using Node.js built-in APIs (works on all platforms)
    const stats = fs.statfsSync ? fs.statfsSync(dataDir) : null;

    if (stats) {
      const freeBytes = stats.bsize * stats.bavail;
      const freeGB = freeBytes / (1024 * 1024 * 1024);

      // Thresholds
      const MIN_SPACE_BYTES = 100 * 1024 * 1024; // 100MB
      const WARN_SPACE_BYTES = 1024 * 1024 * 1024; // 1GB

      if (freeBytes < MIN_SPACE_BYTES) {
        errors.push(
          `Critically low disk space: ${freeGB.toFixed(2)}GB available (minimum 100MB required)`
        );
      } else if (freeBytes < WARN_SPACE_BYTES) {
        warnings.push(
          `Low disk space: ${freeGB.toFixed(2)}GB available (recommended: > 1GB)`
        );
      }

      return {
        ok: errors.length === 0,
        errors,
        warnings,
        stats: {
          path: dataDir,
          freeBytes,
          freeGB,
        },
      };
    }
  } catch (error) {
    // If we can't check disk space, just warn
    warnings.push('Unable to check disk space (platform limitation)');
  }

  // Fallback if disk space check not available
  return {
    ok: true,
    errors,
    warnings,
    stats: {
      path: dataDir,
      freeBytes: 0,
      freeGB: 0,
    },
  };
}

// ============================================================
// Main Startup Validation
// ============================================================

/**
 * Run all startup validations
 */
export async function validateStartup(): Promise<StartupValidationResult> {
  const allWarnings: string[] = [];
  const allErrors: string[] = [];

  // 1. Validate environment
  log.info('Validating environment configuration...');
  const envResult = validateEnvironment();
  allWarnings.push(...envResult.warnings);
  allErrors.push(...envResult.errors);

  if (!envResult.valid) {
    return {
      canStart: false,
      warnings: allWarnings,
      errors: allErrors,
      features: {
        aiClassification: false,
        aiEnrichment: false,
        backgroundQueue: false,
        encryption: false,
      },
      details: {
        environment: envResult,
        llm: { available: false, provider: null, model: null, error: 'Environment validation failed' },
        database: { ready: false, pendingCount: 0, pendingMigrations: [], appliedCount: 0, errors: [], warnings: [] },
        diskSpace: { ok: false, errors: [], warnings: [], stats: { path: '', freeBytes: 0, freeGB: 0 } },
      },
    };
  }

  // 2. Check disk space
  log.info('Checking disk space...');
  const diskSpaceResult = checkDiskSpace();
  allWarnings.push(...diskSpaceResult.warnings);
  allErrors.push(...diskSpaceResult.errors);

  if (!diskSpaceResult.ok) {
    return {
      canStart: false,
      warnings: allWarnings,
      errors: allErrors,
      features: {
        aiClassification: false,
        aiEnrichment: false,
        backgroundQueue: false,
        encryption: false,
      },
      details: {
        environment: envResult,
        llm: { available: false, provider: null, model: null, error: 'Disk space check failed' },
        database: { ready: false, pendingCount: 0, pendingMigrations: [], appliedCount: 0, errors: [], warnings: [] },
        diskSpace: diskSpaceResult,
      },
    };
  }

  // 3. Check database migrations (after disk space check)
  log.info('Checking database migrations...');
  const dbResult = checkDatabaseMigrations();
  allWarnings.push(...dbResult.warnings);
  allErrors.push(...dbResult.errors);

  if (!dbResult.ready) {
    return {
      canStart: false,
      warnings: allWarnings,
      errors: allErrors,
      features: {
        aiClassification: false,
        aiEnrichment: false,
        backgroundQueue: false,
        encryption: false,
      },
      details: {
        environment: envResult,
        llm: { available: false, provider: null, model: null, error: 'Database check failed' },
        database: dbResult,
        diskSpace: diskSpaceResult,
      },
    };
  }

  // 4. Check LLM connectivity (non-blocking)
  log.info('Testing LLM connectivity...');
  const llmResult = await checkLLMConnectivity();

  if (!llmResult.available && llmResult.error !== 'No API key configured') {
    allWarnings.push(`LLM connectivity issue: ${llmResult.error}`);
  }

  // Determine enabled features
  const features: StartupFeatures = {
    aiClassification: llmResult.available,
    aiEnrichment: llmResult.available,
    backgroundQueue: true, // Always available
    encryption: !!config.DECANT_MASTER_KEY,
  };

  return {
    canStart: allErrors.length === 0,
    warnings: allWarnings,
    errors: allErrors,
    features,
    details: {
      environment: envResult,
      llm: llmResult,
      database: dbResult,
      diskSpace: diskSpaceResult,
    },
  };
}

// ============================================================
// Formatted Output
// ============================================================

/**
 * Print startup validation results with formatted output
 */
export function printStartupResults(result: StartupValidationResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('DECANT STARTUP VALIDATION');
  console.log('='.repeat(60) + '\n');

  // Environment
  console.log('Environment:');
  console.log(`  ✓ NODE_ENV: ${result.details.environment.variables.NODE_ENV}`);
  console.log(`  ✓ PORT: ${result.details.environment.variables.PORT}`);
  console.log(`  ✓ LOG_LEVEL: ${result.details.environment.variables.LOG_LEVEL}`);
  console.log(`  ✓ DATABASE: ${result.details.environment.variables.DATABASE_PATH}`);

  // Database
  console.log('\nDatabase:');
  if (result.details.database.ready) {
    console.log(`  ✓ Migrations: ${result.details.database.appliedCount} applied`);
    if (result.details.database.pendingCount > 0) {
      console.log(`  ⚠ Pending: ${result.details.database.pendingCount} migration(s)`);
      result.details.database.pendingMigrations.forEach(name => {
        console.log(`    - ${name}`);
      });
    }
  } else {
    console.log('  ✗ Database check failed');
    result.details.database.errors.forEach(err => console.log(`    - ${err}`));
  }

  // Disk Space
  console.log('\nDisk Space:');
  if (result.details.diskSpace.stats.freeGB > 0) {
    console.log(`  ✓ Available: ${result.details.diskSpace.stats.freeGB.toFixed(2)} GB`);
    console.log(`  ✓ Path: ${result.details.diskSpace.stats.path}`);
  } else {
    console.log(`  ⚠ Unable to determine (path: ${result.details.diskSpace.stats.path})`);
  }

  // LLM
  console.log('\nLLM Provider:');
  if (result.details.llm.available) {
    console.log(`  ✓ Provider: ${result.details.llm.provider}`);
    console.log(`  ✓ Model: ${result.details.llm.model}`);
  } else {
    console.log(`  ✗ Not available: ${result.details.llm.error}`);
  }

  // Features
  console.log('\nEnabled Features:');
  console.log(`  ${result.features.aiClassification ? '✓' : '✗'} AI Classification`);
  console.log(`  ${result.features.aiEnrichment ? '✓' : '✗'} AI Enrichment`);
  console.log(`  ${result.features.backgroundQueue ? '✓' : '✗'} Background Queue`);
  console.log(`  ${result.features.encryption ? '✓' : '✗'} Encryption`);

  // Warnings
  if (result.warnings.length > 0) {
    console.log('\n' + '⚠'.repeat(60));
    console.log('WARNINGS:');
    result.warnings.forEach(warning => {
      console.log(`  ⚠ ${warning}`);
    });
    console.log('⚠'.repeat(60));
  }

  // Errors
  if (result.errors.length > 0) {
    console.log('\n' + '✗'.repeat(60));
    console.log('ERRORS:');
    result.errors.forEach(error => {
      console.log(`  ✗ ${error}`);
    });
    console.log('✗'.repeat(60));
    console.log('\nFix suggestions:');
    if (result.errors.some(e => e.includes('PORT'))) {
      console.log('  - Set PORT to a valid number between 1-65535');
    }
    if (result.errors.some(e => e.includes('disk space'))) {
      console.log('  - Free up disk space or change DATABASE_PATH');
    }
    if (result.errors.some(e => e.includes('writable'))) {
      console.log('  - Ensure the database directory has write permissions');
    }
    console.log('  - Check your .env file or environment variables');
    console.log('  - See documentation for configuration details');
  }

  console.log('\n' + '='.repeat(60));
  if (result.canStart) {
    console.log('✓ READY TO START');
  } else {
    console.log('✗ CANNOT START - FIX ERRORS ABOVE');
  }
  console.log('='.repeat(60) + '\n');
}

// ============================================================
// Error Formatting Helpers
// ============================================================

/**
 * Print a critical startup error with helpful information
 */
export function printStartupError(error: Error): void {
  console.error('\n' + '✗'.repeat(60));
  console.error('STARTUP FAILED');
  console.error('✗'.repeat(60) + '\n');
  console.error('Error:', error.message);
  if (error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  console.error('\n' + '✗'.repeat(60));
  console.error('Please check your configuration and try again.');
  console.error('See logs above for more details.');
  console.error('✗'.repeat(60) + '\n');
}
