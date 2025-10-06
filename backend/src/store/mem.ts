import { Order, Session } from '../types.js';

const sessions = new Map<string, Session>();
const orders = new Map<string, Order>();

const nowIso = () => new Date().toISOString();

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
};


