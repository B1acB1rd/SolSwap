import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';
import { ordersRouter } from './routes/orders.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/chat', chatRouter);
  app.use('/orders', ordersRouter);

  app.post('/webhooks/payout', (req, res) => {
    // TODO: verify provider signature header against WEBHOOK_SECRET
    // For stub, accept and return 200
    return res.json({ ok: true });
  });

  return app;
}


