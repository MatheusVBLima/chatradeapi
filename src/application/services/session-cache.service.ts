import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface SessionData {
  sessionId: string;
  phone: string;
  cpf?: string;
  userName?: string;
  currentState: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  contextData: Record<string, any>;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

@Injectable()
export class SessionCacheService {
  // Mapa de telefone para sessionId ativo
  private readonly phoneToSessionMap = new Map<string, string>();
  
  // Mapa de sessionId para dados da sessão
  private readonly sessions = new Map<string, SessionData>();
  
  // Configurações
  private readonly INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutos de inatividade
  private readonly MAX_SESSIONS = 5000; // Limite máximo de sessões simultâneas

  /**
   * Cria uma nova sessão para o número de telefone
   * Se já existir uma sessão ativa, ela será finalizada
   */
  createNewSession(phone: string): SessionData {
    // Finalizar sessão anterior se existir
    this.endSession(phone);
    
    // Criar novo ID de sessão único
    const sessionId = `session_${randomUUID()}`;
    
    // Criar dados da nova sessão
    const sessionData: SessionData = {
      sessionId,
      phone,
      currentState: 'START',
      conversationHistory: [],
      contextData: {},
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };
    
    // Implementar limite de sessões (LRU)
    if (this.sessions.size >= this.MAX_SESSIONS) {
      const oldestSession = this.getOldestSession();
      if (oldestSession) {
        this.removeSession(oldestSession.sessionId);
      }
    }
    
    // Armazenar nova sessão
    this.sessions.set(sessionId, sessionData);
    this.phoneToSessionMap.set(phone, sessionId);
    
    console.log(`[SessionCache] Nova sessão criada: ${sessionId} para telefone: ${phone}`);
    
    return sessionData;
  }

  /**
   * Obtém a sessão ativa para um número de telefone
   * Retorna null se não houver sessão ativa
   */
  getActiveSession(phone: string): SessionData | null {
    const sessionId = this.phoneToSessionMap.get(phone);
    
    if (!sessionId) {
      return null;
    }
    
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      // Sessão não existe ou não está ativa
      this.phoneToSessionMap.delete(phone);
      return null;
    }
    
    // Verificar timeout de inatividade
    const now = Date.now();
    const lastActivity = session.lastActivity.getTime();
    
    if (now - lastActivity > this.INACTIVITY_TIMEOUT) {
      console.log(`[SessionCache] Sessão expirou por inatividade: ${sessionId}`);
      this.removeSession(sessionId);
      return null;
    }
    
    // Atualizar última atividade
    session.lastActivity = new Date();
    
    return session;
  }

  /**
   * Obtém ou cria uma sessão para o telefone
   */
  getOrCreateSession(phone: string): SessionData {
    const existingSession = this.getActiveSession(phone);
    
    if (existingSession) {
      return existingSession;
    }
    
    return this.createNewSession(phone);
  }

  /**
   * Atualiza dados de uma sessão existente
   */
  updateSession(sessionId: string, updates: Partial<SessionData>): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return false;
    }
    
    // Atualizar dados
    Object.assign(session, updates, {
      lastActivity: new Date()
    });
    
    return true;
  }

  /**
   * Adiciona uma mensagem ao histórico da conversa
   */
  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return false;
    }
    
    // Limitar histórico a 50 mensagens
    if (session.conversationHistory.length >= 50) {
      session.conversationHistory.splice(0, 2);
    }
    
    session.conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });
    
    session.lastActivity = new Date();
    
    return true;
  }

  /**
   * Finaliza uma sessão ativa
   */
  endSession(phone: string): boolean {
    const sessionId = this.phoneToSessionMap.get(phone);
    
    if (!sessionId) {
      return false;
    }
    
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.isActive = false;
      console.log(`[SessionCache] Sessão finalizada: ${sessionId}`);
    }
    
    // Remover mapeamento e sessão
    this.phoneToSessionMap.delete(phone);
    this.sessions.delete(sessionId);
    
    return true;
  }

  /**
   * Remove uma sessão específica
   */
  private removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      this.phoneToSessionMap.delete(session.phone);
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Obtém a sessão mais antiga (para LRU)
   */
  private getOldestSession(): SessionData | null {
    let oldest: SessionData | null = null;
    
    for (const session of this.sessions.values()) {
      if (!oldest || session.lastActivity < oldest.lastActivity) {
        oldest = session;
      }
    }
    
    return oldest;
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.isActive).length,
      phonesMapped: this.phoneToSessionMap.size
    };
  }
}