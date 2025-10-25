import { cache } from '@/lib/cache';

describe('Cache', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('should set and get values', () => {
    cache.set('test-key', { data: 'test' }, 60);
    const result = cache.get('test-key');
    expect(result).toEqual({ data: 'test' });
  });

  it('should return null for expired entries', async () => {
    cache.set('test-key', 'test-value', 1);
    await new Promise(resolve => setTimeout(resolve, 1100));
    const result = cache.get('test-key');
    expect(result).toBeNull();
  });

  it('should delete entries', () => {
    cache.set('test-key', 'test-value', 60);
    cache.delete('test-key');
    const result = cache.get('test-key');
    expect(result).toBeNull();
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1', 60);
    cache.set('key2', 'value2', 60);
    cache.clear();
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });
});
