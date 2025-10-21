import { Order, Session } from '../types.js';

const sessions = new Map<string, Session>();
const orders = new Map<string, Order>();
const idempotencyKeys = new Map<string, { timestamp: number; result: any }>();

const nowIso = () => new Date().toISOString();

// Idempotency configuration
const IDEMPOTENCY_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_IDEMPOTENCY_ENTRIES = 1000;

// Clean up old idempotency entries
function cleanupIdempotency() {
  const now = Date.now();
  const entries = Array.from(idempotencyKeys.entries());
  
  // Remove entries older than the window
  entries.forEach(([key, value]) => {
    if (now - value.timestamp > IDEMPOTENCY_WINDOW) {
      idempotencyKeys.delete(key);
    }
  });
  
  // If still too many entries, remove oldest ones
  if (idempotencyKeys.size > MAX_IDEMPOTENCY_ENTRIES) {
    const sortedEntries = entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, idempotencyKeys.size - MAX_IDEMPOTENCY_ENTRIES);
    
    sortedEntries.forEach(([key]) => idempotencyKeys.delete(key));
  }
}

export const memStore = {
  upsertSession(partial: Partial<Session> & { userId: string }): Session {
    const existing = Array.from(sessions.values()).find((s) => s.userId === partial.userId);
    const base: Session = existing ?? {
      id: crypto.randomUUID(),
      userId: partial.userId,
      state: 'start',
      orderId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const next: Session = {
      ...base,
      ...partial,
      updatedAt: nowIso(),
    } as Session;
    sessions.set(next.id, next);
    return next;
  },
  
  getSessionByUser(userId: string): Session | undefined {
    return Array.from(sessions.values()).find((s) => s.userId === userId);
  },

  insertOrder(order: Omit<Order, 'createdAt' | 'updatedAt'>): Order {
    const next: Order = { ...order, createdAt: nowIso(), updatedAt: nowIso() };
    orders.set(next.id, next);
    return next;
  },
  
  updateOrder(id: string, partial: Partial<Order>): Order | undefined {
    const existing = orders.get(id);
    if (!existing) return undefined;
    const next: Order = { ...existing, ...partial, updatedAt: nowIso() };
    orders.set(id, next);
    return next;
  },
  
  getOrder(id: string): Order | undefined {
    return orders.get(id);
  },

  // Idempotency management
  checkIdempotency(key: string): { exists: boolean; result?: any } {
    cleanupIdempotency();
    const entry = idempotencyKeys.get(key);
    if (entry) {
      return { exists: true, result: entry.result };
    }
    return { exists: false };
  },

  setIdempotency(key: string, result: any): void {
    idempotencyKeys.set(key, {
      timestamp: Date.now(),
      result: result
    });
  },

  // Duplicate prevention
  checkDuplicateTransaction(txHash: string): boolean {
    const existingOrder = Array.from(orders.values()).find(
      order => order.txSignature === txHash
    );
    return !!existingOrder;
  },

  checkDuplicatePayout(userId: string, amount: string, timestamp: string): boolean {
    const recentPayouts = Array.from(orders.values()).filter(
      order => order.userId === userId && 
      order.amountNgn === amount &&
      order.status === 'paid' &&
      new Date(order.updatedAt).getTime() > Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    );
    return recentPayouts.length > 0;
  },

  // Analytics and monitoring
  getAnalytics(): {
    totalSessions: number;
    totalOrders: number;
    activeSessions: number;
    completedOrders: number;
    failedOrders: number;
  } {
    const allSessions = Array.from(sessions.values());
    const allOrders = Array.from(orders.values());
    
    return {
      totalSessions: allSessions.length,
      totalOrders: allOrders.length,
      activeSessions: allSessions.filter(s => s.state !== 'start').length,
      completedOrders: allOrders.filter(o => o.status === 'paid').length,
      failedOrders: allOrders.filter(o => o.status === 'failed').length
    };
  },

  // Cleanup methods
  cleanupExpiredSessions(): number {
    const expired = Array.from(sessions.values()).filter(
      session => {
        const sessionAge = Date.now() - new Date(session.updatedAt).getTime();
        return sessionAge > (24 * 60 * 60 * 1000); // 24 hours
      }
    );
    
    expired.forEach(session => sessions.delete(session.id));
    return expired.length;
  },

  cleanupExpiredOrders(): number {
    const expired = Array.from(orders.values()).filter(
      order => {
        const orderAge = Date.now() - new Date(order.createdAt).getTime();
        return orderAge > (7 * 24 * 60 * 60 * 1000) && order.status === 'awaiting_deposit'; // 7 days
      }
    );
    
    expired.forEach(order => orders.delete(order.id));
    return expired.length;
  }
};


