/**
 * Type definitions for NEAR Faucet Service
 */

export interface FaucetEvent {
  mode: 'single' | 'batch' | 'createAccount';
  accountId?: string;        // For single/createAccount mode
  amount?: string;           // For single/createAccount mode
  publicKey?: string;        // For createAccount mode
  accounts?: string[];       // For batch mode
  minAmount?: number;        // For batch mode
  maxAmount?: number;        // For batch mode
}

export interface FaucetTransfer {
  account: string;
  amount: string;
  txHash?: string;
  success: boolean;
  error?: string;
}

export interface FaucetResult {
  success: boolean;
  mode: 'single' | 'batch';
  transfers: FaucetTransfer[];
  summary: {
    totalSelected: number;
    successful: number;
    failed: number;
    totalSent: string;
  };
}

