// ============================================================
// Startup Validation Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateEnvironment,
  checkDiskSpace,
  checkDatabaseMigrations,
  type EnvironmentValidationResult,
  type DiskSpaceResult,
  type DatabaseMigrationResult,
} from '../index.js';

describe('Startup Validation', () => {
  describe('validateEnvironment', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should pass with valid configuration', () => {
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'info';
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.variables.PORT).toBe(3000);
      expect(result.variables.NODE_ENV).toBe('development');
    });

    it('should warn if no OpenAI API key', () => {
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'development';
      delete process.env.OPENAI_API_KEY;

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        expect.stringContaining('No OPENAI_API_KEY configured')
      );
    });

    it('should warn if no master key', () => {
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'development';
      delete process.env.DECANT_MASTER_KEY;

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        expect.stringContaining('No DECANT_MASTER_KEY configured')
      );
    });

    it('should warn about debug logging in production', () => {
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug';

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('excessive logs'))).toBe(true);
    });
  });

  describe('checkDiskSpace', () => {
    it('should check disk space and path writability', () => {
      const result = checkDiskSpace();

      // Should always return a result
      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.path).toBeTruthy();

      // Should either succeed or have warnings (platform dependent)
      if (!result.ok) {
        expect(result.errors.length + result.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('checkDatabaseMigrations', () => {
    it('should check migration status', () => {
      const result = checkDatabaseMigrations();

      expect(result).toBeDefined();
      expect(result.ready).toBeDefined();
      expect(result.appliedCount).toBeGreaterThanOrEqual(0);
      expect(result.pendingCount).toBeGreaterThanOrEqual(0);
    });

    it('should report pending migrations', () => {
      const result = checkDatabaseMigrations();

      if (result.pendingCount > 0) {
        expect(result.pendingMigrations.length).toBe(result.pendingCount);
        expect(result.warnings.some(w => w.includes('pending'))).toBe(true);
      }
    });
  });
});

describe('Startup Feature Flags', () => {
  it('should disable AI features when no API key', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const envResult = validateEnvironment();

    expect(envResult.variables.hasOpenAIKey).toBe(false);
    expect(envResult.warnings.some(w => w.includes('AI features will be disabled'))).toBe(true);

    // Restore
    process.env.OPENAI_API_KEY = originalKey;
  });

  it('should enable encryption when master key present', () => {
    const originalKey = process.env.DECANT_MASTER_KEY;
    process.env.DECANT_MASTER_KEY = 'a'.repeat(32); // 32 chars minimum

    const envResult = validateEnvironment();

    expect(envResult.variables.hasMasterKey).toBe(true);

    // Restore
    if (originalKey) {
      process.env.DECANT_MASTER_KEY = originalKey;
    } else {
      delete process.env.DECANT_MASTER_KEY;
    }
  });
});

describe('Validation Result Structure', () => {
  it('should return properly structured environment result', () => {
    const result = validateEnvironment();

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('variables');
    expect(result.variables).toHaveProperty('PORT');
    expect(result.variables).toHaveProperty('NODE_ENV');
    expect(result.variables).toHaveProperty('LOG_LEVEL');
    expect(result.variables).toHaveProperty('hasOpenAIKey');
    expect(result.variables).toHaveProperty('hasMasterKey');
  });

  it('should return properly structured disk space result', () => {
    const result = checkDiskSpace();

    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('stats');
    expect(result.stats).toHaveProperty('path');
    expect(result.stats).toHaveProperty('freeBytes');
    expect(result.stats).toHaveProperty('freeGB');
  });

  it('should return properly structured database result', () => {
    const result = checkDatabaseMigrations();

    expect(result).toHaveProperty('ready');
    expect(result).toHaveProperty('pendingCount');
    expect(result).toHaveProperty('pendingMigrations');
    expect(result).toHaveProperty('appliedCount');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
  });
});
