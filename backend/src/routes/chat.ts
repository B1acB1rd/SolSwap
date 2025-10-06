import { Router } from 'express';
import { z } from 'zod';
import { handleChatTurn } from '../services/stateMachine.js';

export const chatRouter = Router();

const chatRequestSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

chatRouter.post('/message', async (req, res) => {
  const parse = chatRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', issues: parse.error.flatten() } });
  }
  const { userId, message } = parse.data;
  const result = handleChatTurn(userId, message);
  return res.json(result);
});


