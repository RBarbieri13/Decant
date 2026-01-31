#!/usr/bin/env node
// ============================================================
// Migration CLI
// Command-line interface for database migrations
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase, closeDatabase } from '../connection.js';
import {
  getMigrationStatus,
  runPendingMigrations,
  rollbackMigration,
  rollbackAllMigrations,
} from './runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration file template
 */
function getMigrationTemplate(name: string): string {
  return `// ============================================================
// Migration: ${name}
// Description: TODO - Add description
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '${name}';

export function up(db: Database.Database): void {
  // TODO: Implement migration
  db.exec(\`
    -- Your SQL here
  \`);
}

export function down(db: Database.Database): void {
  // TODO: Implement rollback
  db.exec(\`
    -- Your rollback SQL here
  \`);
}

const migration: Migration = { name, up, down };
export default migration;
`;
}

/**
 * Get the next migration number
 */
function getNextMigrationNumber(): string {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir);
  const migrationFiles = files.filter(f =>
    /^\d{3}_.*\.ts$/.test(f) && !f.includes('.spec.')
  );

  let maxNum = 0;
  for (const file of migrationFiles) {
    const match = file.match(/^(\d{3})_/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  return String(maxNum + 1).padStart(3, '0');
}

/**
 * Show migration status
 */
function showStatus(): void {
  const db = getDatabase();
  const status = getMigrationStatus(db);

  console.log('\nMigration Status:');
  console.log('=================\n');

  if (status.length === 0) {
    console.log('No migrations defined');
    return;
  }

  const maxNameLen = Math.max(...status.map(s => s.name.length));

  for (const s of status) {
    const statusIcon = s.applied ? '[x]' : '[ ]';
    const appliedInfo = s.appliedAt ? ` (applied: ${s.appliedAt})` : '';
    console.log(`${statusIcon} ${s.name.padEnd(maxNameLen)}${appliedInfo}`);
  }

  const pending = status.filter(s => !s.applied).length;
  const applied = status.filter(s => s.applied).length;
  console.log(`\nTotal: ${status.length} | Applied: ${applied} | Pending: ${pending}`);
}

/**
 * Run pending migrations
 */
function runUp(): void {
  const db = getDatabase();
  console.log('\nRunning pending migrations...\n');
  const applied = runPendingMigrations(db);

  if (applied.length > 0) {
    console.log('\nMigrations applied successfully!');
  }
}

/**
 * Rollback a migration
 */
function runDown(name?: string): void {
  const db = getDatabase();

  if (!name) {
    console.error('\nError: Migration name is required for rollback');
    console.log('Usage: migrate down <migration_name>');
    console.log('Example: migrate down 002_add_indexes\n');
    process.exit(1);
  }

  console.log(`\nRolling back migration: ${name}\n`);
  const success = rollbackMigration(db, name);

  if (success) {
    console.log('\nRollback completed successfully!');
  } else {
    process.exit(1);
  }
}

/**
 * Rollback all migrations
 */
function runReset(): void {
  const db = getDatabase();
  console.log('\nRolling back ALL migrations...');
  console.log('WARNING: This will destroy all data!\n');

  const rolledBack = rollbackAllMigrations(db);

  if (rolledBack.length > 0) {
    console.log('\nAll migrations rolled back!');
  }
}

/**
 * Create a new migration file
 */
function createMigration(description?: string): void {
  if (!description) {
    console.error('\nError: Migration description is required');
    console.log('Usage: migrate create <description>');
    console.log('Example: migrate create add_user_settings\n');
    process.exit(1);
  }

  // Sanitize description for filename
  const sanitized = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  if (!sanitized) {
    console.error('\nError: Invalid migration description');
    process.exit(1);
  }

  const number = getNextMigrationNumber();
  const name = `${number}_${sanitized}`;
  const filename = `${name}.ts`;
  const filepath = path.join(__dirname, filename);

  if (fs.existsSync(filepath)) {
    console.error(`\nError: Migration file already exists: ${filename}`);
    process.exit(1);
  }

  const content = getMigrationTemplate(name);
  fs.writeFileSync(filepath, content, 'utf-8');

  console.log(`\nCreated migration: ${filepath}`);
  console.log('\nDon\'t forget to:');
  console.log('1. Implement the up() and down() functions');
  console.log('2. Add the migration to the imports in runner.ts');
  console.log('3. Add the migration to the migrations array in runner.ts\n');
}

/**
 * Show help
 */
function showHelp(): void {
  console.log(`
Decant Database Migration CLI
=============================

Usage: npm run migrate <command> [args]

Commands:
  status              Show migration status
  up                  Run all pending migrations
  down <name>         Rollback a specific migration
  reset               Rollback ALL migrations (destructive!)
  create <name>       Create a new migration file

Examples:
  npm run migrate status
  npm run migrate up
  npm run migrate down 002_add_indexes
  npm run migrate create add_user_settings

Notes:
  - Migrations are run in order by their numeric prefix
  - Rollback requires explicit migration name
  - The 'reset' command will destroy all data
`);
}

/**
 * Main CLI entry point
 */
function main(): void {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  try {
    switch (command) {
      case 'status':
        showStatus();
        break;

      case 'up':
        runUp();
        break;

      case 'down':
        runDown(args[1]);
        break;

      case 'reset':
        runReset();
        break;

      case 'create':
        createMigration(args.slice(1).join('_'));
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        if (command) {
          console.error(`\nUnknown command: ${command}`);
        }
        showHelp();
        process.exit(command ? 1 : 0);
    }
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();
