# GitHub Repository Configuration

This directory contains GitHub-specific configuration files for the NEAR Localnet Services repository.

## Files

- **workflows/ci.yml**: GitHub Actions CI/CD pipeline
  - Runs linting and build checks
  - Synthesizes CDK stacks
  - Tests on Node.js 20.x

- **PULL_REQUEST_TEMPLATE.md**: Template for pull requests
  - Guides contributors on what to include
  - Ensures consistent PR format

- **ISSUE_TEMPLATE/**: Issue templates
  - `bug_report.md`: Template for bug reports
  - `feature_request.md`: Template for feature requests

## CI/CD Pipeline

The CI pipeline (`workflows/ci.yml`) automatically:

1. **Lint and Build**: Checks code quality and builds each service
2. **CDK Synth**: Validates CDK stacks can be synthesized
3. **Matrix Testing**: Tests multiple services and Node.js versions

### Running CI Locally

To test CI locally before pushing:

```bash
# Install act (GitHub Actions locally)
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run CI workflow
act -j lint-and-build
act -j cdk-synth
```

## Customization

To add a new service to CI:

1. Add the service name to the `matrix.service` array in `ci.yml`
2. Ensure the service has `package.json` with build/test scripts
3. Update the matrix if the service has a CDK stack

