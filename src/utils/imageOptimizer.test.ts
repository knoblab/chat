import { describe, it, expect } from 'vitest';
import { optimizeImage } from './imageOptimizer';

describe('imageOptimizer', () => {
  it('returns original file unmodified if not an image', async () => {
    const textFile = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    const result = await optimizeImage(textFile);
    expect(result).toBe(textFile);
    expect(result.name).toBe('test.txt');
  });

  it('returns original file unmodified if it is a GIF image (to preserve animations)', async () => {
    const gifFile = new File(['gif data'], 'animated.gif', { type: 'image/gif' });
    const result = await optimizeImage(gifFile);
    expect(result).toBe(gifFile);
  });
});
