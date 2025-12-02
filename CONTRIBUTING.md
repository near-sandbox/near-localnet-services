# Contributing to NEAR Localnet Services

Thank you for your interest in contributing to NEAR Localnet Services! This document provides guidelines and instructions for contributing.

## Overview

NEAR Localnet Services is a collection of standalone services needed to run and manage a NEAR localnet development environment. Each service is independently deployable and reusable.

## Repository Structure

```
near-localnet-services/
├── README.md              # Overview of all services
├── CONTRIBUTING.md        # This file
├── faucet/                # NEAR Faucet Service
│   ├── README.md         # Service-specific documentation
│   ├── package.json       # Service package configuration
│   ├── src/              # Source code
│   └── cdk/              # CDK deployment (if applicable)
└── [future-services]/    # Additional services
```

## Development Setup

### Prerequisites

- Node.js 20.x or higher
- TypeScript 5.3+
- AWS CLI configured (for CDK deployments)
- AWS CDK CLI installed (`npm install -g aws-cdk`)

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/near-sandbox/near-localnet-services.git
   cd near-localnet-services
   ```

2. **Install dependencies for a specific service**
   ```bash
   cd faucet
   npm install
   ```

3. **Build the service**
   ```bash
   npm run build
   ```

4. **Set up AWS credentials**
   ```bash
   export AWS_PROFILE=your-profile-name
   # Or configure AWS credentials via AWS CLI
   ```

## Adding a New Service

When adding a new service to this collection:

1. **Create service directory**
   ```bash
   mkdir new-service
   cd new-service
   ```

2. **Initialize package**
   ```bash
   npm init -y
   # Edit package.json with appropriate name and description
   ```

3. **Set up TypeScript**
   - Create `tsconfig.json` (see `faucet/tsconfig.json` as reference)
   - Create `src/` directory for source code
   - Add build scripts to `package.json`

4. **Add documentation**
   - Create `README.md` with:
     - Service overview
     - Prerequisites
     - Installation instructions
     - Usage examples
     - API reference (if applicable)

5. **Update root README**
   - Add your service to the services list in `near-localnet-services/README.md`

6. **Follow code style**
   - Use TypeScript strict mode
   - Follow existing code patterns
   - Add JSDoc comments for public APIs

## Code Style Guidelines

### TypeScript

- Use strict mode (`"strict": true` in `tsconfig.json`)
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Export types and interfaces from a `types.ts` file when shared

### Naming Conventions

- Files: `kebab-case.ts` for source files
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

### Documentation

- Add JSDoc comments for public functions and classes
- Include usage examples in README files
- Document environment variables and configuration options

## Testing

### Unit Tests

- Add tests in `__tests__/` or `test/` directories
- Use Jest or your preferred testing framework
- Aim for high coverage of core functionality

### Integration Tests

- Test against a real NEAR localnet node
- Document test setup requirements
- Include test fixtures and mock data

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following style guidelines
   - Add tests for new functionality
   - Update documentation

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add description of your change"
   ```

   Use conventional commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `refactor:` for code refactoring
   - `test:` for test additions/changes

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a pull request on GitHub.

5. **PR Review**
   - Ensure all CI checks pass
   - Address review feedback
   - Update PR description with testing notes

## Service-Specific Guidelines

### Faucet Service

- Keep Lambda handler focused on token distribution
- Support both single and batch transfers
- Use SSM for master account key management
- Document SSM parameter setup requirements

### Future Services

- Follow the same patterns established by the faucet service
- Maintain independence from other services
- Use environment variables for configuration
- Support both local and AWS Lambda deployment

## Deployment

### CDK Deployment

For services with CDK stacks:

1. **Navigate to CDK directory**
   ```bash
   cd faucet/cdk
   npm install
   ```

2. **Synthesize stack**
   ```bash
   npm run synth
   ```

3. **Deploy**
   ```bash
   export AWS_PROFILE=your-profile-name
   npm run deploy
   ```

### Environment Variables

- Never commit `.env` files
- Document required environment variables in README
- Use `.env.example` files as templates

## Security Guidelines

- **Never commit secrets**: Private keys, API keys, or credentials
- **Use SSM Parameter Store**: For sensitive configuration in AWS
- **Review dependencies**: Regularly update dependencies for security patches
- **Validate inputs**: Sanitize and validate all user inputs

## Questions?

- Open an issue on GitHub for questions or discussions
- Check existing documentation in service README files
- Review existing code for examples and patterns

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

