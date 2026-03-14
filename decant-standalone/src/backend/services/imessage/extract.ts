// ============================================================
// iMessage URL Extraction Service
// Reads the macOS Messages database and extracts recent URLs
// from the user's self-text thread (chat ID 117)
// ============================================================

import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { log } from '../../logger/index.js';

// ============================================================
// Constants
// ============================================================

const IMESSAGE_DB_PATH = join(homedir(), 'Library/Messages/chat.db');
const TEMP_DB_PATH = '/tmp/decant_chat_copy.db';
const DEFAULT_CHAT_ID = 117;
const DEFAULT_COUNT = 5;

/** Regex to extract URLs from message text and binary blobs */
const URL_PATTERN = /https?:\/\/[^\s<>"{|}\\^\x60\[\]\x00-\x1f]+/g;

/** Trailing artifacts to strip from extracted URLs */
const TRAILING_JUNK = /[.,;:!?)]+$/;
const WHTTPURL_SUFFIX = /W?HttpURL\/?$/;

// ============================================================
// Types
// ============================================================

export interface ExtractUrlsOptions {
  /** Number of unique URLs to return (default: 5) */
  count?: number;
  /** iMessage chat ID for self-texts (default: 117) */
  chatId?: number;
}

export interface ExtractUrlsResult {
  urls: string[];
  error?: string;
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Copy the iMessage database to a temp location.
 * Uses osascript to work around macOS Full Disk Access restrictions —
 * Terminal/node may not have direct read access to ~/Library/Messages/.
 */
function copyImessageDatabase(): void {
  try {
    execSync(
      `osascript -e 'do shell script "cp ${IMESSAGE_DB_PATH} ${TEMP_DB_PATH}"'`,
      { timeout: 10000 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not permitted') || message.includes('Operation not permitted')) {
      throw new Error(
        'Cannot access iMessage database. Please grant Full Disk Access to Terminal ' +
        'in System Settings > Privacy & Security > Full Disk Access.'
      );
    }
    throw new Error(`Failed to copy iMessage database: ${message}`);
  }
}

/**
 * Clean up the temporary database copy.
 */
function cleanupTempDb(): void {
  try {
    if (existsSync(TEMP_DB_PATH)) {
      unlinkSync(TEMP_DB_PATH);
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Extract URLs from message text and/or attributedBody blob.
 */
function extractUrlsFromMessage(text: string | null, blob: Buffer | null): string[] {
  const urls = new Set<string>();

  // Extract from plain text field
  if (text) {
    const matches = text.match(URL_PATTERN);
    if (matches) {
      for (const url of matches) urls.add(url);
    }
  }

  // Extract from binary attributedBody blob
  if (blob) {
    try {
      const blobText = blob.toString('utf-8');
      const matches = blobText.match(URL_PATTERN);
      if (matches) {
        for (const url of matches) urls.add(url);
      }
    } catch {
      // Ignore blob decode errors
    }
  }

  // Clean and normalize
  const cleaned: string[] = [];
  for (const raw of urls) {
    const url = raw
      .replace(WHTTPURL_SUFFIX, '')
      .replace(TRAILING_JUNK, '');
    if (url.startsWith('http') && !cleaned.includes(url)) {
      cleaned.push(url);
    }
  }

  return cleaned;
}

/**
 * Extract the most recent unique URLs from iMessage self-texts.
 *
 * Copies the iMessage database to a temp location (permission workaround),
 * queries the specified chat for messages with URLs, and returns
 * up to `count` unique URLs ordered most-recent-first.
 */
export async function extractRecentUrls(
  options?: ExtractUrlsOptions
): Promise<ExtractUrlsResult> {
  const count = options?.count ?? DEFAULT_COUNT;
  const chatId = options?.chatId ?? DEFAULT_CHAT_ID;

  // Verify iMessage database exists
  if (!existsSync(IMESSAGE_DB_PATH)) {
    return {
      urls: [],
      error: 'iMessage database not found. This feature requires macOS with Messages app.',
    };
  }

  try {
    // Step 1: Copy database (permission workaround)
    copyImessageDatabase();

    // Step 2: Open the copy with better-sqlite3
    const db = new Database(TEMP_DB_PATH, { readonly: true, timeout: 5000 });

    try {
      // Step 3: Query messages from the self-text chat, newest first.
      // We fetch more rows than needed since not all messages contain URLs.
      const rows = db.prepare(`
        SELECT m.ROWID, m.text, m.attributedBody
        FROM message m
        JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        WHERE cmj.chat_id = ?
        ORDER BY m.ROWID DESC
        LIMIT 200
      `).all(chatId) as Array<{
        ROWID: number;
        text: string | null;
        attributedBody: Buffer | null;
      }>;

      if (rows.length === 0) {
        return {
          urls: [],
          error: `No messages found in chat ID ${chatId}. Verify this is your self-text thread.`,
        };
      }

      // Step 4: Extract and deduplicate URLs across messages
      const uniqueUrls: string[] = [];
      const seen = new Set<string>();

      for (const row of rows) {
        const urls = extractUrlsFromMessage(row.text, row.attributedBody);
        for (const url of urls) {
          if (!seen.has(url)) {
            seen.add(url);
            uniqueUrls.push(url);
            if (uniqueUrls.length >= count) break;
          }
        }
        if (uniqueUrls.length >= count) break;
      }

      log.info('Extracted iMessage URLs', {
        chatId,
        requested: count,
        found: uniqueUrls.length,
        messagesScanned: rows.length,
        module: 'imessage',
      });

      if (uniqueUrls.length === 0) {
        return {
          urls: [],
          error: 'No URLs found in recent self-texts.',
        };
      }

      return { urls: uniqueUrls };

    } finally {
      db.close();
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('iMessage URL extraction failed', {
      error: message,
      module: 'imessage',
    });
    return { urls: [], error: message };

  } finally {
    cleanupTempDb();
  }
}
