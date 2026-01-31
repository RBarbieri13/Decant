#!/usr/bin/env node
// ============================================================
// Direct iMessage Sync Script
// ============================================================

import { syncIMessageToDecant } from '../src/main/services/imessage';
import { getDatabase } from '../src/main/database/connection';
import path from 'path';
import fs from 'fs';

async function main() {
  try {
    // Get API key from environment or prompt
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('Error: ANTHROPIC_API_KEY environment variable not set');
      console.error('Usage: ANTHROPIC_API_KEY=sk-ant-... npx ts-node scripts/sync-imessage.ts');
      process.exit(1);
    }

    console.log('🔄 Starting iMessage to Decant sync...');
    console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(-5)}`);

    // Initialize database connection
    const dbPath = path.join(
      process.env.HOME!,
      'Library/Application Support/Decant/decant.db'
    );

    if (!fs.existsSync(dbPath)) {
      console.error(`Error: Database not found at ${dbPath}`);
      console.error('Please start the Decant app first to initialize the database.');
      process.exit(1);
    }

    // Run sync
    const result = await syncIMessageToDecant(apiKey);

    console.log('\n✅ Sync Complete!');
    console.log(`Status: ${result.status}`);
    console.log(`Message: ${result.message}`);
    if (result.items_synced) {
      console.log(`Items Synced: ${result.items_synced}`);
    }
    if (result.error) {
      console.error(`Error: ${result.error}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
