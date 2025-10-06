import { memStore } from '../store/mem.js';
import { Order, Session, TokenSymbol } from '../types.js';

const TOKEN_REGEX = /(SOL|USDC|USDT)/i;

export function normalizeTokenSymbol(input: string): TokenSymbol | null {
  const m = input.match(TOKEN_REGEX);
  if (!m) return null;
  const t = m[1].toUpperCase();
  if (t === 'SOL' || t === 'USDC' || t === 'USDT') return t;
  return null;
}

export function handleChatTurn(userId: string, message: string): {
  reply: string;
  session: Session;
  order?: Order;
} {
  const session = memStore.getSessionByUser(userId) ?? memStore.upsertSession({ userId, state: 'start' });
  const lower = message.toLowerCase();

  if (session.state === 'start') {
    if (lower.includes('sell')) {
      const next = memStore.upsertSession({ userId, state: 'awaiting_token' });
      return {
        reply: 'Great! Which token would you like to sell? (SOL, USDC, USDT)',
        session: next,
      };
    }
    return {
      reply: "I'm here to help you sell SOL/USDC/USDT for NGN. Say 'sell' to begin.",
      session,
    };
  }

  if (session.state === 'awaiting_token') {
    const token = normalizeTokenSymbol(message);
    if (!token) {
      return { reply: 'Please choose one of: SOL, USDC, USDT.', session };
    }
    // Create order stub
    const id = crypto.randomUUID();
    const order: Omit<Order, 'createdAt' | 'updatedAt'> = {
      id,
      userId,
      tokenSymbol: token,
      depositAddress: 'DEPOSIT_ADDR_STUB',
      depositTokenAccount: token === 'SOL' ? null : 'ATA_STUB',
      status: 'awaiting_deposit',
      fromAddress: null,
      amountToken: null,
      amountNgn: null,
      priceUsd: null,
      ngnFx: null,
      spreadBps: null,
      txSignature: null,
      bankAccount: null,
      payoutReference: null,
      expiresAt: null,
    };
    const saved = memStore.insertOrder(order);
    const next = memStore.upsertSession({ userId, state: 'awaiting_deposit', orderId: saved.id });
    return {
      reply: `Please send your ${token} to this address: ${saved.depositAddress}. After sending, reply with the wallet address you sent from.`,
      session: next,
      order: saved,
    };
  }

  if (session.state === 'awaiting_deposit') {
    // Capture from-address loosely
    const addr = message.trim();
    if (!session.orderId) {
      return { reply: 'No active order found. Say sell to begin a new order.', session };
    }
    const order = memStore.updateOrder(session.orderId, { fromAddress: addr, status: 'confirming' });
    if (!order) return { reply: 'Order not found.', session };
    const next = memStore.upsertSession({ userId, state: 'confirming' });
    return {
      reply: 'Thanks! I am verifying your deposit on Solana. I will update you shortly.',
      session: next,
      order,
    };
  }

  if (session.state === 'confirming') {
    return {
      reply: 'Still confirming your transaction on-chain. I will notify you once it is finalized.',
      session,
    };
  }

  return { reply: 'Please say sell to start a new order.', session };
}


