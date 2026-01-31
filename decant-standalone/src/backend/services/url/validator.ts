// ============================================================
// URL Validator and Normalizer
// Validates, normalizes, and sanitizes URLs for safe processing
// ============================================================

import { log } from '../../logger/index.js';
import { AppError, SSRFError } from '../../middleware/errorHandler.js';
import { ErrorCode } from '../../errors/index.js';

// ============================================================
// Types
// ============================================================

export interface ValidatedUrl {
  original: string;
  normalized: string;
  url: URL;
  domain: string;
  hostname: string;
  protocol: string;
  pathname: string;
  isSecure: boolean;
}

export interface ValidationOptions {
  /** Allow HTTP URLs (default: true, but will prefer HTTPS) */
  allowHttp?: boolean;
  /** Normalize www prefix (default: true - removes www) */
  normalizeWww?: boolean;
  /** Remove trailing slashes (default: true) */
  removeTrailingSlash?: boolean;
  /** Remove tracking parameters (default: true) */
  removeTrackingParams?: boolean;
  /** Upgrade HTTP to HTTPS when possible (default: true) */
  upgradeToHttps?: boolean;
}

const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  allowHttp: true,
  normalizeWww: true,
  removeTrailingSlash: true,
  removeTrackingParams: true,
  upgradeToHttps: true,
};

// ============================================================
// Tracking Parameters to Remove
// ============================================================

/**
 * Common tracking parameters that should be stripped from URLs
 * These don't affect content but are used for analytics/attribution
 */
const TRACKING_PARAMS = new Set([
  // Google Analytics / Ads
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
  'gclid',        // Google Click ID
  'gclsrc',       // Google Click Source
  'dclid',        // DoubleClick ID

  // Facebook
  'fbclid',       // Facebook Click ID
  'fb_action_ids',
  'fb_action_types',
  'fb_source',
  'fb_ref',

  // Microsoft/Bing
  'msclkid',      // Microsoft Click ID

  // Twitter
  'twclid',       // Twitter Click ID

  // HubSpot
  'hsa_acc',
  'hsa_cam',
  'hsa_grp',
  'hsa_ad',
  'hsa_src',
  'hsa_tgt',
  'hsa_kw',
  'hsa_mt',
  'hsa_net',
  'hsa_ver',

  // Mailchimp
  'mc_cid',
  'mc_eid',

  // Adobe Analytics
  's_kwcid',
  'ef_id',

  // General tracking
  'ref',
  'ref_src',
  'source',
  'campaign',
  'affiliate',
  'affid',
  'partner',
  'promo',

  // Social sharing
  '_hsenc',
  '_hsmi',
  'mkt_tok',

  // Other common trackers
  'trk',
  'trkid',
  'yclid',        // Yandex Click ID
  'zanpid',       // Zanox
  'irclickid',    // Impact Radius
]);

// ============================================================
// SSRF Protection
// ============================================================

/**
 * Private IP ranges that should be blocked
 * Prevents SSRF attacks by blocking internal network access
 */
const PRIVATE_IP_PATTERNS = [
  // IPv4 private ranges
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,           // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
  /^192\.168\.\d{1,3}\.\d{1,3}$/,              // 192.168.0.0/16
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,          // 127.0.0.0/8 (loopback)
  /^0\.0\.0\.0$/,                               // 0.0.0.0
  /^169\.254\.\d{1,3}\.\d{1,3}$/,              // 169.254.0.0/16 (link-local)

  // IPv6 private/special ranges (when resolved)
  /^::1$/,                                      // IPv6 loopback
  /^fc[0-9a-f]{2}:/i,                          // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,                          // IPv6 unique local
  /^fe80:/i,                                    // IPv6 link-local
];

/**
 * Blocked hostnames that should never be accessed
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'internal',
  'intranet',
  'local',
  'metadata.google.internal',  // GCP metadata service
  '169.254.169.254',           // AWS/GCP/Azure metadata service
]);

/**
 * Check if a hostname/IP is a private address
 */
function isPrivateIP(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.has(normalizedHost)) {
    return true;
  }

  // Check if hostname ends with a blocked suffix
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (normalizedHost.endsWith(`.${blocked}`)) {
      return true;
    }
  }

  // Check IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  return false;
}

// ============================================================
// URL Validation Functions
// ============================================================

/**
 * Validate basic URL format
 * Throws AppError if URL is malformed
 */
function parseUrl(url: string): URL {
  // Trim whitespace
  const trimmed = url.trim();

  if (!trimmed) {
    throw new AppError('URL cannot be empty', 400, ErrorCode.INVALID_URL);
  }

  // Check for basic URL format
  if (!trimmed.match(/^https?:\/\//i)) {
    // Try to prepend https:// if no protocol
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      throw new AppError('Invalid URL format', 400, ErrorCode.INVALID_URL);
    }
  }

  try {
    return new URL(trimmed);
  } catch {
    throw new AppError('Invalid URL format', 400, ErrorCode.INVALID_URL);
  }
}

/**
 * Validate URL protocol (must be http or https)
 */
function validateProtocol(url: URL, allowHttp: boolean): void {
  const protocol = url.protocol.toLowerCase();

  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new AppError(
      `Invalid protocol: ${protocol}. Only HTTP and HTTPS are allowed.`,
      400,
      ErrorCode.INVALID_PROTOCOL
    );
  }

  if (protocol === 'http:' && !allowHttp) {
    throw new AppError(
      'HTTP URLs are not allowed. Please use HTTPS.',
      400,
      ErrorCode.HTTP_NOT_ALLOWED
    );
  }
}

/**
 * Validate URL for SSRF protection
 */
function validateSSRF(url: URL): void {
  // Check for credentials in URL
  if (url.username || url.password) {
    throw new SSRFError('URLs with credentials are not allowed');
  }

  // Check for private/blocked addresses
  if (isPrivateIP(url.hostname)) {
    log.warn('SSRF attempt blocked', {
      hostname: url.hostname,
    });
    throw new SSRFError('Access to internal network addresses is forbidden');
  }

  // Check for suspicious port numbers
  const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
  const suspiciousPorts = [22, 23, 25, 110, 143, 445, 3306, 5432, 6379, 27017];
  if (suspiciousPorts.includes(port)) {
    log.warn('Suspicious port access blocked', {
      hostname: url.hostname,
      port,
    });
    throw new SSRFError(`Access to port ${port} is not allowed`);
  }
}

// ============================================================
// URL Normalization Functions
// ============================================================

/**
 * Remove tracking parameters from URL
 */
function removeTrackingParams(url: URL): URL {
  const params = new URLSearchParams(url.search);
  let modified = false;

  for (const param of params.keys()) {
    if (TRACKING_PARAMS.has(param.toLowerCase())) {
      params.delete(param);
      modified = true;
    }
  }

  if (modified) {
    url.search = params.toString();
  }

  return url;
}

/**
 * Normalize www prefix (remove or add based on convention)
 */
function normalizeWww(url: URL): URL {
  // Remove www. prefix for consistency
  if (url.hostname.toLowerCase().startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
  }
  return url;
}

/**
 * Remove trailing slash from pathname
 */
function removeTrailingSlash(url: URL): URL {
  // Don't remove if it's just "/"
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url;
}

/**
 * Upgrade HTTP to HTTPS
 * Note: This is a best-effort normalization; actual availability needs to be verified
 */
function upgradeToHttps(url: URL): URL {
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
  }
  return url;
}

/**
 * Normalize URL hash/fragment
 * Remove empty fragments but keep meaningful ones
 */
function normalizeFragment(url: URL): URL {
  // Remove empty or whitespace-only fragments
  if (url.hash === '#' || url.hash.trim() === '#') {
    url.hash = '';
  }
  return url;
}

/**
 * Normalize path segments
 * Handle redundant slashes and dot segments
 */
function normalizePathSegments(url: URL): URL {
  // Replace multiple slashes with single slash
  url.pathname = url.pathname.replace(/\/+/g, '/');

  // The URL constructor already handles . and .. segments
  return url;
}

// ============================================================
// Main Validation Function
// ============================================================

/**
 * Validate and normalize a URL
 *
 * @param urlString - The URL to validate
 * @param options - Validation and normalization options
 * @returns Validated and normalized URL information
 * @throws AppError for invalid URLs
 * @throws SSRFError for blocked URLs
 */
export function validateUrl(
  urlString: string,
  options: ValidationOptions = {}
): ValidatedUrl {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  log.debug('Validating URL', { url: urlString });

  // Parse URL
  let url = parseUrl(urlString);

  // Validate protocol
  validateProtocol(url, opts.allowHttp);

  // SSRF protection
  validateSSRF(url);

  // Store original for reference
  const original = url.href;

  // Apply normalizations
  if (opts.upgradeToHttps) {
    url = upgradeToHttps(url);
  }

  if (opts.normalizeWww) {
    url = normalizeWww(url);
  }

  if (opts.removeTrackingParams) {
    url = removeTrackingParams(url);
  }

  url = normalizePathSegments(url);
  url = normalizeFragment(url);

  if (opts.removeTrailingSlash) {
    url = removeTrailingSlash(url);
  }

  // Extract domain (hostname without www)
  const domain = url.hostname.toLowerCase();

  const result: ValidatedUrl = {
    original,
    normalized: url.href,
    url,
    domain,
    hostname: url.hostname,
    protocol: url.protocol,
    pathname: url.pathname,
    isSecure: url.protocol === 'https:',
  };

  log.debug('URL validated successfully', {
    original,
    normalized: result.normalized,
    domain,
  });

  return result;
}

/**
 * Quick validation check without normalization
 * Returns true if URL is valid and safe, false otherwise
 */
export function isValidUrl(urlString: string): boolean {
  try {
    validateUrl(urlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL without full validation
 * Useful for quick domain checks
 */
export function extractDomain(urlString: string): string | null {
  try {
    const url = parseUrl(urlString);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Check if two URLs point to the same resource (ignoring tracking params)
 */
export function areUrlsEquivalent(url1: string, url2: string): boolean {
  try {
    const validated1 = validateUrl(url1);
    const validated2 = validateUrl(url2);
    return validated1.normalized === validated2.normalized;
  } catch {
    return false;
  }
}

/**
 * Get a list of tracking parameters that were removed
 * Useful for debugging/logging
 */
export function getTrackingParams(urlString: string): string[] {
  try {
    const url = parseUrl(urlString);
    const params = new URLSearchParams(url.search);
    const found: string[] = [];

    for (const param of params.keys()) {
      if (TRACKING_PARAMS.has(param.toLowerCase())) {
        found.push(param);
      }
    }

    return found;
  } catch {
    return [];
  }
}

export default {
  validateUrl,
  isValidUrl,
  extractDomain,
  areUrlsEquivalent,
  getTrackingParams,
};
