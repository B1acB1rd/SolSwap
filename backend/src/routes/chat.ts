import { Router } from 'express';
import { z } from 'zod';
import { handleChatTurn } from '../services/stateMachine.js';
import { monitoringService } from '../services/monitoring.js';
import { asyncHandler } from '../services/errorHandler.js';

export const chatRouter = Router();

const chatRequestSchema = z.object({
  userId: z.string().min(1).max(100),
  message: z.string().min(1).max(1000),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string().optional(),
});

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

function checkRateLimit(userId: string, ip: string): { allowed: boolean; remaining: number } {
  const key = `${userId}:${ip}`;
  const now = Date.now();
  const userLimit = rateLimitMap.get(key);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - userLimit.count };
}

// Enhanced chat endpoint with rate limiting, security, and monitoring
chatRouter.post('/message', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Rate limiting
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const { userId } = req.body;
  
  if (userId) {
    const rateLimit = checkRateLimit(userId, clientIp);
    if (!rateLimit.allowed) {
      monitoringService.recordRequest(Date.now() - startTime, false, true);
      return res.status(429).json({ 
        error: { 
          code: 'RATE_LIMIT_EXCEEDED', 
          message: 'Too many requests. Please wait before trying again.',
          retryAfter: 60
        } 
      });
    }
  }
  
  // Input validation
  const parse = chatRequestSchema.safeParse(req.body);
  if (!parse.success) {
    monitoringService.recordRequest(Date.now() - startTime, false);
    monitoringService.recordError('VALIDATION_ERROR', 'medium');
    return res.status(400).json({ 
      error: { 
        code: 'BAD_REQUEST', 
        message: 'Invalid request format',
        issues: parse.error.flatten() 
      } 
    });
  }
  
  const { message, idempotencyKey } = parse.data;
  
  // Additional security checks
  if (message.includes('<script') || message.includes('javascript:')) {
    monitoringService.recordRequest(Date.now() - startTime, false);
    monitoringService.recordError('SECURITY_VIOLATION', 'high');
    return res.status(400).json({ 
      error: { 
        code: 'INVALID_INPUT', 
        message: 'Invalid input detected' 
      } 
    });
  }
  
  try {
    const result = await handleChatTurn(userId, message, idempotencyKey);
    
    // Record successful request
    const duration = Date.now() - startTime;
    monitoringService.recordRequest(duration, true);
    
    console.log(`[CHAT] ${userId} | ${duration}ms | ${message.length} chars`);
    
    return res.json(result);
  } catch (e) {
    const duration = Date.now() - startTime;
    monitoringService.recordRequest(duration, false);
    monitoringService.recordError('CHAT_ERROR', 'high');
    
    console.error('Chat error:', e);
    return res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'An error occurred processing your request.' 
      } 
    });
  }
}));

// Health check endpoint
chatRouter.get('/health', (req, res) => {
  const health = monitoringService.isSystemHealthy();
  const metrics = monitoringService.getCurrentMetrics();
  
  res.json({ 
    status: health.healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    health,
    metrics: {
      requests: metrics.requests,
      performance: metrics.performance
    }
  });
});

// Analytics endpoint
chatRouter.get('/analytics', (req, res) => {
  const dashboardData = monitoringService.getDashboardData();
  
  res.json({
    timestamp: new Date().toISOString(),
    ...dashboardData
  });
});

// Alerts endpoint
chatRouter.get('/alerts', (req, res) => {
  const alerts = monitoringService.getActiveAlerts();
  
  res.json({
    timestamp: new Date().toISOString(),
    alerts,
    count: alerts.length
  });
});

// Resolve alert endpoint
chatRouter.post('/alerts/:alertId/resolve', (req, res) => {
  const { alertId } = req.params;
  const resolved = monitoringService.resolveAlert(alertId);
  
  if (resolved) {
    res.json({ 
      success: true, 
      message: 'Alert resolved',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(404).json({ 
      success: false, 
      message: 'Alert not found' 
    });
  }
});


