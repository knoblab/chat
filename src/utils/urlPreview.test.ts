import { describe, it, expect } from 'vitest';
import { URL_REGEX } from './urlPreview';

describe('urlPreview utility', () => {
  describe('URL_REGEX', () => {
    it('should match standard HTTP and HTTPS URLs', () => {
      const text = 'Check out https://github.com and http://example.com/foo/bar';
      const matches = [...text.matchAll(URL_REGEX)].map(m => m[0]);
      
      expect(matches).toHaveLength(2);
      expect(matches[0]).toBe('https://github.com');
      expect(matches[1]).toBe('http://example.com/foo/bar');
    });

    it('should ignore trailing periods, commas, and question marks', () => {
      const text = 'Go to https://google.com. Did you see http://matrix.org? Link: http://test.com, end.';
      const matches = [...text.matchAll(URL_REGEX)].map(m => m[0]);

      expect(matches).toHaveLength(3);
      expect(matches[0]).toBe('https://google.com');
      expect(matches[1]).toBe('http://matrix.org');
      expect(matches[2]).toBe('http://test.com');
    });

    it('should match URLs with query parameters and hash fragments', () => {
      const text = 'Here is a link: https://youtube.com/watch?v=12345#t=10s';
      const matches = [...text.matchAll(URL_REGEX)].map(m => m[0]);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe('https://youtube.com/watch?v=12345#t=10s');
    });

    it('should match URLs with port numbers', () => {
      const text = 'Open http://localhost:8080/dashboard';
      const matches = [...text.matchAll(URL_REGEX)].map(m => m[0]);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe('http://localhost:8080/dashboard');
    });
  });
});
