import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';
import { ordersRouter } from './routes/orders.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Basic request logging (replace with real logger in prod)
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/chat', chatRouter);
  app.use('/orders', ordersRouter);

  app.post('/webhooks/payout', (req, res) => {
    // TODO: verify provider signature header against WEBHOOK_SECRET
    // For stub, accept and return 200
    return res.json({ ok: true });
  });

  // Basic error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An error occurred.' } });
  });

  return app;
}


