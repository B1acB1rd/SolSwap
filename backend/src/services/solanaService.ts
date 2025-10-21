import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';

export interface SolanaConfig {
  rpcUrl: string;
  commitment: 'processed' | 'confirmed' | 'finalized';
  timeout: number;
}

export interface TransactionInfo {
  signature: string;
  slot: number;
  blockTime: number;
  from: string;
  to: string;
  amount: string;
  token: string;
  status: 'confirmed' | 'failed' | 'pending';
  confirmations: number;
}

export interface DepositInfo {
  address: string;
  token: 'SOL' | 'USDC' | 'USDT';
  expectedAmount?: string;
  receivedAmount: string;
  confirmations: number;
  isConfirmed: boolean;
}

class SolanaService {
  private connection: Connection;
  private config: SolanaConfig;

  constructor(config: SolanaConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, {
      commitment: config.commitment,
      confirmTransactionInitialTimeout: config.timeout
    });
  }

  // Generate a new deposit address for a specific token
  async generateDepositAddress(token: 'SOL' | 'USDC' | 'USDT'): Promise<{
    address: string;
    tokenAccount?: string;
  }> {
    try {
      if (token === 'SOL') {
        // For SOL, we can use any valid Solana address
        // In production, you'd generate a new keypair
        const keypair = this.generateKeypair();
        return {
          address: keypair.publicKey.toBase58()
        };
      } else {
        // For SPL tokens, we need to create an associated token account
        const mintAddress = this.getTokenMintAddress(token);
        const keypair = this.generateKeypair();
        const tokenAccount = await getAssociatedTokenAddress(
          new PublicKey(mintAddress),
          keypair.publicKey
        );
        
        return {
          address: keypair.publicKey.toBase58(),
          tokenAccount: tokenAccount.toBase58()
        };
      }
    } catch (error) {
      console.error('Error generating deposit address:', error);
      throw new Error('Failed to generate deposit address');
    }
  }

  // Monitor for incoming transactions to a specific address
  async monitorDeposits(
    address: string,
    token: 'SOL' | 'USDC' | 'USDT',
    callback: (deposit: DepositInfo) => void
  ): Promise<void> {
    try {
      const publicKey = new PublicKey(address);
      
      // Set up account change listener
      const subscriptionId = this.connection.onAccountChange(
        publicKey,
        async (accountInfo, context) => {
          try {
            const deposit = await this.checkDeposit(address, token);
            if (deposit.isConfirmed) {
              callback(deposit);
            }
          } catch (error) {
            console.error('Error checking deposit:', error);
          }
        },
        this.config.commitment
      );

      // Also check for existing transactions
      await this.checkExistingTransactions(address, token, callback);

      return subscriptionId;
    } catch (error) {
      console.error('Error setting up deposit monitoring:', error);
      throw new Error('Failed to monitor deposits');
    }
  }

  // Check if a specific transaction exists and is confirmed
  async verifyTransaction(signature: string): Promise<TransactionInfo | null> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: this.config.commitment,
        maxSupportedTransactionVersion: 0
      });

      if (!transaction) {
        return null;
      }

      const meta = transaction.meta;
      if (!meta || meta.err) {
        return {
          signature,
          slot: transaction.slot,
          blockTime: transaction.blockTime || 0,
          from: '',
          to: '',
          amount: '0',
          token: 'SOL',
          status: 'failed',
          confirmations: 0
        };
      }

      // Parse transaction details (simplified)
      const from = meta.preBalances[0] > 0 ? 'unknown' : 'unknown';
      const to = 'deposit_address';
      const amount = Math.abs(meta.postBalances[0] - meta.preBalances[0]).toString();

      return {
        signature,
        slot: transaction.slot,
        blockTime: transaction.blockTime || 0,
        from,
        to,
        amount,
        token: 'SOL',
        status: 'confirmed',
        confirmations: 1 // Simplified
      };
    } catch (error) {
      console.error('Error verifying transaction:', error);
      return null;
    }
  }

  // Check current balance of an address
  async getBalance(address: string, token: 'SOL' | 'USDC' | 'USDT'): Promise<string> {
    try {
      const publicKey = new PublicKey(address);
      
      if (token === 'SOL') {
        const balance = await this.connection.getBalance(publicKey);
        return (balance / 1e9).toString(); // Convert lamports to SOL
      } else {
        // For SPL tokens, check token account balance
        const mintAddress = this.getTokenMintAddress(token);
        const tokenAccount = await getAssociatedTokenAddress(
          new PublicKey(mintAddress),
          publicKey
        );
        
        const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
        return accountInfo.value.amount;
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  }

  // Check for deposits to a specific address
  private async checkDeposit(
    address: string,
    token: 'SOL' | 'USDC' | 'USDT'
  ): Promise<DepositInfo> {
    try {
      const balance = await this.getBalance(address, token);
      const publicKey = new PublicKey(address);
      
      // Get recent transactions
      const signatures = await this.connection.getSignaturesForAddress(publicKey, {
        limit: 10
      });

      let confirmations = 0;
      let isConfirmed = false;

      if (signatures.length > 0) {
        const latestSignature = signatures[0];
        const transaction = await this.connection.getTransaction(latestSignature.signature);
        
        if (transaction && !transaction.meta?.err) {
          confirmations = 1; // Simplified
          isConfirmed = confirmations >= 1; // Require at least 1 confirmation
        }
      }

      return {
        address,
        token,
        receivedAmount: balance,
        confirmations,
        isConfirmed
      };
    } catch (error) {
      console.error('Error checking deposit:', error);
      return {
        address,
        token,
        receivedAmount: '0',
        confirmations: 0,
        isConfirmed: false
      };
    }
  }

  // Check for existing transactions
  private async checkExistingTransactions(
    address: string,
    token: 'SOL' | 'USDC' | 'USDT',
    callback: (deposit: DepositInfo) => void
  ): Promise<void> {
    try {
      const deposit = await this.checkDeposit(address, token);
      if (parseFloat(deposit.receivedAmount) > 0) {
        callback(deposit);
      }
    } catch (error) {
      console.error('Error checking existing transactions:', error);
    }
  }

  // Generate a new keypair (in production, use secure key generation)
  private generateKeypair(): any {
    // This is a simplified version - in production, use proper key generation
    const keypair = {
      publicKey: {
        toBase58: () => {
          // Generate a random base58 string (simplified)
          const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
          let result = '';
          for (let i = 0; i < 44; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        }
      }
    };
    return keypair;
  }

  // Get token mint address
  private getTokenMintAddress(token: 'USDC' | 'USDT'): string {
    const mintAddresses = {
      USDC: process.env.SPL_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      USDT: process.env.SPL_USDT_MINT || 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    };
    return mintAddresses[token];
  }

  // Get network status
  async getNetworkStatus(): Promise<{
    connected: boolean;
    slot: number;
    blockHeight: number;
    epoch: number;
  }> {
    try {
      const slot = await this.connection.getSlot();
      const blockHeight = await this.connection.getBlockHeight();
      const epochInfo = await this.connection.getEpochInfo();
      
      return {
        connected: true,
        slot,
        blockHeight,
        epoch: epochInfo.epoch
      };
    } catch (error) {
      console.error('Error getting network status:', error);
      return {
        connected: false,
        slot: 0,
        blockHeight: 0,
        epoch: 0
      };
    }
  }
}

// Export singleton instance
export const solanaService = new SolanaService({
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  commitment: (process.env.SOLANA_COMMITMENT as any) || 'confirmed',
  timeout: 30000
});

// Background monitoring service
export class DepositMonitor {
  private monitors: Map<string, number> = new Map();
  private isRunning = false;

  async startMonitoring(address: string, token: 'SOL' | 'USDC' | 'USDT'): Promise<void> {
    try {
      const subscriptionId = await solanaService.monitorDeposits(
        address,
        token,
        (deposit) => {
          console.log('Deposit detected:', deposit);
          // In production, this would trigger order processing
        }
      );
      
      this.monitors.set(address, subscriptionId);
    } catch (error) {
      console.error('Error starting deposit monitoring:', error);
    }
  }

  stopMonitoring(address: string): void {
    const subscriptionId = this.monitors.get(address);
    if (subscriptionId) {
      solanaService.connection.removeAccountChangeListener(subscriptionId);
      this.monitors.delete(address);
    }
  }

  stopAllMonitoring(): void {
    this.monitors.forEach((subscriptionId, address) => {
      solanaService.connection.removeAccountChangeListener(subscriptionId);
    });
    this.monitors.clear();
  }
}

export const depositMonitor = new DepositMonitor();
