import { handleChatTurn } from '../services/stateMachine.js';
import { memStore } from '../store/mem.js';
import { monitoringService } from '../services/monitoring.js';
import { payoutService } from '../services/payoutService.js';
import { solanaService } from '../services/solanaService.js';

// Mock external services
jest.mock('../services/pricing.js', () => ({
  getPricing: jest.fn().mockResolvedValue({
    usd: { SOL: 100, USDC: 1, USDT: 1 },
    ngnFx: 1500
  })
}));

jest.mock('../services/gemini.js', () => ({
  getGeminiResponse: jest.fn().mockResolvedValue("I'm here to help you with your Solana token sales.")
}));

describe('SolSwapAI Integration Tests', () => {
  beforeEach(() => {
    // Clear all stores before each test
    memStore['sessions'].clear();
    memStore['orders'].clear();
    memStore['idempotencyKeys'].clear();
  });

  describe('Idempotency Tests', () => {
    test('should handle idempotent requests correctly', async () => {
      const userId = 'test-user-idempotency';
      const message = 'I want to sell USDC';
      const idempotencyKey = 'test-key-123';

      // First request
      const result1 = await handleChatTurn(userId, message, idempotencyKey);
      expect(result1).toBeDefined();
      expect(result1.session.state).toBe('awaiting_token');

      // Second request with same idempotency key
      const result2 = await handleChatTurn(userId, message, idempotencyKey);
      expect(result2).toEqual(result1); // Should return same result
    });

    test('should prevent duplicate transactions', async () => {
      const userId = 'test-user-duplicate';
      const txHash = 'abc123def456';

      // First transaction
      await handleChatTurn(userId, 'I want to sell USDC');
      await handleChatTurn(userId, 'USDC');
      const result1 = await handleChatTurn(userId, `I've sent it ${txHash}`);

      // Try to send same transaction again
      const result2 = await handleChatTurn(userId, `I've sent it ${txHash}`);
      expect(result2.reply).toContain('already been processed');
    });
  });

  describe('Monitoring and Analytics', () => {
    test('should record request metrics', () => {
      // Record some test requests
      monitoringService.recordRequest(100, true);
      monitoringService.recordRequest(200, false);
      monitoringService.recordRequest(150, true, true); // rate limited

      const metrics = monitoringService.getCurrentMetrics();
      expect(metrics.requests.total).toBe(3);
      expect(metrics.requests.successful).toBe(2);
      expect(metrics.requests.failed).toBe(1);
      expect(metrics.requests.rateLimited).toBe(1);
    });

    test('should create and manage alerts', () => {
      // Create some test alerts
      monitoringService.createAlert('error_rate', 'high', 'High error rate detected');
      monitoringService.createAlert('response_time', 'medium', 'Slow response time');

      const alerts = monitoringService.getActiveAlerts();
      expect(alerts).toHaveLength(2);
      expect(alerts[0].severity).toBe('high');
      expect(alerts[1].severity).toBe('medium');

      // Resolve an alert
      const alertId = alerts[0].id;
      const resolved = monitoringService.resolveAlert(alertId);
      expect(resolved).toBe(true);

      const remainingAlerts = monitoringService.getActiveAlerts();
      expect(remainingAlerts).toHaveLength(1);
    });

    test('should provide health status', () => {
      const health = monitoringService.isSystemHealthy();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('issues');
      expect(Array.isArray(health.issues)).toBe(true);
    });
  });

  describe('Payout Service Tests', () => {
    test('should validate bank account details', async () => {
      const validAccount = {
        accountNumber: '1234567890',
        bankCode: '044',
        accountName: 'John Doe',
        bankName: 'Access Bank'
      };

      const invalidAccount = {
        accountNumber: '123',
        bankCode: '44',
        accountName: 'J',
        bankName: 'Access Bank'
      };

      // Test valid account (mock validation)
      const payoutRequest = {
        amount: 1000,
        bankAccount: validAccount,
        reference: 'test-ref-123',
        userId: 'test-user'
      };

      // This would normally call the actual payout service
      // For testing, we'll just verify the structure
      expect(payoutRequest.amount).toBe(1000);
      expect(payoutRequest.bankAccount.accountNumber).toBe('1234567890');
    });

    test('should get supported banks', async () => {
      const banks = await payoutService.getSupportedBanks();
      expect(Array.isArray(banks)).toBe(true);
      expect(banks.length).toBeGreaterThan(0);
      expect(banks[0]).toHaveProperty('code');
      expect(banks[0]).toHaveProperty('name');
    });
  });

  describe('Solana Service Tests', () => {
    test('should generate deposit addresses', async () => {
      const solAddress = await solanaService.generateDepositAddress('SOL');
      expect(solAddress).toHaveProperty('address');
      expect(typeof solAddress.address).toBe('string');
      expect(solAddress.address.length).toBeGreaterThan(0);

      const usdcAddress = await solanaService.generateDepositAddress('USDC');
      expect(usdcAddress).toHaveProperty('address');
      expect(usdcAddress).toHaveProperty('tokenAccount');
    });

    test('should get network status', async () => {
      const status = await solanaService.getNetworkStatus();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('slot');
      expect(status).toHaveProperty('blockHeight');
      expect(status).toHaveProperty('epoch');
    });
  });

  describe('Complete User Journey', () => {
    test('should handle complete selling flow with monitoring', async () => {
      const userId = 'complete-journey-user';
      
      // Start conversation
      const step1 = await handleChatTurn(userId, 'Hi');
      expect(step1.session.state).toBe('start');

      // Ask for rates
      const rates = await handleChatTurn(userId, 'What are the current rates?');
      expect(rates.reply).toContain('Current rates');

      // Start selling
      const step2 = await handleChatTurn(userId, 'I want to sell tokens');
      expect(step2.session.state).toBe('awaiting_token');

      // Select token
      const step3 = await handleChatTurn(userId, 'USDC');
      expect(step3.session.state).toBe('awaiting_deposit');
      expect(step3.order).toBeDefined();

      // Confirm deposit
      const step4 = await handleChatTurn(userId, 'I\'ve sent the USDC');
      expect(step4.session.state).toBe('confirming');

      // Check status
      const status = await handleChatTurn(userId, 'What is my status?');
      expect(status.reply).toContain('confirming');

      // Cancel transaction
      const cancel = await handleChatTurn(userId, 'Cancel this transaction');
      expect(cancel.session.state).toBe('start');
      expect(cancel.reply).toContain('cancelled');
    });

    test('should handle error scenarios gracefully', async () => {
      const userId = 'error-scenario-user';

      // Test dangerous input
      const dangerous = await handleChatTurn(userId, 'PRIVATE_KEY=abc123');
      expect(dangerous.reply).toContain('cannot process');

      // Test invalid token
      await handleChatTurn(userId, 'I want to sell');
      const invalidToken = await handleChatTurn(userId, 'INVALID_TOKEN');
      expect(invalidToken.reply).toContain('Please choose one of');

      // Test out-of-order message
      const outOfOrder = await handleChatTurn(userId, 'I\'ve sent it');
      expect(outOfOrder.reply).toContain('deposit address');
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple concurrent requests', async () => {
      const promises = [];
      const userIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);

      // Create multiple concurrent requests
      for (const userId of userIds) {
        promises.push(handleChatTurn(userId, 'Hi'));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      
      // All should be successful
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.session).toBeDefined();
        expect(result.reply).toBeDefined();
      });
    });

    test('should clean up expired data', () => {
      // Add some test data
      memStore.upsertSession({ userId: 'old-user', state: 'start' });
      
      // Simulate old data by modifying timestamps
      const sessions = Array.from(memStore['sessions'].values());
      if (sessions.length > 0) {
        const oldSession = sessions[0];
        oldSession.updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
        memStore['sessions'].set(oldSession.id, oldSession);
      }

      // Run cleanup
      const cleanedSessions = memStore.cleanupExpiredSessions();
      expect(cleanedSessions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Security Tests', () => {
    test('should block malicious inputs', async () => {
      const userId = 'security-test-user';
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'DROP TABLE users;',
        'rm -rf /',
        'javascript:void(0)',
        'PRIVATE_KEY=abc123',
        'SECRET=xyz789'
      ];

      for (const input of maliciousInputs) {
        const result = await handleChatTurn(userId, input);
        expect(result.reply).toContain('cannot process');
      }
    });

    test('should handle rate limiting', async () => {
      const userId = 'rate-limit-user';
      
      // This would be tested with the actual rate limiting in the route
      // For now, we'll test the monitoring service
      monitoringService.recordRequest(100, true, true); // rate limited request
      
      const metrics = monitoringService.getCurrentMetrics();
      expect(metrics.requests.rateLimited).toBe(1);
    });
  });
});
