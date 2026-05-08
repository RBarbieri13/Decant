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
const DEFAULT_COUNT = 20;
const MAX_MESSAGES_SCAN = 1000;

/**
 * Self-identifiers used to resolve the "notes-to-self" chat dynamically.
 * Can be overridden via DECANT_SELF_IDENTIFIERS env var (comma-separated).
 * Matches both iMessage/SMS raw forms (phone/email, any case, with or
 * without the leading '+' / country code).
 */
const DEFAULT_SELF_IDENTIFIERS = [
  '9523346507',
  '+19523346507',
  'rbarbieri13@gmail.com',
];

function normalizeIdentifier(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^\+?1?/, '')   // strip leading '+' and optional US country code
    .replace(/[\s()\-.]/g, ''); // strip formatting characters
}

function getSelfIdentifiers(): string[] {
  const env = process.env.DECANT_SELF_IDENTIFIERS;
  const list = env ? env.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_SELF_IDENTIFIERS;
  // Keep both raw and normalized forms for matching both representations
  const out = new Set<string>();
  for (const id of list) {
    out.add(id.toLowerCase());
    out.add(normalizeIdentifier(id));
  }
  return [...out];
}

/** Regex to extract URLs from message text and binary blobs */
const URL_PATTERN = /https?:\/\/[^\s<>"{|}\\^\x60\[\]\x00-\x1f\x7f-\xff]+/g;

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
  /** Override the auto-resolved chat ID (advanced / debugging) */
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
      // Convert to latin1 (1:1 byte mapping) then strip non-ASCII to avoid
      // multi-byte UTF-8 replacement chars leaking into URL matches.
      const blobText = blob.toString('latin1').replace(/[^\x20-\x7e]/g, ' ');
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
 * Resolve the "notes-to-self" chat ID(s) by matching your identifiers
 * (phone / email) against both chat_identifier and participant handles.
 * Falls back to any chat where the single participant IS you.
 */
function resolveSelfChatIds(db: Database.Database): number[] {
  const selves = getSelfIdentifiers();
  if (selves.length === 0) return [];

  // Strategy 1: chat.chat_identifier exactly matches one of your identifiers.
  // This is the most reliable for Notes-to-Self chats created on recent macOS.
  const placeholders = selves.map(() => '?').join(',');

  const byChatIdentifier = db.prepare(`
    SELECT ROWID as id, chat_identifier, display_name
    FROM chat
    WHERE lower(chat_identifier) IN (${placeholders})
       OR replace(replace(replace(replace(lower(chat_identifier),'+',''),'-',''),' ',''),'(','') IN (${placeholders})
  `).all(...selves, ...selves) as Array<{ id: number; chat_identifier: string; display_name: string | null }>;

  const ids = new Set<number>();
  for (const row of byChatIdentifier) ids.add(row.id);
  if (ids.size > 0) return [...ids];

  // Strategy 2: handles joined to chats where all participants are you.
  const byHandle = db.prepare(`
    SELECT DISTINCT chj.chat_id as id
    FROM chat_handle_join chj
    JOIN handle h ON h.ROWID = chj.handle_id
    WHERE lower(h.id) IN (${placeholders})
       OR replace(replace(replace(replace(lower(h.id),'+',''),'-',''),' ',''),'(','') IN (${placeholders})
  `).all(...selves, ...selves) as Array<{ id: number }>;

  for (const row of byHandle) ids.add(row.id);
  return [...ids];
}

/**
 * Extract the most recent unique URLs from iMessage notes-to-self.
 *
 * Copies the iMessage database to a temp location (permission workaround),
 * resolves your self-chat by matching phone/email identifiers,
 * queries for messages with URLs, and returns up to `count` unique URLs
 * ordered most-recent-first.
 *
 * Supports offset-based pagination: skip `offset` unique URLs before
 * collecting the next `count`.
 */
export async function extractRecentUrls(
  options?: ExtractUrlsOptions
): Promise<ExtractUrlsResult> {
  const count = options?.count ?? DEFAULT_COUNT;
  const offset = options?.offset ?? 0;
  const chatIdOverride = options?.chatId;

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
      // Step 3: Resolve the self-chat ID(s) from your phone / email.
      const chatIds = chatIdOverride != null
        ? [chatIdOverride]
        : resolveSelfChatIds(db);

      if (chatIds.length === 0) {
        return {
          urls: [],
          hasMore: false,
          error:
            'Could not resolve your Notes-to-Self chat. Make sure you have sent at least one message to yourself (952-334-6507 or rbarbieri13@gmail.com), or set DECANT_SELF_IDENTIFIERS to the identifier your iMessage uses.',
        };
      }

      // Step 4: Query messages from the resolved chat(s), newest first.
      const placeholders = chatIds.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT m.ROWID, m.text, m.attributedBody, m.date
        FROM message m
        JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        WHERE cmj.chat_id IN (${placeholders})
        ORDER BY m.ROWID DESC
        LIMIT ?
      `).all(...chatIds, MAX_MESSAGES_SCAN) as Array<{
        ROWID: number;
        text: string | null;
        attributedBody: Buffer | null;
        date: number | null;
      }>;

      if (rows.length === 0) {
        return {
          urls: [],
          hasMore: false,
          error: `Resolved self-chat (ID${chatIds.length > 1 ? 's' : ''} ${chatIds.join(', ')}) but found no messages.`,
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
        chatIds,
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
