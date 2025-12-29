/**
 * NEAR Faucet Lambda Handler
 * 
 * Standalone service for sending NEAR tokens from master account to user wallets on localnet.
 * 
 * Event Payload:
 * {
 *   "mode": "single" | "batch",
 *   "accountId"?: "user.near",        // For single mode (NEAR account ID)
 *   "amount"?: "5.0",                 // For single mode
 *   "accounts"?: ["user1.near", "user2.near"],  // For batch mode (array of NEAR account IDs)
 *   "minAmount"?: 1.0,                // For batch mode
 *   "maxAmount"?: 10.0                // For batch mode
 * }
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import * as nearAPI from 'near-api-js';
import { KeyPair, keyStores, connect } from 'near-api-js';
import { parseNearAmount } from 'near-api-js/lib/utils/format';
import { FaucetEvent, FaucetResult, FaucetTransfer } from './types';

const ssmClient = new SSMClient({});

const NETWORK_ID = process.env.NEAR_NETWORK || 'localnet';
const NODE_URL = process.env.NEAR_NODE_URL || 'http://localhost:3030';
const SSM_MASTER_ACCOUNT_ID_PARAM = process.env.SSM_MASTER_ACCOUNT_ID_PARAM || '/near-localnet/master-account-id';
const SSM_MASTER_ACCOUNT_KEY_PARAM = process.env.SSM_MASTER_ACCOUNT_KEY_PARAM || '/near-localnet/master-account-key';

class NearFaucet {
  private near: nearAPI.Near | null = null;
  private masterAccount: nearAPI.Account | null = null;
  private masterAccountId: string = 'node0';

  async initialize(): Promise<void> {
    console.log('Initializing NEAR connection...');

    // Get master account ID from SSM
    try {
      const accountIdParam = await ssmClient.send(
        new GetParameterCommand({
          Name: SSM_MASTER_ACCOUNT_ID_PARAM,
        })
      );
      this.masterAccountId = accountIdParam.Parameter?.Value || 'node0';
    } catch (error) {
      console.log(`Using default master account ID: node0 (SSM param ${SSM_MASTER_ACCOUNT_ID_PARAM} not found)`);
    }

    // Get master account private key from SSM
    const keyParam = await ssmClient.send(
      new GetParameterCommand({
        Name: SSM_MASTER_ACCOUNT_KEY_PARAM,
        WithDecryption: true,
      })
    );

    if (!keyParam.Parameter?.Value) {
      throw new Error(`Master account key not found in SSM at ${SSM_MASTER_ACCOUNT_KEY_PARAM}`);
    }

    const privateKeyString = keyParam.Parameter.Value;
    const masterKeyPair = KeyPair.fromString(privateKeyString as any);

    // Initialize NEAR connection
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(NETWORK_ID, this.masterAccountId, masterKeyPair);

    const config = {
      networkId: NETWORK_ID,
      keyStore,
      nodeUrl: NODE_URL,
      walletUrl: '',
      helperUrl: '',
      explorerUrl: '',
    };

    this.near = await connect(config);
    this.masterAccount = await this.near.account(this.masterAccountId);

    console.log(`Master account loaded: ${this.masterAccountId}`);
    console.log(`Connected to NEAR at: ${NODE_URL}`);
  }

  async sendTransfer(toAccountId: string, amountInNear: string): Promise<string> {
    if (!this.masterAccount) {
      throw new Error('Master account not initialized');
    }

    const amount = parseNearAmount(amountInNear);
    if (!amount) {
      throw new Error(`Invalid amount: ${amountInNear}`);
    }

    const result = await this.masterAccount.sendMoney(toAccountId, BigInt(amount));
    return result.transaction.hash;
  }

  async singleTransfer(accountId: string, amount: string): Promise<FaucetResult> {
    const result: FaucetResult = {
      success: false,
      mode: 'single',
      transfers: [],
      summary: {
        totalSelected: 1,
        successful: 0,
        failed: 0,
        totalSent: '0',
      },
    };

    try {
      console.log(`Sending ${amount} NEAR to ${accountId}`);

      const txHash = await this.sendTransfer(accountId, amount);

      result.transfers.push({
        account: accountId,
        amount,
        txHash,
        success: true,
      });

      result.summary.successful = 1;
      result.summary.totalSent = amount;
      result.success = true;

      console.log(`✅ Transfer successful! TX: ${txHash}`);

      return result;
    } catch (error) {
      console.error(`Transfer failed:`, error);
      result.transfers.push({
        account: accountId,
        amount,
        success: false,
        error: String(error),
      });
      result.summary.failed = 1;
      return result;
    }
  }

  async batchTransfer(accounts: string[], minAmount: number, maxAmount: number): Promise<FaucetResult> {
    const result: FaucetResult = {
      success: false,
      mode: 'batch',
      transfers: [],
      summary: {
        totalSelected: accounts.length,
        successful: 0,
        failed: 0,
        totalSent: '0',
      },
    };

    if (accounts.length === 0) {
      console.log('No accounts provided for batch transfer');
      return result;
    }

    console.log(`Sending to ${accounts.length} accounts`);

    let totalSent = 0;

    for (const accountId of accounts) {
      // Generate random amount within range
      const randomAmount = (minAmount + Math.random() * (maxAmount - minAmount)).toFixed(2);

      console.log(`Sending ${randomAmount} NEAR to ${accountId}`);

      try {
        const txHash = await this.sendTransfer(accountId, randomAmount);

        result.transfers.push({
          account: accountId,
          amount: randomAmount,
          txHash,
          success: true,
        });

        result.summary.successful++;
        totalSent += parseFloat(randomAmount);

        console.log(`  ✅ Success! TX: ${txHash}`);

        // Small delay between transfers to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Failed:`, error);
        result.transfers.push({
          account: accountId,
          amount: randomAmount,
          success: false,
          error: String(error),
        });

        result.summary.failed++;
      }
    }

    result.summary.totalSent = totalSent.toFixed(2);
    result.success = result.summary.successful > 0;

    console.log(`Batch complete: ${result.summary.successful} successful, ${result.summary.failed} failed`);

    return result;
  }
}

export const handler = async (event: any): Promise<any> => {
  console.log('Faucet Lambda invoked:', JSON.stringify(event));

  // Handle parsing of body if it exists (API Gateway / Function URL event)
  let payload: FaucetEvent;
  if (event.body) {
    try {
      payload = JSON.parse(event.body);
    } catch (e) {
      // If body is already an object or parsing fails, use as is or fail
      payload = typeof event.body === 'string' ? event.body : event;
    }
  } else {
    // Direct invocation
    payload = event as FaucetEvent;
  }

  const faucet = new NearFaucet();
  await faucet.initialize();

  if (payload.mode === 'single') {
    if (!payload.accountId || !payload.amount) {
      throw new Error('accountId and amount required for single mode');
    }
    return await faucet.singleTransfer(payload.accountId, payload.amount);
  } else if (payload.mode === 'batch') {
    if (!payload.accounts || payload.accounts.length === 0) {
      throw new Error('accounts array required for batch mode');
    }
    const minAmount = payload.minAmount || 1.0;
    const maxAmount = payload.maxAmount || 10.0;

    return await faucet.batchTransfer(payload.accounts, minAmount, maxAmount);
  } else {
    throw new Error(`Invalid mode: ${payload.mode}`);
  }
};

