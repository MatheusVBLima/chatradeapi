import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      service.set(key, value);
      const retrieved = service.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return undefined for non-existent key', () => {
      const retrieved = service.get('non-existent-key');
      expect(retrieved).toBeUndefined();
    });

    it('should expire value after TTL', async () => {
      const key = 'expiring-key';
      const value = 'expiring-value';
      const ttl = 100; // 100ms

      service.set(key, value, ttl);

      // Value should exist immediately
      expect(service.get(key)).toBe(value);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, ttl + 50));

      // Value should be expired
      expect(service.get(key)).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete a value', () => {
      const key = 'delete-key';
      const value = 'delete-value';

      service.set(key, value);
      expect(service.get(key)).toBe(value);

      service.delete(key);
      expect(service.get(key)).toBeUndefined();
    });

    it('should handle deleting non-existent key', () => {
      expect(() => service.delete('non-existent')).not.toThrow();
    });
  });

  describe('cache size limit', () => {
    it('should respect max cache size', () => {
      // This test would require accessing private properties
      // or exposing a method to check cache size
      // For now, we'll just ensure setting many values doesn't break
      for (let i = 0; i < 1100; i++) {
        service.set(`key-${i}`, `value-${i}`);
      }

      // Should not throw and latest value should exist
      expect(service.get('key-1099')).toBe('value-1099');
    });
  });
});
