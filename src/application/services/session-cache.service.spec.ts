import { Test, TestingModule } from '@nestjs/testing';
import { SessionCacheService } from './session-cache.service';

describe('SessionCacheService', () => {
  let service: SessionCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionCacheService],
    }).compile();

    service = module.get<SessionCacheService>(SessionCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNewSession', () => {
    it('should create a new session', () => {
      const phone = '5511999999999';
      const session = service.createNewSession(phone);

      expect(session).toBeDefined();
      expect(session.phone).toBe(phone);
      expect(session.currentState).toBe('START');
      expect(session.isActive).toBe(true);
      expect(session.conversationHistory).toEqual([]);
    });

    it('should end previous session when creating new one', () => {
      const phone = '5511999999999';

      const firstSession = service.createNewSession(phone);
      const secondSession = service.createNewSession(phone);

      expect(firstSession.sessionId).not.toBe(secondSession.sessionId);
      expect(service.getActiveSession(phone)?.sessionId).toBe(secondSession.sessionId);
    });
  });

  describe('getActiveSession', () => {
    it('should return active session', () => {
      const phone = '5511999999999';
      const created = service.createNewSession(phone);

      const retrieved = service.getActiveSession(phone);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(created.sessionId);
    });

    it('should return null for non-existent session', () => {
      const retrieved = service.getActiveSession('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should update last activity when getting session', () => {
      const phone = '5511999999999';
      const session = service.createNewSession(phone);
      const initialActivity = session.lastActivity;

      // Wait a bit
      setTimeout(() => {
        const retrieved = service.getActiveSession(phone);
        expect(retrieved?.lastActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
      }, 10);
    });
  });

  describe('getOrCreateSession', () => {
    it('should return existing session if active', () => {
      const phone = '5511999999999';
      const created = service.createNewSession(phone);

      const retrieved = service.getOrCreateSession(phone);

      expect(retrieved.sessionId).toBe(created.sessionId);
    });

    it('should create new session if none exists', () => {
      const phone = '5511999999999';
      const session = service.getOrCreateSession(phone);

      expect(session).toBeDefined();
      expect(session.phone).toBe(phone);
    });
  });

  describe('updateSession', () => {
    it('should update session data', () => {
      const phone = '5511999999999';
      const session = service.createNewSession(phone);

      const updated = service.updateSession(session.sessionId, {
        cpf: '12345678901',
        userName: 'Test User',
      });

      expect(updated).toBe(true);

      const retrieved = service.getActiveSession(phone);
      expect(retrieved?.cpf).toBe('12345678901');
      expect(retrieved?.userName).toBe('Test User');
    });

    it('should return false for non-existent session', () => {
      const updated = service.updateSession('non-existent-id', { cpf: '123' });
      expect(updated).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation history', () => {
      const phone = '5511999999999';
      const session = service.createNewSession(phone);

      const added = service.addMessage(session.sessionId, 'user', 'Hello!');
      expect(added).toBe(true);

      const retrieved = service.getActiveSession(phone);
      expect(retrieved?.conversationHistory).toHaveLength(1);
      expect(retrieved?.conversationHistory[0].role).toBe('user');
      expect(retrieved?.conversationHistory[0].content).toBe('Hello!');
    });

    it('should limit conversation history to 50 messages', () => {
      const phone = '5511999999999';
      const session = service.createNewSession(phone);

      // Add 60 messages
      for (let i = 0; i < 60; i++) {
        service.addMessage(session.sessionId, 'user', `Message ${i}`);
      }

      const retrieved = service.getActiveSession(phone);
      expect(retrieved?.conversationHistory.length).toBeLessThanOrEqual(50);
    });
  });

  describe('endSession', () => {
    it('should end active session', () => {
      const phone = '5511999999999';
      service.createNewSession(phone);

      const ended = service.endSession(phone);
      expect(ended).toBe(true);

      const retrieved = service.getActiveSession(phone);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const ended = service.endSession('non-existent');
      expect(ended).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      service.createNewSession('5511111111111');
      service.createNewSession('5511222222222');

      const stats = service.getStats();

      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.phonesMapped).toBe(2);
    });
  });
});
