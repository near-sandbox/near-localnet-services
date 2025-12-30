# Layer 2: NEAR Services - Complete with Core Contracts

> IMPORTANT: This repo’s canonical Faucet documentation is `faucet/README.md`.

## Overview
Layer 2 provides essential utility services for NEAR localnet development, mirroring testnet/mainnet capabilities.

## Components

### 1. Faucet Service ✅
**Stack**: `near-localnet-faucet-v2`
**Function URL**: `https://ee4nn4wyjwxn3wpewkdlp62iia0aqoua.lambda-url.us-east-1.on.aws/`

**Capabilities**:
- `sendMoney` mode: Fund existing accounts
- `createAccount` mode: Create and fund new accounts
- Supports implicit accounts (hex addresses)
- Supports named accounts (`alice.localnet`)

**Integration**: Lambda deployed in Layer 1 VPC for private RPC access

### 2. Core Contracts ✅
Deployed from [near/core-contracts](https://github.com/near/core-contracts) using pre-built production WASMs:

| Contract | Account | Purpose | Tx Hash |
|----------|---------|---------|---------|
| w-near | `wrap.localnet` | Wrapped NEAR token | (verify after deploy) |
| whitelist | `whitelist.localnet` | Staking pool whitelist | (verify after deploy) |
| staking-pool-factory | `poolv1.localnet` | Validator delegation | (verify after deploy) |

## Parity Status

### ✅ Achieved
- Account creation (via Faucet)
- Token transfers  
- System contracts deployed
- Contract deployment capability
- Latest NEAR tech (no downgrades)

### Naming Parity
This stack targets `.localnet` naming parity (like testnet’s `.testnet`):
- Root account: `localnet` (added via Layer 1 genesis modification)
- Faucet uses `localnet` key from SSM
- Result: `alice.localnet`, `bob.localnet`, etc.

## Deployment Process

The orchestrator automatically:
1. Deploys Faucet Lambda (CDK)
2. Clones `near/core-contracts` (latest)
3. Deploys contracts using pre-built WASMs
4. Verifies deployments

## Repository
- GitHub: `https://github.com/near-sandbox/near-localnet-services`
- Branch: `main`
- Status: ✅ All changes committed

## Testing

```bash
# Test Faucet
curl -X POST "https://ee4nn4wyjwxn3wpewkdlp62iia0aqoua.lambda-url.us-east-1.on.aws/" \
  -H "Content-Type: application/json" \
  -d '{"mode": "createAccount", "accountId": "test.localnet", "publicKey": "ed25519:...", "amount": "10"}'

# Verify contracts (requires SSM tunnel or VPC access)
curl http://localhost:3030 -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"view_account","finality":"final","account_id":"wrap.localnet"}}'
```

## Next Steps
1. ✅ Document current state
2. ⏳ Implement `.localnet` naming (registrar setup)
3. ⏳ Proceed to Layer 3 (Chain Signatures)

## Dependencies
- Layer 1: NEAR Base (RPC node)
- AWS SSM: Master account key storage
- GitHub: near/core-contracts (pre-built WASMs)

