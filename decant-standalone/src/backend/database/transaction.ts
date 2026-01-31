// ============================================================
// Transaction Helper
// ============================================================
//
// This module provides a transaction wrapper for better-sqlite3 database operations.
// Transactions ensure that multiple database operations are executed atomically:
// either all operations succeed, or none of them do.
//
// ============================================================

import { getDatabase } from './connection.js';

/**
 * Executes a function within a database transaction.
 * If the function throws an error, the transaction is rolled back.
 * If the function completes successfully, the transaction is committed.
 *
 * ## How it Works
 *
 * better-sqlite3's transaction() method automatically:
 * - Begins a transaction before calling the function
 * - Commits the transaction if the function returns normally
 * - Rolls back the transaction if the function throws an error
 *
 * ## When to Use Transactions
 *
 * Use transactions for multi-step operations that must be atomic:
 *
 * 1. **Creating Related Records**: When creating a node with key_concepts
 * 2. **Updating Multiple Tables**: When updating a node and its related data
 * 3. **Bulk Operations**: When performing multiple inserts/updates that should succeed or fail together
 * 4. **Merge Operations**: When updating one record and deleting/archiving another
 * 5. **Schema Migrations**: When applying database schema changes
 *
 * ## When NOT to Use Transactions
 *
 * Avoid transactions for:
 * - Single read operations (SELECT queries)
 * - Single write operations (one INSERT/UPDATE/DELETE)
 * - Read-only operations that don't modify data
 *
 * ## Nested Transactions Warning
 *
 * better-sqlite3 does NOT support nested transactions. If you call withTransaction()
 * from within another withTransaction(), it will start a new transaction and may cause
 * unexpected behavior or deadlocks.
 *
 * **AVOID THIS PATTERN:**
 * ```typescript
 * withTransaction(() => {
 *   // First transaction starts
 *   createNode(data);  // This internally calls withTransaction() - NESTED!
 * });
 * ```
 *
 * **USE THIS PATTERN INSTEAD:**
 * ```typescript
 * // Example from mergeNodes() - performs direct DB operations within a single transaction
 * withTransaction(() => {
 *   // Perform direct database operations here
 *   db.prepare('UPDATE nodes SET ...').run(...);
 *   db.prepare('DELETE FROM key_concepts ...').run(...);
 *   // Don't call other functions that use withTransaction()
 * });
 * ```
 *
 * ## Current Usage in Codebase
 *
 * ### nodes.ts
 * - `createNode()`: Wraps INSERT to nodes + INSERT to key_concepts
 * - `updateNode()`: Wraps UPDATE to nodes + DELETE/INSERT to key_concepts
 * - `mergeNodes()`: Wraps primary node update + secondary node soft-delete
 *
 * ### taxonomy.ts
 * - `getSegments()`: Wraps bulk INSERT of default segments
 * - `getOrganizations()`: Wraps bulk INSERT of default organizations
 *
 * ### migrations/runner.ts
 * - `runPendingMigrations()`: Each migration runs in its own transaction
 * - `rollbackMigration()`: Rollback operations run in a transaction
 * - `rollbackAllMigrations()`: Each rollback runs in its own transaction
 *
 * @param fn - The function to execute within the transaction
 * @returns The return value of the function
 * @throws Re-throws any error from the function after rollback
 *
 * @example
 * // Basic usage: create node with key concepts atomically
 * const result = withTransaction(() => {
 *   const id = uuidv4();
 *   db.prepare('INSERT INTO nodes ...').run(id, ...);
 *   db.prepare('INSERT INTO key_concepts ...').run(...);
 *   return readNode(id);
 * });
 *
 * @example
 * // Bulk operation: create multiple segments atomically
 * const segments = withTransaction(() => {
 *   const stmt = db.prepare('INSERT INTO segments ...');
 *   for (const seg of DEFAULT_SEGMENTS) {
 *     stmt.run(uuidv4(), seg.name, seg.code);
 *   }
 *   return db.prepare('SELECT * FROM segments').all();
 * });
 *
 * @example
 * // Merge operation: update primary and delete secondary atomically
 * const result = withTransaction(() => {
 *   db.prepare('UPDATE nodes SET ... WHERE id = ?').run(primaryId);
 *   db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(secondaryId);
 *   return readNode(primaryId);
 * });
 */
export function withTransaction<T>(fn: () => T): T {
  const db = getDatabase();
  const transaction = db.transaction(fn);
  return transaction();
}

/**
 * Executes an async-like operation within a transaction.
 * Note: better-sqlite3 is synchronous, so this is for consistency
 * with code that may need to perform multiple sync operations
 * that should be atomic.
 *
 * This is an alias for withTransaction() for consistency with
 * codebases that distinguish between sync and async transactions.
 *
 * @param fn - The function to execute within the transaction
 * @returns The return value of the function
 */
export function withTransactionSync<T>(fn: () => T): T {
  return withTransaction(fn);
}
