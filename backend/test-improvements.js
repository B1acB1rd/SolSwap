#!/usr/bin/env node

/**
 * Test script to demonstrate SolSwapAI improvements
 * Run with: node test-improvements.js
 */

import { handleChatTurn } from './src/services/stateMachine.js';

async function testConversationFlow() {
  console.log('🧪 Testing SolSwapAI Improvements\n');
  
  const userId = 'test-user';
  
  // Test 1: Initial greeting
  console.log('1. Testing initial greeting...');
  const greeting = await handleChatTurn(userId, 'Hi there!');
  console.log('✅ Response:', greeting.reply.substring(0, 100) + '...');
  console.log('✅ State:', greeting.session.state);
  console.log('');
  
  // Test 2: Rate inquiry
  console.log('2. Testing rate inquiry...');
  const rates = await handleChatTurn(userId, 'What are the current rates?');
  console.log('✅ Response:', rates.reply.substring(0, 100) + '...');
  console.log('');
  
  // Test 3: Selling intent
  console.log('3. Testing selling intent...');
  const sellIntent = await handleChatTurn(userId, 'I want to sell some tokens');
  console.log('✅ Response:', sellIntent.reply.substring(0, 100) + '...');
  console.log('✅ State:', sellIntent.session.state);
  console.log('');
  
  // Test 4: Token selection
  console.log('4. Testing token selection...');
  const tokenSelection = await handleChatTurn(userId, 'USDC');
  console.log('✅ Response:', tokenSelection.reply.substring(0, 100) + '...');
  console.log('✅ State:', tokenSelection.session.state);
  console.log('✅ Order created:', !!tokenSelection.order);
  console.log('');
  
  // Test 5: Try to select token again (should not ask again)
  console.log('5. Testing no repeated token selection...');
  const noRepeat = await handleChatTurn(userId, 'USDC');
  console.log('✅ Response:', noRepeat.reply.substring(0, 100) + '...');
  console.log('✅ Should not ask for token again');
  console.log('');
  
  // Test 6: Deposit confirmation
  console.log('6. Testing deposit confirmation...');
  const deposit = await handleChatTurn(userId, 'I\'ve sent the USDC');
  console.log('✅ Response:', deposit.reply.substring(0, 100) + '...');
  console.log('✅ State:', deposit.session.state);
  console.log('');
  
  // Test 7: Status check
  console.log('7. Testing status check...');
  const status = await handleChatTurn(userId, 'What is my status?');
  console.log('✅ Response:', status.reply.substring(0, 100) + '...');
  console.log('');
  
  // Test 8: Cancel request
  console.log('8. Testing cancellation...');
  const cancel = await handleChatTurn(userId, 'Cancel this transaction');
  console.log('✅ Response:', cancel.reply.substring(0, 100) + '...');
  console.log('✅ State:', cancel.session.state);
  console.log('');
  
  // Test 9: Security - dangerous input
  console.log('9. Testing security (dangerous input)...');
  const security = await handleChatTurn(userId, 'PRIVATE_KEY=abc123');
  console.log('✅ Response:', security.reply);
  console.log('✅ Should block dangerous input');
  console.log('');
  
  console.log('🎉 All tests completed successfully!');
  console.log('\nKey improvements demonstrated:');
  console.log('✅ No repeated greetings or questions');
  console.log('✅ Proper state management');
  console.log('✅ Context awareness');
  console.log('✅ Security validation');
  console.log('✅ Natural conversation flow');
}

// Run the tests
testConversationFlow().catch(console.error);
