
import { memStore } from '../store/mem.js';
import { Order, Session, TokenSymbol } from '../types.js';
import { getPricing } from './pricing.js';
import { getGeminiResponse } from './gemini.js';

// Enhanced logger with structured logging
const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

const TOKEN_REGEX = /(SOL|USDC|USDT)/i;
const ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // Base58 Solana address
const TX_HASH_REGEX = /^[A-Fa-f0-9]{64,128}$/; // Transaction hash

// Enhanced intent detection with better pattern matching
function detectIntent(message: string): 'rate' | 'help' | 'transfer' | 'sell' | 'sent' | 'bank' | 'cancel' | 'status' | 'unknown' {
  const lower = message.toLowerCase().trim();
  
  // Rate inquiries
  if (lower.includes('rate') || lower.includes('price') || lower.includes('how much') || 
      lower.includes('current rate') || lower.includes('exchange rate')) return 'rate';
  
  // Help requests
  if (lower.includes('help') || lower.includes('how do') || lower.includes('instructions') ||
      lower.includes('what do') || lower.includes('explain')) return 'help';
  
  // Transfer/sending instructions
  if (lower.includes('transfer') || lower.includes('send') || lower.includes('deposit') ||
      lower.includes('how to send') || lower.includes('wallet')) return 'transfer';
  
  // Selling intent
  if (lower.includes('sell') || lower.includes('exchange') || lower.includes('convert') ||
      lower.includes('trade') || lower.includes('swap')) return 'sell';
  
  // Transaction sent confirmation
  if (lower.includes('sent') || lower.includes('transferred') || lower.includes('deposited') ||
      lower.includes('i\'ve sent') || lower.includes('transaction sent') || 
      TX_HASH_REGEX.test(message)) return 'sent';
  
  // Bank details
  if (lower.includes('bank') || lower.includes('account') || lower.includes('details') ||
      lower.includes('ngn') || lower.includes('naira')) return 'bank';
  
  // Cancel/stop
  if (lower.includes('cancel') || lower.includes('stop') || lower.includes('abort') ||
      lower.includes('nevermind')) return 'cancel';
  
  // Status check
  if (lower.includes('status') || lower.includes('check') || lower.includes('where') ||
      lower.includes('progress')) return 'status';
  
  return 'unknown';
}

export function normalizeTokenSymbol(input: string): TokenSymbol | null {
  const m = input.match(TOKEN_REGEX);
  if (!m) return null;
  const t = m[1].toUpperCase();
  if (t === 'SOL' || t === 'USDC' || t === 'USDT') return t;
  return null;
}


// Input validation and sanitization
function validateAndSanitizeInput(message: string): { isValid: boolean; sanitized: string; error?: string } {
  // Check for dangerous patterns
  const dangerousPatterns = [
    /PRIVATE_KEY/i,
    /SECRET/i,
    /API_KEY/i,
    /PASSWORD/i,
    /<script/i,
    /javascript:/i,
    /DROP\s+TABLE/i,
    /DELETE\s+FROM/i,
    /rm\s+-rf/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(message)) {
      return { isValid: false, sanitized: '', error: 'Blocked potentially dangerous input' };
    }
  }
  
  // Truncate extremely long messages
  const maxLength = 1000;
  const sanitized = message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  
  return { isValid: true, sanitized: sanitized.trim() };
}

// Response filtering to prevent secret leakage
function filterResponse(response: string): string {
  const secretPatterns = [
    /AIza[0-9A-Za-z-_]{35}/g, // Google API keys
    /[A-Fa-f0-9]{64}/g, // Private keys
    /sk-[A-Za-z0-9]{48}/g, // OpenAI keys
    /pk_[A-Za-z0-9]{24}/g, // Stripe keys
  ];
  
  let filtered = response;
  secretPatterns.forEach(pattern => {
    filtered = filtered.replace(pattern, '[REDACTED]');
  });
  
  return filtered;
}

// Generate a proper Solana deposit address (stub for now)
function generateDepositAddress(token: TokenSymbol): string {
  // In production, this would generate a real Solana address
  const prefix = token === 'SOL' ? 'So' : 'USDC';
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}${random}${Math.random().toString(36).substring(2, 15)}`;
}

export async function handleChatTurn(userId: string, message: string, idempotencyKey?: string): Promise<{
  reply: string;
  session: Session;
  order?: Order;
} | undefined> {
  // Check idempotency if key provided
  if (idempotencyKey) {
    const idempotencyCheck = memStore.checkIdempotency(idempotencyKey);
    if (idempotencyCheck.exists) {
      log('info', 'Idempotent request detected', { userId, key: idempotencyKey });
      return idempotencyCheck.result;
    }
  }

  // Input validation
  const validation = validateAndSanitizeInput(message);
  if (!validation.isValid) {
    log('warn', 'Blocked invalid input', { userId, error: validation.error });
    const errorResponse = { 
      reply: 'I cannot process that request. Please try again with a different message.', 
      session: memStore.getSessionByUser(userId) ?? memStore.upsertSession({ userId, state: 'start' })
    };
    
    if (idempotencyKey) {
      memStore.setIdempotency(idempotencyKey, errorResponse);
    }
    return errorResponse;
  }

  const sanitizedMessage = validation.sanitized;
  const session = memStore.getSessionByUser(userId) ?? memStore.upsertSession({ userId, state: 'start' });
  const intent = detectIntent(sanitizedMessage);
  
  log('info', 'Processing chat turn', { 
    userId, 
    state: session.state, 
    intent, 
    messageLength: sanitizedMessage.length 
  });

  // Build enhanced context for Gemini
  const context = buildContext(session, userId);
  
  // Get Gemini response with proper error handling
  let geminiReply = "I'm here to help you with your Solana token sales. How can I assist you today?";
  try {
    geminiReply = await getGeminiResponse(sanitizedMessage, context);
    geminiReply = filterResponse(geminiReply);
  } catch (error) {
    log('error', 'Failed to get Gemini response', { error: error.message });
    geminiReply = getFallbackResponse(intent, session);
  }

  // Handle universal intents (work at any state)
  if (intent === 'rate') {
    return await handleRateInquiry(geminiReply, session);
  }
  
    if (intent === 'help') {
    return { reply: geminiReply, session };
  }
  
  if (intent === 'cancel') {
    return handleCancelRequest(userId, session, geminiReply);
  }
  
  if (intent === 'status') {
    return handleStatusRequest(session, geminiReply);
  }

  // State machine with proper flow control
  switch (session.state) {
    case 'start':
      return handleStartState(intent, sanitizedMessage, session, geminiReply);
    
    case 'awaiting_token':
      return handleAwaitingTokenState(intent, sanitizedMessage, session, geminiReply);
    
    case 'awaiting_deposit':
      return handleAwaitingDepositState(intent, sanitizedMessage, session, geminiReply);
    
    case 'confirming':
      return handleConfirmingState(session, geminiReply);
    
    case 'awaiting_bank':
      return handleAwaitingBankState(intent, sanitizedMessage, session, geminiReply);
    
    case 'ready_to_pay':
      return handleReadyToPayState(session, geminiReply);
    
    default:
      log('warn', 'Unknown session state', { userId, state: session.state });
      return { reply: geminiReply, session };
  }
}

// Helper functions for each state
function buildContext(session: Session, userId: string): string {
  const order = session.orderId ? memStore.getOrder(session.orderId) : null;
  
  let context = `Current session state: ${session.state}
User ID: ${userId}`;
  
  if (session.orderId) {
    context += `\nActive order ID: ${session.orderId}`;
    if (order) {
      context += `\nOrder details: ${order.tokenSymbol} token, status: ${order.status}`;
    }
  }
  
  context += `\nAvailable actions: rate inquiry, help, transfer instructions, or selling process`;
  
  return context;
}

function getFallbackResponse(intent: string, session: Session): string {
  const fallbacks = {
    'help': "I'd be happy to help you! I can assist with selling SOL, USDC, or USDT tokens for Nigerian Naira. What would you like to know?",
    'transfer': "To send tokens from your Phantom wallet, open Phantom, select the token you want to send, paste the deposit address, enter the amount, and confirm the transaction.",
    'sell': "Great! I can help you sell your Solana tokens for NGN. Which token would you like to sell - SOL, USDC, or USDT?",
    'rate': "I can help you check current rates for SOL, USDC, and USDT tokens.",
    'default': "I'm here to help you with your Solana token sales. How can I assist you today?"
  };
  
  return fallbacks[intent] || fallbacks.default;
}

async function handleRateInquiry(geminiReply: string, session: Session) {
    try {
      const { usd, ngnFx } = await getPricing(['SOL', 'USDC', 'USDT']);
      const rateInfo = `Current rates:\nSOL: $${usd.SOL} | USDC: $${usd.USDC} | USDT: $${usd.USDT}\nUSD/NGN: ₦${ngnFx.toFixed(2)} (rates may change, confirm before trading)`;
      return {
        reply: `${geminiReply}\n\n${rateInfo}`,
        session,
      };
    } catch (e) {
    log('error', 'Error fetching rates', { error: e.message });
      return { reply: `${geminiReply}\n\nSorry, I could not fetch rates at this time.`, session };
    }
  }

function handleCancelRequest(userId: string, session: Session, geminiReply: string) {
  // Reset session to start
  const resetSession = memStore.upsertSession({ userId, state: 'start', orderId: null });
  return {
    reply: `${geminiReply}\n\nNo problem! I've cancelled your current transaction. How can I help you today?`,
    session: resetSession,
  };
}

function handleStatusRequest(session: Session, geminiReply: string) {
  const order = session.orderId ? memStore.getOrder(session.orderId) : null;
  
  if (!order) {
    return {
      reply: `${geminiReply}\n\nYou don't have any active transactions. Would you like to start selling tokens?`,
      session,
    };
  }
  
  const statusMessage = `Your ${order.tokenSymbol} transaction is currently: ${order.status}`;
    return {
    reply: `${geminiReply}\n\n${statusMessage}`,
      session,
    };
  }

function handleStartState(intent: string, message: string, session: Session, geminiReply: string) {
    if (intent === 'sell') {
    const next = memStore.upsertSession({ userId: session.userId, state: 'awaiting_token' });
      return {
        reply: `${geminiReply}\n\nGreat! Which token would you like to sell? (SOL, USDC, USDT)`,
        session: next,
      };
    }
  
  if (intent === 'transfer') {
    return {
      reply: geminiReply,
      session,
    };
  }
  
    return {
      reply: geminiReply,
      session,
    };
  }

function handleAwaitingTokenState(intent: string, message: string, session: Session, geminiReply: string) {
    const token = normalizeTokenSymbol(message);
  
    if (!token) {
    return { 
      reply: `${geminiReply}\n\nPlease choose one of: SOL, USDC, USDT.`, 
      session 
    };
    }
  
  // Create order with proper deposit address
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
  const depositAddress = generateDepositAddress(token);
  
    const order: Order = {
      id,
    userId: session.userId,
      tokenSymbol: token,
    depositAddress,
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
      createdAt: now,
      updatedAt: now,
    };
    
    const saved = memStore.insertOrder(order);
  const next = memStore.upsertSession({ 
    userId: session.userId, 
    state: 'awaiting_deposit', 
    orderId: saved.id 
  });
    
    return {
    reply: `${geminiReply}\n\nPerfect! I've created an order for ${token}. Please send your deposit to: ${saved.depositAddress}\n\nAfter sending, please reply with the transaction hash or wallet address you sent from.`,
      session: next,
      order: saved,
    };
  }

function handleAwaitingDepositState(intent: string, message: string, session: Session, geminiReply: string, idempotencyKey?: string) {
  if (intent === 'sent') {
    // Extract transaction hash or address
    const txHash = message.match(TX_HASH_REGEX)?.[0];
    const address = message.match(ADDRESS_REGEX)?.[0];
    
    // Check for duplicate transaction
    if (txHash && memStore.checkDuplicateTransaction(txHash)) {
      log('warn', 'Duplicate transaction detected', { userId: session.userId, txHash });
      const duplicateResponse = { 
        reply: `${geminiReply}\n\nThis transaction has already been processed. Please check your transaction history or contact support if you believe this is an error.`, 
        session 
      };
      
      if (idempotencyKey) {
        memStore.setIdempotency(idempotencyKey, duplicateResponse);
      }
      return duplicateResponse;
    }
    
      if (session.orderId) {
      const order = memStore.updateOrder(session.orderId, { 
        fromAddress: address || message.trim(), 
        txSignature: txHash,
        status: 'confirming' 
      });
      
        if (order) {
        const next = memStore.upsertSession({ 
          userId: session.userId, 
          state: 'confirming' 
        });
        
        const successResponse = { 
            reply: `${geminiReply}\n\nThanks! I'm verifying your deposit on Solana. I'll update you shortly.`, 
            session: next, 
            order 
          };
        
        if (idempotencyKey) {
          memStore.setIdempotency(idempotencyKey, successResponse);
        }
        
        return successResponse;
      }
    }
  }
  
  const waitingResponse = { 
    reply: `${geminiReply}\n\nI'm waiting for your deposit. Please send your tokens to the address I provided and let me know when it's done.`, 
    session 
  };
  
  if (idempotencyKey) {
    memStore.setIdempotency(idempotencyKey, waitingResponse);
  }
  
  return waitingResponse;
}

function handleConfirmingState(session: Session, geminiReply: string) {
    return { 
      reply: `${geminiReply}\n\nI'm still confirming your transaction on-chain. I'll notify you once it's finalized.`, 
      session 
    };
  }

function handleAwaitingBankState(intent: string, message: string, session: Session, geminiReply: string) {
  // Handle bank details collection
  if (intent === 'bank' || message.includes('account') || message.includes('bank')) {
    // In a real implementation, you'd parse and validate bank details
    if (session.orderId) {
      const order = memStore.updateOrder(session.orderId, { 
        bankAccount: message.trim(),
        status: 'ready_to_pay' 
      });
      
      if (order) {
        const next = memStore.upsertSession({ 
          userId: session.userId, 
          state: 'ready_to_pay' 
        });
        return { 
          reply: `${geminiReply}\n\nGreat! I have your bank details. I'll process your payout shortly.`, 
          session: next, 
          order 
        };
      }
    }
  }
  
  return { 
    reply: `${geminiReply}\n\nPlease provide your Nigerian bank account details for the payout.`, 
    session 
  };
}

function handleReadyToPayState(session: Session, geminiReply: string) {
  return { 
    reply: `${geminiReply}\n\nYour payout is being processed. You should receive the NGN in your bank account shortly.`, 
    session 
  };
}
