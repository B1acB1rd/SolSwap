export type TokenSymbol = 'SOL' | 'USDC' | 'USDT';

export type SessionState =
  | 'start'
  | 'awaiting_token'
  | 'awaiting_amount'
  | 'awaiting_deposit'
  | 'confirming'
  | 'awaiting_bank'
  | 'ready_to_pay'
  | 'paid'
  | 'failed'
  | 'cancelled';

export type OrderStatus =
  | 'waiting'
  | 'awaiting_deposit'
  | 'confirming'
  | 'awaiting_bank'
  | 'ready_to_pay'
  | 'paid'
  | 'failed'
  | 'cancelled';

export interface Session {
  id: string;
  userId: string;
  state: SessionState;
  orderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  userId: string;
  tokenSymbol: TokenSymbol;
  depositAddress: string;
  depositTokenAccount?: string | null;
  fromAddress?: string | null;
  amountToken?: string | null;
  amountNgn?: string | null;
  priceUsd?: string | null;
  ngnFx?: string | null;
  spreadBps?: number | null;
  txSignature?: string | null;
  status: OrderStatus;
  bankAccount?: string | null;
  payoutReference?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}


