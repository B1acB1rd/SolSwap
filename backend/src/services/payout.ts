export type PayoutProvider = 'paystack' | 'flutterwave';

export interface PayoutRequest {
  orderId: string;
  bankAccount: string; // accountNumber:bankCode
  amountNgnKobo: number; // NGN in kobo
  narration?: string;
}

export interface PayoutResult {
  reference: string;
  status: 'queued' | 'success' | 'failed';
}

export interface PayoutService {
  createRecipient(accountNumber: string, bankCode: string): Promise<{ recipientCode: string } >;
  initiateTransfer(recipientCode: string, amountKobo: number, narration?: string): Promise<PayoutResult>;
}

class PaystackService implements PayoutService {
  async createRecipient(accountNumber: string, bankCode: string): Promise<{ recipientCode: string }> {
    // Stub recipient creation. Integrate Paystack Transfers/Recipients API here.
    return { recipientCode: `PS_RECIP_${accountNumber}_${bankCode}` };
  }
  async initiateTransfer(recipientCode: string, amountKobo: number, narration?: string): Promise<PayoutResult> {
    // Stub transfer initiation. Integrate Paystack Transfers API here.
    return { reference: `PS_${recipientCode}_${amountKobo}`, status: 'queued' };
  }
}

class FlutterwaveService implements PayoutService {
  async createRecipient(accountNumber: string, bankCode: string): Promise<{ recipientCode: string }> {
    // Stub beneficiary creation. Integrate Flutterwave Beneficiaries API here.
    return { recipientCode: `FW_RECIP_${accountNumber}_${bankCode}` };
  }
  async initiateTransfer(recipientCode: string, amountKobo: number, narration?: string): Promise<PayoutResult> {
    // Stub transfer initiation. Integrate Flutterwave Transfers API here.
    return { reference: `FW_${recipientCode}_${amountKobo}`, status: 'queued' };
  }
}

export function getPayoutService(): PayoutService {
  const provider = (process.env.PAYOUT_PROVIDER || 'paystack') as PayoutProvider;
  if (provider === 'flutterwave') return new FlutterwaveService();
  return new PaystackService();
}

export function parseBankAccount(input: string): { accountNumber: string; bankCode: string } | null {
  const parts = input.split(':').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const [accountNumber, bankCode] = parts;
  if (!/^\d{10}$/.test(accountNumber)) return null;
  if (!/^\d{3,6}$/.test(bankCode)) return null;
  return { accountNumber, bankCode };
}


