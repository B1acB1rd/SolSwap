import crypto from 'crypto';

export interface PayoutConfig {
  provider: 'paystack' | 'flutterwave';
  secretKey: string;
  publicKey: string;
  baseUrl: string;
}

export interface BankAccount {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  bankName: string;
}

export interface PayoutRequest {
  amount: number; // Amount in NGN
  bankAccount: BankAccount;
  reference: string;
  description?: string;
  userId: string;
}

export interface PayoutResponse {
  success: boolean;
  reference: string;
  transactionId?: string;
  status: 'pending' | 'success' | 'failed';
  message: string;
  fees?: number;
  timestamp: string;
}

export interface PayoutStatus {
  reference: string;
  status: 'pending' | 'success' | 'failed';
  amount: number;
  fees: number;
  timestamp: string;
  bankAccount: BankAccount;
}

// Paystack integration
class PaystackService {
  private config: PayoutConfig;

  constructor(config: PayoutConfig) {
    this.config = config;
  }

  async createPayout(request: PayoutRequest): Promise<PayoutResponse> {
    try {
      const payload = {
        source: 'balance',
        amount: request.amount * 100, // Convert to kobo
        recipient: request.bankAccount.accountNumber,
        reason: request.description || 'Token sale payout',
        reference: request.reference
      };

      const response = await this.makeRequest('/transfer', 'POST', payload);
      
      return {
        success: response.status === true,
        reference: request.reference,
        transactionId: response.data?.transfer_code,
        status: response.status ? 'pending' : 'failed',
        message: response.message || 'Payout initiated',
        fees: response.data?.fee || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Paystack payout error:', error);
      return {
        success: false,
        reference: request.reference,
        status: 'failed',
        message: 'Payout failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getPayoutStatus(reference: string): Promise<PayoutStatus> {
    try {
      const response = await this.makeRequest(`/transfer/verify/${reference}`, 'GET');
      
      return {
        reference,
        status: response.status === true ? 'success' : 'failed',
        amount: response.data?.amount || 0,
        fees: response.data?.fee || 0,
        timestamp: response.data?.created_at || new Date().toISOString(),
        bankAccount: {
          accountNumber: response.data?.recipient || '',
          bankCode: response.data?.bank_code || '',
          accountName: response.data?.account_name || '',
          bankName: response.data?.bank_name || ''
        }
      };
    } catch (error) {
      console.error('Error checking payout status:', error);
      return {
        reference,
        status: 'failed',
        amount: 0,
        fees: 0,
        timestamp: new Date().toISOString(),
        bankAccount: {
          accountNumber: '',
          bankCode: '',
          accountName: '',
          bankName: ''
        }
      };
    }
  }

  private async makeRequest(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.secretKey}`,
      'Content-Type': 'application/json'
    };

    const options: RequestInit = {
      method,
      headers
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    return await response.json();
  }
}

// Flutterwave integration
class FlutterwaveService {
  private config: PayoutConfig;

  constructor(config: PayoutConfig) {
    this.config = config;
  }

  async createPayout(request: PayoutRequest): Promise<PayoutResponse> {
    try {
      const payload = {
        account_bank: request.bankAccount.bankCode,
        account_number: request.bankAccount.accountNumber,
        amount: request.amount,
        narration: request.description || 'Token sale payout',
        currency: 'NGN',
        reference: request.reference,
        callback_url: `${process.env.APP_BASE_URL}/webhooks/flutterwave`,
        debit_currency: 'NGN'
      };

      const response = await this.makeRequest('/v3/transfers', 'POST', payload);
      
      return {
        success: response.status === 'success',
        reference: request.reference,
        transactionId: response.data?.id,
        status: response.status === 'success' ? 'pending' : 'failed',
        message: response.message || 'Payout initiated',
        fees: response.data?.fee || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Flutterwave payout error:', error);
      return {
        success: false,
        reference: request.reference,
        status: 'failed',
        message: 'Payout failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getPayoutStatus(reference: string): Promise<PayoutStatus> {
    try {
      const response = await this.makeRequest(`/v3/transfers/${reference}`, 'GET');
      
      return {
        reference,
        status: response.data?.status === 'SUCCESSFUL' ? 'success' : 'failed',
        amount: response.data?.amount || 0,
        fees: response.data?.fee || 0,
        timestamp: response.data?.created_at || new Date().toISOString(),
        bankAccount: {
          accountNumber: response.data?.account_number || '',
          bankCode: response.data?.account_bank || '',
          accountName: response.data?.full_name || '',
          bankName: response.data?.bank_name || ''
        }
      };
    } catch (error) {
      console.error('Error checking payout status:', error);
      return {
        reference,
        status: 'failed',
        amount: 0,
        fees: 0,
        timestamp: new Date().toISOString(),
        bankAccount: {
          accountNumber: '',
          bankCode: '',
          accountName: '',
          bankName: ''
        }
      };
    }
  }

  private async makeRequest(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.secretKey}`,
      'Content-Type': 'application/json'
    };

    const options: RequestInit = {
      method,
      headers
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    return await response.json();
  }
}

// Main payout service
export class PayoutService {
  private paystackService?: PaystackService;
  private flutterwaveService?: FlutterwaveService;
  private provider: string;

  constructor() {
    this.provider = process.env.PAYOUT_PROVIDER || 'paystack';
    this.initializeProviders();
  }

  private initializeProviders(): void {
    if (process.env.PAYSTACK_SECRET) {
      this.paystackService = new PaystackService({
        provider: 'paystack',
        secretKey: process.env.PAYSTACK_SECRET,
        publicKey: process.env.PAYSTACK_PUBLIC || '',
        baseUrl: 'https://api.paystack.co'
      });
    }

    if (process.env.FLUTTERWAVE_SECRET) {
      this.flutterwaveService = new FlutterwaveService({
        provider: 'flutterwave',
        secretKey: process.env.FLUTTERWAVE_SECRET,
        publicKey: process.env.FLUTTERWAVE_PUBLIC || '',
        baseUrl: 'https://api.flutterwave.com'
      });
    }
  }

  async createPayout(request: PayoutRequest): Promise<PayoutResponse> {
    try {
      // Validate bank account
      const validation = await this.validateBankAccount(request.bankAccount);
      if (!validation.valid) {
        return {
          success: false,
          reference: request.reference,
          status: 'failed',
          message: validation.message,
          timestamp: new Date().toISOString()
        };
      }

      // Check for duplicate payouts
      if (await this.checkDuplicatePayout(request)) {
        return {
          success: false,
          reference: request.reference,
          status: 'failed',
          message: 'Duplicate payout detected',
          timestamp: new Date().toISOString()
        };
      }

      // Create payout based on provider
      let response: PayoutResponse;
      
      if (this.provider === 'paystack' && this.paystackService) {
        response = await this.paystackService.createPayout(request);
      } else if (this.provider === 'flutterwave' && this.flutterwaveService) {
        response = await this.flutterwaveService.createPayout(request);
      } else {
        throw new Error('No payout provider configured');
      }

      // Log payout attempt
      console.log('Payout created:', {
        reference: request.reference,
        amount: request.amount,
        provider: this.provider,
        success: response.success
      });

      return response;
    } catch (error) {
      console.error('Payout service error:', error);
      return {
        success: false,
        reference: request.reference,
        status: 'failed',
        message: 'Payout service error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getPayoutStatus(reference: string): Promise<PayoutStatus> {
    try {
      if (this.provider === 'paystack' && this.paystackService) {
        return await this.paystackService.getPayoutStatus(reference);
      } else if (this.provider === 'flutterwave' && this.flutterwaveService) {
        return await this.flutterwaveService.getPayoutStatus(reference);
      } else {
        throw new Error('No payout provider configured');
      }
    } catch (error) {
      console.error('Error getting payout status:', error);
      return {
        reference,
        status: 'failed',
        amount: 0,
        fees: 0,
        timestamp: new Date().toISOString(),
        bankAccount: {
          accountNumber: '',
          bankCode: '',
          accountName: '',
          bankName: ''
        }
      };
    }
  }

  private async validateBankAccount(bankAccount: BankAccount): Promise<{
    valid: boolean;
    message: string;
  }> {
    // Basic validation
    if (!bankAccount.accountNumber || bankAccount.accountNumber.length < 10) {
      return { valid: false, message: 'Invalid account number' };
    }

    if (!bankAccount.bankCode || bankAccount.bankCode.length < 3) {
      return { valid: false, message: 'Invalid bank code' };
    }

    if (!bankAccount.accountName || bankAccount.accountName.length < 2) {
      return { valid: false, message: 'Invalid account name' };
    }

    return { valid: true, message: 'Valid' };
  }

  private async checkDuplicatePayout(request: PayoutRequest): Promise<boolean> {
    // In production, check database for duplicate payouts
    // For now, return false (no duplicates)
    return false;
  }

  // Webhook signature verification
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  // Get supported banks
  async getSupportedBanks(): Promise<Array<{ code: string; name: string }>> {
    // In production, fetch from provider API
    return [
      { code: '044', name: 'Access Bank' },
      { code: '023', name: 'Citibank Nigeria' },
      { code: '050', name: 'Ecobank Nigeria' },
      { code: '011', name: 'First Bank of Nigeria' },
      { code: '214', name: 'First City Monument Bank' },
      { code: '070', name: 'Guaranty Trust Bank' },
      { code: '058', name: 'GTBank' },
      { code: '030', name: 'Heritage Bank' },
      { code: '301', name: 'Jaiz Bank' },
      { code: '082', name: 'Keystone Bank' },
      { code: '221', name: 'Stanbic IBTC Bank' },
      { code: '068', name: 'Standard Chartered Bank' },
      { code: '232', name: 'Sterling Bank' },
      { code: '032', name: 'Union Bank of Nigeria' },
      { code: '033', name: 'United Bank for Africa' },
      { code: '215', name: 'Unity Bank' },
      { code: '035', name: 'Wema Bank' },
      { code: '057', name: 'Zenith Bank' }
    ];
  }
}

// Export singleton instance
export const payoutService = new PayoutService();
