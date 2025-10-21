import { handleChatTurn } from '../services/stateMachine.js';
import { memStore } from '../store/mem.js';

// Mock the pricing service
jest.mock('../services/pricing.js', () => ({
  getPricing: jest.fn().mockResolvedValue({
    usd: { SOL: 100, USDC: 1, USDT: 1 },
    ngnFx: 1500
  })
}));

// Mock the Gemini service
jest.mock('../services/gemini.js', () => ({
  getGeminiResponse: jest.fn().mockResolvedValue("I'm here to help you with your Solana token sales.")
}));

describe('SolSwapAI Chat System', () => {
  beforeEach(() => {
    // Clear the in-memory store before each test
    memStore['sessions'].clear();
    memStore['orders'].clear();
  });

  describe('State Management', () => {
    test('should not repeat greeting after first interaction', async () => {
      const userId = 'test-user-1';
      
      // First message - should get greeting
      const result1 = await handleChatTurn(userId, 'Hi');
      expect(result1?.reply).toContain('welcome');
      
      // Second message - should NOT repeat greeting
      const result2 = await handleChatTurn(userId, 'I want to sell tokens');
      expect(result2?.reply).not.toContain('welcome');
      expect(result2?.reply).toContain('Which token');
    });

    test('should not re-ask for token after selection', async () => {
      const userId = 'test-user-2';
      
      // Start selling process
      await handleChatTurn(userId, 'I want to sell');
      
      // Select token
      const result1 = await handleChatTurn(userId, 'USDC');
      expect(result1?.reply).toContain('deposit address');
      expect(result1?.session.state).toBe('awaiting_deposit');
      
      // Try to select token again - should not ask again
      const result2 = await handleChatTurn(userId, 'USDC');
      expect(result2?.reply).not.toContain('Which token');
      expect(result2?.reply).toContain('deposit address');
    });

    test('should handle out-of-order messages gracefully', async () => {
      const userId = 'test-user-3';
      
      // User says "I've sent it" without ever getting an address
      const result = await handleChatTurn(userId, 'I\'ve sent it');
      expect(result?.reply).toContain('deposit address');
      expect(result?.session.state).toBe('start');
    });
  });

  describe('Input Validation', () => {
    test('should block dangerous inputs', async () => {
      const userId = 'test-user-4';
      
      const dangerousInputs = [
        'PRIVATE_KEY=abc123',
        '<script>alert("xss")</script>',
        'DROP TABLE users;',
        'rm -rf /'
      ];
      
      for (const input of dangerousInputs) {
        const result = await handleChatTurn(userId, input);
        expect(result?.reply).toContain('cannot process');
      }
    });

    test('should truncate extremely long messages', async () => {
      const userId = 'test-user-5';
      const longMessage = 'A'.repeat(2000);
      
      const result = await handleChatTurn(userId, longMessage);
      expect(result).toBeDefined();
      expect(result?.reply).toBeDefined();
    });
  });

  describe('Conversation Flow', () => {
    test('should handle complete selling flow', async () => {
      const userId = 'test-user-6';
      
      // 1. Start conversation
      const step1 = await handleChatTurn(userId, 'Hi');
      expect(step1?.session.state).toBe('start');
      
      // 2. Express selling intent
      const step2 = await handleChatTurn(userId, 'I want to sell tokens');
      expect(step2?.session.state).toBe('awaiting_token');
      
      // 3. Select token
      const step3 = await handleChatTurn(userId, 'USDC');
      expect(step3?.session.state).toBe('awaiting_deposit');
      expect(step3?.order).toBeDefined();
      expect(step3?.order?.tokenSymbol).toBe('USDC');
      
      // 4. Confirm deposit
      const step4 = await handleChatTurn(userId, 'I\'ve sent it');
      expect(step4?.session.state).toBe('confirming');
    });

    test('should handle rate inquiries at any state', async () => {
      const userId = 'test-user-7';
      
      // Ask for rates in start state
      const result1 = await handleChatTurn(userId, 'What are the current rates?');
      expect(result1?.reply).toContain('Current rates');
      
      // Start selling process
      await handleChatTurn(userId, 'I want to sell');
      await handleChatTurn(userId, 'USDC');
      
      // Ask for rates in awaiting_deposit state
      const result2 = await handleChatTurn(userId, 'What are the rates?');
      expect(result2?.reply).toContain('Current rates');
    });

    test('should handle cancellation', async () => {
      const userId = 'test-user-8';
      
      // Start selling process
      await handleChatTurn(userId, 'I want to sell');
      await handleChatTurn(userId, 'USDC');
      
      // Cancel
      const result = await handleChatTurn(userId, 'Cancel');
      expect(result?.session.state).toBe('start');
      expect(result?.reply).toContain('cancelled');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid token selection', async () => {
      const userId = 'test-user-9';
      
      await handleChatTurn(userId, 'I want to sell');
      
      const result = await handleChatTurn(userId, 'INVALID_TOKEN');
      expect(result?.reply).toContain('Please choose one of');
    });

    test('should handle status requests', async () => {
      const userId = 'test-user-10';
      
      // No active order
      const result1 = await handleChatTurn(userId, 'What is my status?');
      expect(result1?.reply).toContain('no active transactions');
      
      // With active order
      await handleChatTurn(userId, 'I want to sell');
      await handleChatTurn(userId, 'USDC');
      
      const result2 = await handleChatTurn(userId, 'Status?');
      expect(result2?.reply).toContain('transaction is currently');
    });
  });

  describe('Security Features', () => {
    test('should filter secret patterns in responses', async () => {
      const userId = 'test-user-11';
      
      // This would be handled by the response filtering
      const result = await handleChatTurn(userId, 'Hi');
      expect(result?.reply).toBeDefined();
      expect(result?.reply).not.toContain('AIza');
    });
  });
});

// Integration test for the complete flow
describe('Complete Integration Flow', () => {
  test('should handle a complete user journey', async () => {
    const userId = 'integration-test-user';
    
    // 1. User greets
    const greeting = await handleChatTurn(userId, 'Hello');
    expect(greeting?.session.state).toBe('start');
    
    // 2. User asks about rates
    const rates = await handleChatTurn(userId, 'What are the current rates?');
    expect(rates?.reply).toContain('Current rates');
    
    // 3. User wants to sell
    const sellIntent = await handleChatTurn(userId, 'I want to sell some tokens');
    expect(sellIntent?.session.state).toBe('awaiting_token');
    
    // 4. User selects token
    const tokenSelection = await handleChatTurn(userId, 'USDC');
    expect(tokenSelection?.session.state).toBe('awaiting_deposit');
    expect(tokenSelection?.order?.tokenSymbol).toBe('USDC');
    
    // 5. User confirms deposit
    const depositConfirmation = await handleChatTurn(userId, 'I\'ve sent the USDC');
    expect(depositConfirmation?.session.state).toBe('confirming');
    
    // 6. User checks status
    const statusCheck = await handleChatTurn(userId, 'What is my status?');
    expect(statusCheck?.reply).toContain('confirming');
  });
});
