# Repository Setup Guide

This guide will help you set up the `near-localnet-services` repository for development.

## Initial Git Repository Setup

### 1. Initialize Git Repository

If this is a new repository:

```bash
cd near-localnet-services
git init
git branch -M main
```

### 2. Add Remote Repository

After creating the repository on GitHub (e.g., `github.com/near-sandbox/near-localnet-services`):

```bash
git remote add origin https://github.com/near-sandbox/near-localnet-services.git
# Or if using SSH:
# git remote add origin git@github.com:near-sandbox/near-localnet-services.git
```

### 3. Initial Commit

```bash
# Add all files
git add .

# Create initial commit
git commit -m "feat: initial commit - NEAR Localnet Services with Faucet"

# Push to main branch
git push -u origin main
```

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### Making Changes

1. Make your code changes
2. Test locally
3. Commit with conventional commit messages:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Pushing Changes

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Service-Specific Setup

### Faucet Service

```bash
cd faucet
npm install
npm run build
```

For CDK deployment:

```bash
cd faucet/cdk
npm install
npm run build
```

## Environment Configuration

### AWS Profile Setup

Create or update your AWS profile:

```bash
aws configure --profile your-profile-name
```

Or set environment variable:

```bash
export AWS_PROFILE=your-profile-name
```

### SSM Parameter Setup (updated: `.localnet`)

Before deploying the faucet, set up SSM parameters:

```bash
# Set localnet account ID
aws ssm put-parameter \
  --name "/near-localnet/localnet-account-id" \
  --value "localnet" \
  --type "String" \
  --profile ${AWS_PROFILE}

# Set localnet account key (replace with your actual key)
aws ssm put-parameter \
  --name "/near-localnet/localnet-account-key" \
  --value "ed25519:YOUR_PRIVATE_KEY_HERE" \
  --type "SecureString" \
  --profile ${AWS_PROFILE}
```

## Verification

After setup, verify everything works:

```bash
# Check git status
git status

# Verify service builds
cd faucet && npm run build

# Verify CDK synthesizes
cd faucet/cdk && npm run synth
```

## Next Steps

- Read [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines
- Review [faucet/README.md](./faucet/README.md) for faucet-specific documentation
- Check [.github/workflows/ci.yml](./.github/workflows/ci.yml) for CI/CD configuration

