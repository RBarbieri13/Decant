#!/usr/bin/env node
// ============================================================
// Startup Validation CLI Tool
// Run startup checks without starting the server
// ============================================================

import { validateStartup, printStartupResults } from './index.js';

/**
 * Run startup validation from command line
 */
async function main(): Promise<void> {
  console.log('Running Decant startup validation...\n');

  try {
    const result = await validateStartup();

    printStartupResults(result);

    // Exit with appropriate code
    if (result.canStart) {
      console.log('\nValidation passed! Ready to start server.');
      process.exit(0);
    } else {
      console.error('\nValidation failed. Fix errors above before starting.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\nUnexpected error during validation:');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
