// ============================================================
// Keystore Service
// Encrypted API key storage for Decant
// ============================================================

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { log } from '../logger/index.js';

// Constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

// File paths
const DECANT_CONFIG_DIR = path.join(os.homedir(), '.decant', 'config');
const KEYS_FILE = path.join(DECANT_CONFIG_DIR, 'keys.enc');

/**
 * Key identifiers for different API keys
 */
export type KeyIdentifier = 'openai' | 'anthropic' | 'x_api' | 'custom';

/**
 * Encrypted key storage format
 */
interface EncryptedStore {
  version: number;
  salt: string; // hex
  keys: {
    [K in KeyIdentifier]?: {
      iv: string; // hex
      authTag: string; // hex
      encrypted: string; // hex
    };
  };
}

/**
 * Get the master key for encryption
 *
 * Priority:
 * 1. DECANT_MASTER_KEY environment variable
 * 2. Derived from machine ID (hostname + username + home directory)
 */
function getMasterKeySource(): string {
  const envKey = process.env.DECANT_MASTER_KEY;
  if (envKey) {
    log.debug('Using master key from environment', { module: 'keystore' });
    return envKey;
  }

  // Derive from machine-specific information
  // This provides basic protection but is not as secure as a user-provided key
  const machineId = [
    os.hostname(),
    os.userInfo().username,
    os.homedir(),
    os.platform(),
    os.arch(),
  ].join(':');

  log.debug('Using derived master key from machine ID', { module: 'keystore' });
  return machineId;
}

/**
 * Derive encryption key from master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Ensure the config directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(DECANT_CONFIG_DIR)) {
    fs.mkdirSync(DECANT_CONFIG_DIR, { recursive: true, mode: 0o700 });
    log.info('Created config directory', { path: DECANT_CONFIG_DIR, module: 'keystore' });
  }
}

/**
 * Load the encrypted store from disk
 */
function loadStore(): EncryptedStore | null {
  try {
    if (!fs.existsSync(KEYS_FILE)) {
      return null;
    }

    const data = fs.readFileSync(KEYS_FILE, 'utf8');
    const store = JSON.parse(data) as EncryptedStore;

    // Validate store format
    if (typeof store.version !== 'number' || typeof store.salt !== 'string') {
      log.warn('Invalid keystore format, will recreate', { module: 'keystore' });
      return null;
    }

    return store;
  } catch (error) {
    log.error('Failed to load keystore', { err: error, module: 'keystore' });
    return null;
  }
}

/**
 * Save the encrypted store to disk
 */
function saveStore(store: EncryptedStore): void {
  ensureConfigDir();

  const data = JSON.stringify(store, null, 2);
  fs.writeFileSync(KEYS_FILE, data, { mode: 0o600 });
  log.debug('Keystore saved', { module: 'keystore' });
}

/**
 * Create a new empty store with a fresh salt
 */
function createNewStore(): EncryptedStore {
  const salt = crypto.randomBytes(SALT_LENGTH);
  return {
    version: 1,
    salt: salt.toString('hex'),
    keys: {},
  };
}

/**
 * Encrypt a value using AES-256-GCM
 */
function encrypt(
  value: string,
  key: Buffer
): { iv: string; authTag: string; encrypted: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted,
  };
}

/**
 * Decrypt a value using AES-256-GCM
 */
function decrypt(
  encryptedData: { iv: string; authTag: string; encrypted: string },
  key: Buffer
): string {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Set an API key in the encrypted store
 *
 * @param identifier - Key identifier (e.g., 'openai', 'anthropic')
 * @param apiKey - The API key value to store
 */
export async function setApiKey(
  identifier: KeyIdentifier,
  apiKey: string
): Promise<void> {
  try {
    // Load or create store
    let store = loadStore();
    if (!store) {
      store = createNewStore();
    }

    // Derive encryption key
    const salt = Buffer.from(store.salt, 'hex');
    const masterKey = getMasterKeySource();
    const key = deriveKey(masterKey, salt);

    // Encrypt the API key
    const encryptedData = encrypt(apiKey, key);
    store.keys[identifier] = encryptedData;

    // Save store
    saveStore(store);

    log.info('API key stored', { identifier, module: 'keystore' });
  } catch (error) {
    log.error('Failed to set API key', { identifier, err: error, module: 'keystore' });
    throw new Error(`Failed to store API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get an API key from the encrypted store
 *
 * @param identifier - Key identifier (e.g., 'openai', 'anthropic')
 * @returns The decrypted API key or null if not found
 */
export async function getApiKey(identifier: KeyIdentifier): Promise<string | null> {
  try {
    // Check environment variables first
    let envKey: string | undefined;
    switch (identifier) {
      case 'openai':
        envKey = process.env.OPENAI_API_KEY;
        break;
      case 'x_api':
        envKey = process.env.X_API_BEARER_TOKEN;
        break;
    }
    if (envKey) {
      return envKey;
    }

    // Load store
    const store = loadStore();
    if (!store) {
      return null;
    }

    // Check if key exists
    const encryptedData = store.keys[identifier];
    if (!encryptedData) {
      return null;
    }

    // Derive decryption key
    const salt = Buffer.from(store.salt, 'hex');
    const masterKey = getMasterKeySource();
    const key = deriveKey(masterKey, salt);

    // Decrypt the API key
    const apiKey = decrypt(encryptedData, key);

    return apiKey;
  } catch (error) {
    log.error('Failed to get API key', { identifier, err: error, module: 'keystore' });
    return null;
  }
}

/**
 * Delete an API key from the encrypted store
 *
 * @param identifier - Key identifier to delete
 */
export async function deleteApiKey(identifier: KeyIdentifier): Promise<void> {
  try {
    const store = loadStore();
    if (!store) {
      return;
    }

    if (store.keys[identifier]) {
      delete store.keys[identifier];
      saveStore(store);
      log.info('API key deleted', { identifier, module: 'keystore' });
    }
  } catch (error) {
    log.error('Failed to delete API key', { identifier, err: error, module: 'keystore' });
    throw new Error(`Failed to delete API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if an API key is configured
 *
 * @param identifier - Key identifier to check
 * @returns True if the key is configured (either in store or env var)
 */
export async function isConfigured(identifier: KeyIdentifier): Promise<boolean> {
  // Check environment variables first
  switch (identifier) {
    case 'openai':
      if (process.env.OPENAI_API_KEY) return true;
      break;
    case 'x_api':
      if (process.env.X_API_BEARER_TOKEN) return true;
      break;
  }

  try {
    const store = loadStore();
    if (!store) {
      return false;
    }

    return !!store.keys[identifier];
  } catch {
    return false;
  }
}

/**
 * List all configured key identifiers
 *
 * @returns Array of configured key identifiers
 */
export async function listConfiguredKeys(): Promise<KeyIdentifier[]> {
  const configured: KeyIdentifier[] = [];

  // Check environment variables
  if (process.env.OPENAI_API_KEY) {
    configured.push('openai');
  }
  if (process.env.X_API_BEARER_TOKEN) {
    configured.push('x_api');
  }

  try {
    const store = loadStore();
    if (store) {
      for (const key of Object.keys(store.keys) as KeyIdentifier[]) {
        if (!configured.includes(key)) {
          configured.push(key);
        }
      }
    }
  } catch {
    // Ignore errors, return what we have
  }

  return configured;
}

/**
 * Clear all stored keys (useful for testing or reset)
 */
export async function clearAllKeys(): Promise<void> {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      fs.unlinkSync(KEYS_FILE);
      log.info('All API keys cleared', { module: 'keystore' });
    }
  } catch (error) {
    log.error('Failed to clear keys', { err: error, module: 'keystore' });
    throw new Error(`Failed to clear keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default {
  setApiKey,
  getApiKey,
  deleteApiKey,
  isConfigured,
  listConfiguredKeys,
  clearAllKeys,
};
