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
const DEFAULT_COUNT = 20;
const MAX_MESSAGES_SCAN = 1000;

/** Regex to extract URLs from message text and binary blobs */
const URL_PATTERN = /https?:\/\/[^\s<>"{|}\\^\x60\[\]\x00-\x1f]+/g;

/** Trailing artifacts to strip from extracted URLs */
const TRAILING_JUNK = /[.,;:!?)]+$/;
const WHTTPURL_SUFFIX = /W?HttpURL\/?$/;

// ============================================================
// Types
// ============================================================

export interface ExtractUrlsOptions {
  /** Number of unique URLs to return (default: 20) */
  count?: number;
  /** Number of unique URLs to skip before collecting (for pagination) */
  offset?: number;
  /** iMessage chat ID for self-texts (default: 117) */
  chatId?: number;
}

export interface ExtractedUrl {
  url: string;
  /** ISO date string from iMessage (Apple epoch → JS Date) */
  messageDate: string | null;
}

export interface ExtractUrlsResult {
  urls: ExtractedUrl[];
  /** Whether there are more URLs beyond this page */
  hasMore: boolean;
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

/** Convert Apple's Core Data timestamp (seconds since 2001-01-01) to ISO string */
function appleTimestampToISO(timestamp: number | null): string | null {
  if (timestamp == null || timestamp === 0) return null;
  // Apple epoch is 2001-01-01T00:00:00Z = 978307200 Unix seconds
  // iMessage stores in nanoseconds (10^9) since Apple epoch
  const unixSeconds = (timestamp / 1_000_000_000) + 978307200;
  return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Extract the most recent unique URLs from iMessage self-texts.
 *
 * Copies the iMessage database to a temp location (permission workaround),
 * queries the specified chat for messages with URLs, and returns
 * up to `count` unique URLs ordered most-recent-first.
 *
 * Supports offset-based pagination: skip `offset` unique URLs before
 * collecting the next `count`.
 */
export async function extractRecentUrls(
  options?: ExtractUrlsOptions
): Promise<ExtractUrlsResult> {
  const count = options?.count ?? DEFAULT_COUNT;
  const offset = options?.offset ?? 0;
  const chatId = options?.chatId ?? DEFAULT_CHAT_ID;

  // Verify iMessage database exists
  if (!existsSync(IMESSAGE_DB_PATH)) {
    return {
      urls: [],
      hasMore: false,
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
      // We fetch many rows since not all messages contain URLs.
      const rows = db.prepare(`
        SELECT m.ROWID, m.text, m.attributedBody, m.date
        FROM message m
        JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        WHERE cmj.chat_id = ?
        ORDER BY m.ROWID DESC
        LIMIT ?
      `).all(chatId, MAX_MESSAGES_SCAN) as Array<{
        ROWID: number;
        text: string | null;
        attributedBody: Buffer | null;
        date: number | null;
      }>;

      if (rows.length === 0) {
        return {
          urls: [],
          hasMore: false,
          error: `No messages found in chat ID ${chatId}. Verify this is your self-text thread.`,
        };
      }

      // Step 4: Extract and deduplicate URLs across messages
      const allUniqueUrls: ExtractedUrl[] = [];
      const seen = new Set<string>();

      for (const row of rows) {
        const urls = extractUrlsFromMessage(row.text, row.attributedBody);
        const messageDate = appleTimestampToISO(row.date);
        for (const url of urls) {
          if (!seen.has(url)) {
            seen.add(url);
            allUniqueUrls.push({ url, messageDate });
          }
        }
        // Collect enough to cover offset + count + 1 (to detect hasMore)
        if (allUniqueUrls.length >= offset + count + 1) break;
      }

      // Apply pagination
      const page = allUniqueUrls.slice(offset, offset + count);
      const hasMore = allUniqueUrls.length > offset + count;

      log.info('Extracted iMessage URLs', {
        chatId,
        requested: count,
        offset,
        found: page.length,
        totalUnique: allUniqueUrls.length,
        messagesScanned: rows.length,
        hasMore,
        module: 'imessage',
      });

      if (page.length === 0) {
        return {
          urls: [],
          hasMore: false,
          error: offset > 0
            ? 'No more URLs found.'
            : 'No URLs found in recent self-texts.',
        };
      }

      return { urls: page, hasMore };

    } finally {
      db.close();
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('iMessage URL extraction failed', {
      error: message,
      module: 'imessage',
    });
    return { urls: [], hasMore: false, error: message };

  } finally {
    cleanupTempDb();
  }
}
