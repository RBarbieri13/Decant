// ============================================================
// Classifier Service Unit Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  getSegmentName,
  getContentTypeName,
} from '../classifier.js';

describe('Classifier Service', () => {
  // Note: classifyContent tests require complex mocking of OpenAI
  // that is challenging with ESM modules. The function is tested
  // via integration tests in the import route tests.

  describe('getSegmentName', () => {
    it('should return correct segment names', () => {
      expect(getSegmentName('A')).toContain('AI');
      expect(getSegmentName('T')).toContain('Technology');
      expect(getSegmentName('F')).toContain('Finance');
      expect(getSegmentName('S')).toContain('Sports');
      expect(getSegmentName('H')).toContain('Health');
      expect(getSegmentName('B')).toContain('Business');
      expect(getSegmentName('E')).toContain('Entertainment');
      expect(getSegmentName('L')).toContain('Lifestyle');
      expect(getSegmentName('X')).toContain('Science');
      expect(getSegmentName('C')).toContain('Creative');
    });

    it('should return Unknown for invalid code', () => {
      expect(getSegmentName('Z')).toBe('Unknown');
      expect(getSegmentName('')).toBe('Unknown');
    });

    it('should handle all valid segment codes', () => {
      const validCodes = ['A', 'T', 'F', 'S', 'H', 'B', 'E', 'L', 'X', 'C'];
      validCodes.forEach(code => {
        expect(getSegmentName(code)).not.toBe('Unknown');
      });
    });
  });

  describe('getContentTypeName', () => {
    it('should return correct content type names', () => {
      expect(getContentTypeName('T')).toContain('Website');
      expect(getContentTypeName('A')).toContain('Article');
      expect(getContentTypeName('V')).toContain('Video');
      expect(getContentTypeName('P')).toContain('Podcast');
      expect(getContentTypeName('R')).toContain('Research');
      expect(getContentTypeName('G')).toContain('Repository');
      expect(getContentTypeName('S')).toContain('Social');
      expect(getContentTypeName('C')).toContain('Course');
      expect(getContentTypeName('I')).toContain('Image');
      expect(getContentTypeName('N')).toContain('Newsletter');
      expect(getContentTypeName('K')).toContain('Book');
      expect(getContentTypeName('U')).toContain('Audio');
    });

    it('should return Unknown for invalid code', () => {
      expect(getContentTypeName('Z')).toBe('Unknown');
      expect(getContentTypeName('')).toBe('Unknown');
    });

    it('should handle all valid content type codes', () => {
      const validCodes = ['T', 'A', 'V', 'P', 'R', 'G', 'S', 'C', 'I', 'N', 'K', 'U'];
      validCodes.forEach(code => {
        expect(getContentTypeName(code)).not.toBe('Unknown');
      });
    });
  });
});
