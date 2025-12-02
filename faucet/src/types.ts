/**
 * Type definitions for NEAR Faucet Service
 */

export interface FaucetEvent {
  mode: 'single' | 'batch';
  accountId?: string;        // For single mode (NEAR account ID)
  amount?: string;           // For single mode
  accounts?: string[];       // For batch mode (array of NEAR account IDs)
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

