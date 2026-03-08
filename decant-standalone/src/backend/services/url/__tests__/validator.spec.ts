// ============================================================
// URL Validator — Unit Tests
// Covers validation, SSRF protection, normalization, and helpers
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import {
  validateUrl,
  isValidUrl,
  extractDomain,
  areUrlsEquivalent,
  getTrackingParams,
} from '../validator.js';

// Suppress logger output
vi.mock('../../../logger/index.js', () => ({
  log: {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

// ============================================================
// validateUrl — Basic Parsing
// ============================================================

describe('validateUrl', () => {
  describe('basic valid URLs', () => {
    it('accepts a plain HTTPS URL', () => {
      const result = validateUrl('https://example.com/path');
      expect(result.isSecure).toBe(true);
      expect(result.hostname).toBe('example.com');
      expect(result.pathname).toBe('/path');
    });

    it('accepts an HTTP URL by default', () => {
      const result = validateUrl('http://example.com');
      expect(result.protocol).toBe('https:'); // upgraded
    });

    it('prepends https:// when protocol is missing', () => {
      const result = validateUrl('example.com/page');
      expect(result.isSecure).toBe(true);
      expect(result.hostname).toBe('example.com');
    });

    it('preserves query params that are not tracking', () => {
      const result = validateUrl('https://example.com/search?q=test&page=2');
      expect(result.normalized).toContain('q=test');
      expect(result.normalized).toContain('page=2');
    });

    it('returns original before normalization', () => {
      const result = validateUrl('https://www.example.com/?utm_source=google');
      expect(result.original).toContain('www.example.com');
    });
  });

  // ============================================================
  // Protocol Validation
  // ============================================================

  describe('protocol validation', () => {
    it('rejects ftp:// protocol', () => {
      expect(() => validateUrl('ftp://example.com')).toThrow();
    });

    it('rejects file:// protocol', () => {
      expect(() => validateUrl('file:///etc/passwd')).toThrow();
    });

    it('rejects javascript: URI', () => {
      expect(() => validateUrl('javascript:alert(1)')).toThrow();
    });

    it('rejects HTTP when allowHttp is false', () => {
      expect(() =>
        validateUrl('http://example.com', { allowHttp: false })
      ).toThrow(/HTTP/i);
    });

    it('allows HTTP when allowHttp is true (default)', () => {
      // Should not throw; will be upgraded to https
      const result = validateUrl('http://example.com', { allowHttp: true });
      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // SSRF Protection
  // ============================================================

  describe('SSRF protection', () => {
    const ssrfHosts = [
      'http://localhost',
      'http://127.0.0.1',
      'http://0.0.0.0',
      'http://10.0.0.1',
      'http://10.255.255.255',
      'http://172.16.0.1',
      'http://172.31.255.255',
      'http://192.168.0.1',
      'http://192.168.255.255',
      'http://169.254.169.254',  // AWS/GCP metadata
      'http://metadata.google.internal',
    ];

    for (const url of ssrfHosts) {
      it(`blocks private/internal address: ${url}`, () => {
        expect(() => validateUrl(url)).toThrow();
      });
    }

    it('blocks URLs with credentials (username)', () => {
      expect(() => validateUrl('https://user:pass@example.com')).toThrow();
    });

    it('blocks SSH port (22)', () => {
      expect(() => validateUrl('https://example.com:22')).toThrow();
    });

    it('blocks MySQL port (3306)', () => {
      expect(() => validateUrl('https://example.com:3306')).toThrow();
    });

    it('blocks Redis port (6379)', () => {
      expect(() => validateUrl('https://example.com:6379')).toThrow();
    });

    it('allows standard HTTPS port (443)', () => {
      expect(() => validateUrl('https://example.com:443')).not.toThrow();
    });

    it('allows standard HTTP port (80)', () => {
      expect(() => validateUrl('http://example.com:80')).not.toThrow();
    });
  });

  // ============================================================
  // URL Normalization
  // ============================================================

  describe('normalization: HTTPS upgrade', () => {
    it('upgrades http to https by default', () => {
      const result = validateUrl('http://example.com/page');
      expect(result.isSecure).toBe(true);
      expect(result.protocol).toBe('https:');
    });

    it('skips upgrade when upgradeToHttps is false', () => {
      const result = validateUrl('http://example.com/page', { upgradeToHttps: false });
      expect(result.isSecure).toBe(false);
      expect(result.protocol).toBe('http:');
    });
  });

  describe('normalization: www removal', () => {
    it('removes www. by default', () => {
      const result = validateUrl('https://www.example.com/');
      expect(result.hostname).toBe('example.com');
      expect(result.domain).toBe('example.com');
    });

    it('keeps www. when normalizeWww is false', () => {
      const result = validateUrl('https://www.example.com/', { normalizeWww: false });
      expect(result.hostname).toBe('www.example.com');
    });

    it('does not affect non-www subdomains', () => {
      const result = validateUrl('https://docs.example.com/');
      expect(result.hostname).toBe('docs.example.com');
    });
  });

  describe('normalization: trailing slash removal', () => {
    it('removes trailing slash from path', () => {
      const result = validateUrl('https://example.com/path/');
      expect(result.pathname).toBe('/path');
    });

    it('keeps lone slash (root path)', () => {
      const result = validateUrl('https://example.com/');
      expect(result.pathname).toBe('/');
    });

    it('keeps trailing slash when removeTrailingSlash is false', () => {
      const result = validateUrl('https://example.com/path/', {
        removeTrailingSlash: false,
      });
      expect(result.pathname).toBe('/path/');
    });
  });

  describe('normalization: tracking parameter removal', () => {
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'gclid',
      'fbclid',
      'msclkid',
      'twclid',
      'mc_cid',
    ];

    for (const param of trackingParams) {
      it(`removes tracking parameter: ${param}`, () => {
        const result = validateUrl(`https://example.com/page?${param}=value&keep=this`);
        expect(result.normalized).not.toContain(param);
        expect(result.normalized).toContain('keep=this');
      });
    }

    it('removes multiple tracking params at once', () => {
      const result = validateUrl(
        'https://example.com/page?utm_source=google&utm_medium=cpc&q=search'
      );
      expect(result.normalized).not.toContain('utm_source');
      expect(result.normalized).not.toContain('utm_medium');
      expect(result.normalized).toContain('q=search');
    });

    it('keeps tracking params when removeTrackingParams is false', () => {
      const result = validateUrl('https://example.com/?utm_source=test', {
        removeTrackingParams: false,
      });
      expect(result.normalized).toContain('utm_source=test');
    });
  });

  describe('normalization: path segments', () => {
    it('collapses double slashes in path', () => {
      const result = validateUrl('https://example.com//double//slashes');
      expect(result.pathname).toBe('/double/slashes');
    });
  });

  describe('normalization: empty fragment', () => {
    it('removes empty fragment', () => {
      const result = validateUrl('https://example.com/page#');
      expect(result.normalized).not.toContain('#');
    });

    it('keeps meaningful fragments', () => {
      const result = validateUrl('https://example.com/page#section-1');
      expect(result.normalized).toContain('#section-1');
    });
  });

  // ============================================================
  // Return value structure
  // ============================================================

  describe('return value', () => {
    it('populates all fields', () => {
      const result = validateUrl('https://example.com/path?q=1');
      expect(result.original).toBeDefined();
      expect(result.normalized).toBeDefined();
      expect(result.url).toBeInstanceOf(URL);
      expect(result.domain).toBe('example.com');
      expect(result.hostname).toBe('example.com');
      expect(result.protocol).toBe('https:');
      expect(result.pathname).toBe('/path');
      expect(result.isSecure).toBe(true);
    });

    it('domain strips www even when normalizeWww strips it', () => {
      const result = validateUrl('https://www.github.com/user/repo');
      expect(result.domain).toBe('github.com');
    });
  });
});

// ============================================================
// isValidUrl
// ============================================================

describe('isValidUrl', () => {
  it('returns true for valid public URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('returns false for localhost', () => {
    expect(isValidUrl('http://localhost')).toBe(false);
  });

  it('returns false for internal IP', () => {
    expect(isValidUrl('http://192.168.1.1')).toBe(false);
  });

  it('returns false for ftp URL', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });
});

// ============================================================
// extractDomain
// ============================================================

describe('extractDomain', () => {
  it('extracts domain from HTTPS URL', () => {
    expect(extractDomain('https://www.github.com/user/repo')).toBe('github.com');
  });

  it('extracts domain from HTTP URL', () => {
    expect(extractDomain('http://example.com')).toBe('example.com');
  });

  it('removes www prefix', () => {
    expect(extractDomain('https://www.example.com')).toBe('example.com');
  });

  it('preserves subdomains other than www', () => {
    expect(extractDomain('https://api.example.com/v1')).toBe('api.example.com');
  });

  it('returns null for invalid URL', () => {
    expect(extractDomain('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractDomain('')).toBeNull();
  });
});

// ============================================================
// areUrlsEquivalent
// ============================================================

describe('areUrlsEquivalent', () => {
  it('treats URLs identical after normalization as equivalent', () => {
    expect(
      areUrlsEquivalent(
        'https://example.com/page?utm_source=twitter',
        'https://example.com/page'
      )
    ).toBe(true);
  });

  it('treats different paths as non-equivalent', () => {
    expect(
      areUrlsEquivalent('https://example.com/page1', 'https://example.com/page2')
    ).toBe(false);
  });

  it('treats www and non-www as equivalent after normalization', () => {
    expect(
      areUrlsEquivalent('https://www.example.com/page', 'https://example.com/page')
    ).toBe(true);
  });

  it('treats http and https as equivalent after upgrade', () => {
    expect(
      areUrlsEquivalent('http://example.com/page', 'https://example.com/page')
    ).toBe(true);
  });

  it('returns false when either URL is invalid', () => {
    expect(areUrlsEquivalent('http://localhost', 'https://example.com')).toBe(false);
    expect(areUrlsEquivalent('https://example.com', 'not-a-url')).toBe(false);
  });

  it('treats URLs with same content query params as non-equivalent', () => {
    expect(
      areUrlsEquivalent('https://example.com/search?q=foo', 'https://example.com/search?q=bar')
    ).toBe(false);
  });
});

// ============================================================
// getTrackingParams
// ============================================================

describe('getTrackingParams', () => {
  it('returns empty array when no tracking params present', () => {
    expect(getTrackingParams('https://example.com/page?q=test')).toEqual([]);
  });

  it('identifies a single tracking param', () => {
    const params = getTrackingParams('https://example.com/?utm_source=google');
    expect(params).toContain('utm_source');
  });

  it('identifies multiple tracking params', () => {
    const params = getTrackingParams(
      'https://example.com/?utm_source=google&fbclid=abc&q=keep'
    );
    expect(params).toContain('utm_source');
    expect(params).toContain('fbclid');
    expect(params).not.toContain('q');
  });

  it('is case-insensitive for param names', () => {
    const params = getTrackingParams('https://example.com/?UTM_SOURCE=google');
    expect(params).toContain('UTM_SOURCE');
  });

  it('returns empty array for invalid URL', () => {
    expect(getTrackingParams('not-a-url')).toEqual([]);
  });
});
