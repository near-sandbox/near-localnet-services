# NEAR Localnet Faucet

Standalone NEAR token faucet service for distributing test tokens on localnet. This service provides a Lambda-based deployment for automated token distribution without requiring DynamoDB or other external dependencies.

## Overview

The NEAR Faucet service sends NEAR tokens from a master account to user wallets on a localnet. It supports both single transfers and batch transfers to multiple accounts.

**Key Features:**
- Direct NEAR account ID support (no phone number mapping required)
- Single and batch transfer modes
- AWS Lambda deployment via CDK
- SSM-based master account key management
- VPC support for accessing NEAR nodes

## Prerequisites

- AWS Account with appropriate permissions
- NEAR localnet node running (accessible via RPC URL)
- Master account key stored in AWS Systems Manager Parameter Store
- Node.js 20.x and TypeScript installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)

## SSM Setup

Before deploying, you need to store the master account credentials in AWS SSM Parameter Store:

### 1. Store Localnet Account ID

```bash
aws ssm put-parameter \
  --name "/near-localnet/localnet-account-id" \
  --value "localnet" \
  --type "String" \
  --profile ${AWS_PROFILE}
```

### 2. Store Localnet Account Private Key

```bash
aws ssm put-parameter \
  --name "/near-localnet/localnet-account-key" \
  --value "ed25519:YOUR_PRIVATE_KEY_HERE" \
  --type "SecureString" \
  --profile ${AWS_PROFILE}
```

**Note:** The localnet account keypair is automatically generated and stored in SSM by Layer 1 (NEAR Base) during deployment. You typically don't need to manually create these parameters.

**Note:** The private key should be in the format `ed25519:...` as exported by NEAR CLI or near-api-js.

## Deployment

### Option 1: Deploy with New VPC (Default)

This creates a new VPC with all necessary components:

```bash
cd cdk
npm install
npm run build

# Set AWS profile (required)
export AWS_PROFILE=your-profile-name

# Deploy
npm run deploy
```

### Option 2: Deploy with Existing VPC

If you already have a VPC with a NEAR node, you can use it:

```bash
cd cdk
npm install
npm run build

export AWS_PROFILE=your-profile-name

# Deploy with existing VPC
cdk deploy --context vpcId=vpc-xxxxx --context securityGroupId=sg-xxxxx --context nearNodeUrl=http://10.0.1.100:3030
```

### Option 3: Custom SSM Parameter Names

If you're using different SSM parameter names:

```bash
cdk deploy \
  --context ssmLocalnetAccountIdParam=/custom/path/localnet-account-id \
  --context ssmLocalnetAccountKeyParam=/custom/path/localnet-account-key
```

## Usage

### Single Transfer

Send tokens to a single NEAR account:

```bash
aws lambda invoke \
  --function-name near-localnet-faucet \
  --payload '{"mode":"single","accountId":"user.near","amount":"5.0"}' \
  --profile ${AWS_PROFILE} \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json | jq
```

**Response:**
```json
{
  "success": true,
  "mode": "single",
  "transfers": [
    {
      "account": "user.near",
      "amount": "5.0",
      "txHash": "ABC123...",
      "success": true
    }
  ],
  "summary": {
    "totalSelected": 1,
    "successful": 1,
    "failed": 0,
    "totalSent": "5.0"
  }
}
```

### Batch Transfer

Send random amounts to multiple accounts:

```bash
aws lambda invoke \
  --function-name near-localnet-faucet \
  --payload '{
    "mode":"batch",
    "accounts":["user1.near","user2.near","user3.near"],
    "minAmount":1.0,
    "maxAmount":10.0
  }' \
  --profile ${AWS_PROFILE} \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json | jq
```

**Response:**
```json
{
  "success": true,
  "mode": "batch",
  "transfers": [
    {
      "account": "user1.near",
      "amount": "7.23",
      "txHash": "DEF456...",
      "success": true
    },
    {
      "account": "user2.near",
      "amount": "3.45",
      "txHash": "GHI789...",
      "success": true
    },
    {
      "account": "user3.near",
      "amount": "9.12",
      "txHash": "JKL012...",
      "success": true
    }
  ],
  "summary": {
    "totalSelected": 3,
    "successful": 3,
    "failed": 0,
    "totalSent": "19.80"
  }
}
```

## API Reference

### FaucetEvent Interface

```typescript
interface FaucetEvent {
  mode: 'single' | 'batch';
  accountId?: string;        // For single mode (NEAR account ID)
  amount?: string;           // For single mode
  accounts?: string[];       // For batch mode (array of NEAR account IDs)
  minAmount?: number;        // For batch mode (default: 1.0)
  maxAmount?: number;        // For batch mode (default: 10.0)
}
```

### FaucetResult Interface

```typescript
interface FaucetResult {
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

interface FaucetTransfer {
  account: string;
  amount: string;
  txHash?: string;
  success: boolean;
  error?: string;
}
```

## Environment Variables

The Lambda function uses the following environment variables (configured via CDK):

- `NEAR_NETWORK`: Network ID (default: `localnet`)
- `NEAR_NODE_URL`: NEAR RPC endpoint URL (default: `http://localhost:3030`)
- `SSM_LOCALNET_ACCOUNT_ID_PARAM`: SSM parameter name for localnet account ID (default: `/near-localnet/localnet-account-id`)
- `SSM_LOCALNET_ACCOUNT_KEY_PARAM`: SSM parameter name for localnet account key (default: `/near-localnet/localnet-account-key`)

## Architecture

```
┌─────────────┐
│   Lambda    │
│  Function   │
└──────┬──────┘
       │
       ├───> SSM Parameter Store (Localnet Account Key)
       │
       ├───> NEAR RPC Node (via VPC)
       │
       └───> CloudWatch Logs
```

## Development

### Building the Lambda Code

```bash
cd ../src  # or just from faucet root
npm install
npm run build
```

### Running Tests

Tests can be added to verify the faucet logic. The code structure supports unit testing of the `NearFaucet` class.

### Local Testing

For local testing, you can use the Lambda handler directly with mock SSM clients, or use AWS SAM for local Lambda execution.

## Troubleshooting

### Lambda Timeout

If batch transfers timeout, increase the Lambda timeout in the CDK stack (default: 5 minutes).

### SSM Parameter Not Found

Ensure the SSM parameters are created in the same AWS region where the Lambda is deployed.

### VPC Connectivity Issues

If the Lambda cannot reach the NEAR node:
1. Verify the security group allows outbound traffic
2. Check that the NEAR node is accessible from the Lambda's subnet
3. Ensure NAT Gateway is configured for private subnets

### Transaction Failures

Common causes:
- Insufficient balance in localnet account
- Invalid NEAR account ID format (must be `*.localnet` for localnet)
- NEAR node not responding
- Network connectivity issues

Check CloudWatch Logs for detailed error messages.

## License

MIT

