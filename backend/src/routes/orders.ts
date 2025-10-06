import { Router } from 'express';
import { z } from 'zod';
import { memStore } from '../store/mem.js';
import { Order } from '../types.js';
import { getPayoutService, parseBankAccount } from '../services/payout.js';

export const ordersRouter = Router();

const createSchema = z.object({
  userId: z.string().min(1),
  tokenSymbol: z.enum(['SOL', 'USDC', 'USDT']),
});

ordersRouter.post('/', (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { userId, tokenSymbol } = parse.data;

  const id = crypto.randomUUID();
  const order: Omit<Order, 'createdAt' | 'updatedAt'> = {
    id,
    userId,
    tokenSymbol,
    depositAddress: 'DEPOSIT_ADDR_STUB',
    depositTokenAccount: tokenSymbol === 'SOL' ? null : 'ATA_STUB',
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
  res.json(saved);
});

ordersRouter.get('/:id', (req, res) => {
  const found = memStore.getOrder(req.params.id);
  if (!found) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
  res.json(found);
});

ordersRouter.post('/:id/bank', (req, res) => {
  const order = memStore.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
  const bankAccount = String(req.body?.bankAccount || '').trim();
  const parsed = parseBankAccount(bankAccount);
  if (!parsed) return res.status(400).json({ error: { code: 'BANK_DETAILS_INVALID' } });
  const updated = memStore.updateOrder(order.id, { bankAccount, status: 'ready_to_pay' });
  return res.json(updated);
});

ordersRouter.post('/:id/payout', async (req, res) => {
  const order = memStore.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
  if (order.status !== 'ready_to_pay' || !order.bankAccount || !order.amountNgn) {
    return res.status(400).json({ error: { code: 'NOT_READY' } });
  }
  const parsed = parseBankAccount(order.bankAccount);
  if (!parsed) return res.status(400).json({ error: { code: 'BANK_DETAILS_INVALID' } });
  const service = getPayoutService();
  const { recipientCode } = await service.createRecipient(parsed.accountNumber, parsed.bankCode);
  const amountKobo = Math.round(parseFloat(order.amountNgn) * 100);
  const result = await service.initiateTransfer(recipientCode, amountKobo, `Order ${order.id}`);
  const updated = memStore.updateOrder(order.id, { payoutReference: result.reference, status: 'paid' });
  return res.json(updated);
});


