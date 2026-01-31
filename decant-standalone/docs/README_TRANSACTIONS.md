# Transaction Documentation Guide

## Quick Navigation

This directory contains comprehensive documentation about transaction support in the Decant standalone application. Choose the document that best fits your needs:

### For Quick Answers
**[TRANSACTION_QUICK_REFERENCE.md](TRANSACTION_QUICK_REFERENCE.md)**
- TL;DR section
- Quick decision table (use transaction? yes/no)
- Common code patterns (copy-paste ready)
- Common mistakes to avoid
- 5-minute read

**Best for**: Developers who need quick answers while coding.

### For Understanding How It Works
**[TRANSACTION_FLOW.md](TRANSACTION_FLOW.md)**
- Visual flow diagrams
- Architecture diagrams
- Decision trees
- Step-by-step execution flows
- Performance impact comparisons
- 10-minute read

**Best for**: Developers who want to understand the transaction flow and architecture.

### For Comprehensive Understanding
**[TRANSACTION_USAGE.md](TRANSACTION_USAGE.md)**
- Complete transaction guide
- Detailed explanations of when and why to use transactions
- Current usage in codebase with rationale
- Performance considerations
- Testing strategies
- Future enhancements
- 15-minute read

**Best for**: Developers who want a complete understanding or are implementing new transactional operations.

### For Implementation Status
**[TRANSACTION_IMPLEMENTATION_SUMMARY.md](TRANSACTION_IMPLEMENTATION_SUMMARY.md)**
- Implementation status (complete)
- Verification checklist
- Files modified/created
- Key achievements
- Next steps
- 5-minute read

**Best for**: Project managers, reviewers, or developers who want to know what was implemented.

## Reading Path

### New to Transactions?
1. Start with **TRANSACTION_QUICK_REFERENCE.md** to get familiar with the basics
2. Read **TRANSACTION_FLOW.md** to understand how transactions work
3. Refer back to **TRANSACTION_QUICK_REFERENCE.md** when coding

### Implementing New Features?
1. Review **TRANSACTION_QUICK_REFERENCE.md** decision guide
2. Check **TRANSACTION_USAGE.md** for similar patterns
3. Use **TRANSACTION_FLOW.md** to verify your approach
4. Update documentation when done

### Debugging Transaction Issues?
1. Check **TRANSACTION_FLOW.md** error handling section
2. Review **TRANSACTION_USAGE.md** nested transaction warnings
3. Verify against **TRANSACTION_QUICK_REFERENCE.md** common mistakes

### Code Review?
1. Use **TRANSACTION_QUICK_REFERENCE.md** decision guide to verify appropriateness
2. Check **TRANSACTION_USAGE.md** for best practices
3. Verify no nested transactions using **TRANSACTION_FLOW.md** patterns

## Document Comparison

| Document | Length | Focus | Best For |
|----------|--------|-------|----------|
| QUICK_REFERENCE | Short | Practical examples | Coding |
| TRANSACTION_FLOW | Medium | Visual understanding | Architecture |
| TRANSACTION_USAGE | Long | Complete guide | Deep understanding |
| IMPLEMENTATION_SUMMARY | Short | Status and verification | Project tracking |

## Key Concepts at a Glance

### What is a Transaction?
A transaction ensures multiple database operations are atomic - either all succeed or all fail together.

### When to Use Transactions?
Use for multi-step write operations that must be atomic:
- Creating records with related data (node + key_concepts)
- Updating records and related data (node + replace key_concepts)
- Merge operations (update primary + delete secondary)
- Bulk inserts that must all succeed together

### When NOT to Use Transactions?
- Single read operations
- Single write operations
- Read-only operations

### Critical Warning: No Nesting!
better-sqlite3 does NOT support nested transactions. If you call a function that uses withTransaction() from within another withTransaction(), it will cause issues.

## Code Location

- **Transaction Helper**: `src/backend/database/transaction.ts`
- **Node Operations**: `src/backend/database/nodes.ts`
- **Taxonomy Operations**: `src/backend/database/taxonomy.ts`
- **Migration Operations**: `src/backend/database/migrations/runner.ts`

## Quick Examples

### Basic Usage
```typescript
import { withTransaction } from './transaction.js';

const node = withTransaction(() => {
  db.prepare('INSERT INTO nodes ...').run(...);
  db.prepare('INSERT INTO key_concepts ...').run(...);
  return readNode(id);
});
```

### Avoiding Nested Transactions
```typescript
// ❌ WRONG: Nested transactions
withTransaction(() => {
  createNode(data); // This internally uses withTransaction()
});

// ✅ CORRECT: Direct operations
withTransaction(() => {
  db.prepare('INSERT INTO nodes ...').run(...);
  db.prepare('INSERT INTO key_concepts ...').run(...);
});
```

## Testing Transactions

```typescript
test('operation rolls back on error', () => {
  const countBefore = countNodes();

  try {
    withTransaction(() => {
      db.prepare('INSERT INTO nodes ...').run(...);
      throw new Error('Test error');
    });
  } catch (error) {
    // Expected
  }

  const countAfter = countNodes();
  expect(countAfter).toBe(countBefore); // Rollback successful
});
```

## FAQ

### Q: Do I need a transaction for a single INSERT?
**A**: No. Single operations are atomic by default.

### Q: Do I need a transaction for SELECT queries?
**A**: No. Reads don't need transactions (SQLite handles consistency).

### Q: Can I nest transactions?
**A**: No. better-sqlite3 does NOT support nested transactions. Use direct DB operations instead.

### Q: What happens if an error occurs in a transaction?
**A**: The transaction automatically rolls back all operations and re-throws the error.

### Q: How do I test transaction rollback?
**A**: Wrap the transaction in a try-catch, throw an error inside, and verify the database state is unchanged.

### Q: Which is faster: multiple transactions or one transaction?
**A**: One transaction is significantly faster because it only acquires/releases locks once.

## Getting Help

If you have questions about transaction usage:

1. Check the **TRANSACTION_QUICK_REFERENCE.md** for common patterns
2. Review **TRANSACTION_USAGE.md** for detailed explanations
3. Look at existing code in `nodes.ts`, `taxonomy.ts`, and `migrations/runner.ts`
4. Ask a team member who has read this documentation

## Contributing

When you add new transactional operations:

1. Use the patterns in **TRANSACTION_QUICK_REFERENCE.md**
2. Avoid nested transactions (see **TRANSACTION_FLOW.md**)
3. Test both success and rollback scenarios
4. Update **TRANSACTION_USAGE.md** if you introduce a new pattern
5. Update **TRANSACTION_IMPLEMENTATION_SUMMARY.md** if significant

## Document History

- 2026-01-28: Initial comprehensive transaction documentation created
  - TRANSACTION_USAGE.md (complete guide)
  - TRANSACTION_FLOW.md (visual diagrams)
  - TRANSACTION_QUICK_REFERENCE.md (quick reference)
  - TRANSACTION_IMPLEMENTATION_SUMMARY.md (status)
  - README_TRANSACTIONS.md (this file)

## License

These documents are part of the Decant standalone application and follow the same license as the main project.

---

**Need help? Start with [TRANSACTION_QUICK_REFERENCE.md](TRANSACTION_QUICK_REFERENCE.md)**
