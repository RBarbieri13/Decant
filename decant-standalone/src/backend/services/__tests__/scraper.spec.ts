// ============================================================
// Scraper Service Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeUrl, type ScrapedContent } from '../scraper.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Scraper Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scrapeUrl', () => {
    it('should scrape basic page metadata', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page Title</title>
          <meta name="description" content="Test page description">
          <meta name="author" content="John Doe">
          <link rel="icon" href="/favicon.ico">
        </head>
        <body>
          <article>
            <h1>Article Heading</h1>
            <p>This is the main article content that should be extracted.</p>
          </article>
        </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/test');

      expect(result.url).toBe('https://example.com/test');
      expect(result.title).toBe('Test Page Title');
      expect(result.description).toBe('Test page description');
      expect(result.author).toBe('John Doe');
      expect(result.domain).toBe('example.com');
    });

    it('should extract OpenGraph metadata', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fallback Title</title>
          <meta property="og:title" content="OpenGraph Title">
          <meta property="og:description" content="OpenGraph description">
          <meta property="og:site_name" content="OG Site Name">
          <meta property="og:image" content="https://example.com/og-image.jpg">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/og');

      expect(result.title).toBe('OpenGraph Title');
      expect(result.description).toBe('OpenGraph description');
      expect(result.siteName).toBe('OG Site Name');
      expect(result.image).toBe('https://example.com/og-image.jpg');
    });

    it('should extract Twitter card metadata', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fallback Title</title>
          <meta name="twitter:title" content="Twitter Title">
          <meta name="twitter:description" content="Twitter description">
          <meta name="twitter:image" content="https://example.com/twitter-image.jpg">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/twitter');

      expect(result.title).toBe('Twitter Title');
      expect(result.description).toBe('Twitter description');
      expect(result.image).toBe('https://example.com/twitter-image.jpg');
    });

    it('should handle missing title gracefully', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body>
          <h1>Main Heading</h1>
          <p>Content</p>
        </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/no-title');

      expect(result.title).toBe('Main Heading');
    });

    it('should return Untitled when no title found', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body><p>Just some content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/untitled');

      expect(result.title).toBe('Untitled');
    });

    it('should extract favicon URL', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <link rel="icon" href="/my-favicon.ico">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/favicon');

      expect(result.favicon).toBe('https://example.com/my-favicon.ico');
    });

    it('should default to /favicon.ico when no icon link found', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/default-favicon');

      expect(result.favicon).toBe('https://example.com/favicon.ico');
    });

    it('should resolve relative URLs correctly', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <link rel="icon" href="/icons/favicon.png">
          <meta property="og:image" content="/images/og.jpg">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/relative');

      expect(result.favicon).toBe('https://example.com/icons/favicon.png');
      expect(result.image).toBe('https://example.com/images/og.jpg');
    });

    it('should handle protocol-relative URLs', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <meta property="og:image" content="//cdn.example.com/image.jpg">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/protocol-relative');

      expect(result.image).toBe('https://cdn.example.com/image.jpg');
    });

    it('should extract main content from article element', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <nav>Navigation content to ignore</nav>
          <article>
            <p>This is the main article content that should be extracted for AI analysis.</p>
            <p>More important content here.</p>
          </article>
          <footer>Footer content to ignore</footer>
        </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/article');

      expect(result.content).toContain('main article content');
      expect(result.content).not.toContain('Navigation');
      expect(result.content).not.toContain('Footer');
    });

    it('should strip www from domain', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://www.example.com/test');

      expect(result.domain).toBe('example.com');
    });

    it('should throw error for failed fetch', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(scrapeUrl('https://example.com/not-found'))
        .rejects.toThrow('Failed to fetch URL: 404 Not Found');
    });

    it('should throw error for invalid URL', async () => {
      await expect(scrapeUrl('not-a-url'))
        .rejects.toThrow();
    });

    it('should extract article:author metadata', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <meta property="article:author" content="Jane Smith">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/article-author');

      expect(result.author).toBe('Jane Smith');
    });

    it('should extract application-name as site name fallback', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <meta name="application-name" content="My App">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/app-name');

      expect(result.siteName).toBe('My App');
    });

    it('should limit content to 5000 characters', async () => {
      const longContent = 'A'.repeat(10000);
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body><article>${longContent}</article></body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/long-content');

      expect(result.content!.length).toBeLessThanOrEqual(5000);
    });

    it('should clean whitespace in extracted text', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <article>
            <p>Content   with    lots     of    spaces</p>
            <p>And


            multiple
            newlines</p>
          </article>
        </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl('https://example.com/whitespace');

      expect(result.content).not.toContain('  ');
      expect(result.content).not.toContain('\n');
    });

    it('should handle fetch with User-Agent header', async () => {
      const html = `<html><head><title>Test</title></head><body><p>OK</p></body></html>`;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html),
      });

      await scrapeUrl('https://example.com/ua');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/ua',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
          }),
        })
      );
    });
  });
});
