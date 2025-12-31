#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FaucetStack } from '../lib/faucet-stack';

const app = new cdk.App();

// Get environment variables or context
const accountId = app.node.tryGetContext('accountId') || process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';

// Get configuration from context or environment
const vpcId = app.node.tryGetContext('vpcId');
const securityGroupId = app.node.tryGetContext('securityGroupId');
const nearNodeUrl = app.node.tryGetContext('nearNodeUrl') || process.env.NEAR_NODE_URL;
const ssmLocalnetAccountIdParam = app.node.tryGetContext('ssmLocalnetAccountIdParam') || '/near-localnet/localnet-account-id';
const ssmLocalnetAccountKeyParam = app.node.tryGetContext('ssmLocalnetAccountKeyParam') || '/near-localnet/localnet-account-key';

new FaucetStack(app, 'NearFaucetStack', {
  // NOTE: v2 may be stuck in DELETE_IN_PROGRESS due to Lambda VPC ENI cleanup.
  // Bump the stack name to allow fresh deployments while v2 finishes deleting.
  // v3 may also be stuck in DELETE_IN_PROGRESS from a previous rollback.
  // v5 may also be stuck in DELETE_IN_PROGRESS from a previous rollback.
  stackName: 'near-localnet-faucet-v6',
  env: {
    account: accountId,
    region: region,
  },
  description: 'NEAR Localnet Faucet Lambda Stack',
  vpcId,
  securityGroupId,
  nearNodeUrl,
  ssmLocalnetAccountIdParam,
  ssmLocalnetAccountKeyParam,
});

app.synth();

