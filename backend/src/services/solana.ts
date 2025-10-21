import { Connection, PublicKey, clusterApiUrl, Commitment } from '@solana/web3.js';

export function getConnection(): Connection {
  const url = process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
  const commitment = (process.env.SOLANA_COMMITMENT || 'confirmed') as Commitment;
  return new Connection(url, commitment);
}

export type DepositEvent = {
  orderId: string;
  signature: string;
  fromAddress: string;
  amountRaw: bigint;
  tokenSymbol: 'SOL' | 'USDC' | 'USDT';
};

// Stub: In MVP, a polling loop would query recent signatures addressed to deposit addresses
export async function watchDeposits(_activeOrders: { orderId: string; depositAddress: string }[], _onEvent: (evt: DepositEvent) => Promise<void>) {
  // Placeholder watcher; integrate signature subscriptions or polling later
}

export function isValidSolanaAddress(addr: string): boolean {
  try {
    new PublicKey(addr);
    return true;
  } catch {
    return false;
  }
}


