#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FaucetStack } from '../lib/faucet-stack';

const app = new cdk.App();

// Get environment variables
const accountId = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';

// Get configuration from context or environment
const vpcId = app.node.tryGetContext('vpcId');
const securityGroupId = app.node.tryGetContext('securityGroupId');
const nearNodeUrl = app.node.tryGetContext('nearNodeUrl') || process.env.NEAR_NODE_URL;
const ssmMasterAccountIdParam = app.node.tryGetContext('ssmMasterAccountIdParam') || '/near-localnet/master-account-id';
const ssmMasterAccountKeyParam = app.node.tryGetContext('ssmMasterAccountKeyParam') || '/near-localnet/master-account-key';

new FaucetStack(app, 'NearFaucetStack', {
  stackName: 'near-localnet-faucet',
  env: {
    account: accountId,
    region: region,
  },
  description: 'NEAR Localnet Faucet Lambda Stack',
  vpcId,
  securityGroupId,
  nearNodeUrl,
  ssmMasterAccountIdParam,
  ssmMasterAccountKeyParam,
});

app.synth();

