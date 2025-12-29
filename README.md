# NEAR Localnet Services

> **Layer 2: NEAR Services** - Essential utility services for localnet development

A collection of standalone services needed to run and manage a NEAR localnet development environment.

## Layer Architecture

This is **Layer 2** of the 5-layer NEAR Localnet Simulator Stack:

```
Layer 1: NEAR Base                  → AWSNodeRunner
Layer 2: NEAR Services (this repo)  ← You are here
Layer 3: Chain Signatures           → cross-chain-simulator  
Layer 4: Intents Protocol           → near-intents-simulator
Layer 5: User Applications          → Your dApp
```

**Depends on**: Layer 1 (NEAR Base) - requires RPC endpoint
**Provides to higher layers**: Faucet for token distribution, account management utilities

## Overview

This repository contains modular, shareable services for NEAR Protocol localnet development. Each service is designed to be independently deployable and reusable across different projects.

## Services

### [Faucet](./faucet/)

NEAR token faucet service for distributing test tokens on localnet. Provides Lambda-based deployment for automated token distribution.

**Features:**
- Single account transfers
- Batch transfers to multiple accounts
- AWS Lambda deployment
- SSM-based key management

See [faucet/README.md](./faucet/README.md) for detailed documentation.

## Future Services

Additional services planned for this collection:
- Helper services for localnet management
- Monitoring and health check services
- Account management utilities

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines and instructions.

Each service is independently versioned and can be used as a standalone package or deployed via CDK.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

