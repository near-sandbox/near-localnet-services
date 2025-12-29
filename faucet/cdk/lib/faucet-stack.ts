import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface FaucetStackProps extends cdk.StackProps {
  /**
   * Optional VPC ID to use. If not provided, a new VPC will be created.
   */
  vpcId?: string;

  /**
   * Optional Security Group ID to use. If not provided, a new security group will be created.
   */
  securityGroupId?: string;

  /**
   * NEAR node RPC URL. Defaults to http://localhost:3030
   */
  nearNodeUrl?: string;

  /**
   * SSM parameter name for master account ID. Defaults to /near-localnet/master-account-id
   */
  ssmMasterAccountIdParam?: string;

  /**
   * SSM parameter name for master account key. Defaults to /near-localnet/master-account-key
   */
  ssmMasterAccountKeyParam?: string;
}

export class FaucetStack extends cdk.Stack {
  public readonly faucetFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: FaucetStackProps) {
    super(scope, id, props);

    // ===== VPC Configuration =====
    let vpc: ec2.IVpc;
    let securityGroup: ec2.ISecurityGroup;

    if (props.vpcId) {
      // Use existing VPC
      vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
        vpcId: props.vpcId,
      });

      if (props.securityGroupId) {
        securityGroup = ec2.SecurityGroup.fromSecurityGroupId(
          this,
          'ExistingSecurityGroup',
          props.securityGroupId
        );
      } else {
        // Create new security group in existing VPC
        securityGroup = new ec2.SecurityGroup(this, 'FaucetSecurityGroup', {
          vpc,
          description: 'Security group for NEAR Faucet Lambda',
          allowAllOutbound: true,
        });
      }
    } else {
      // Create new VPC
      vpc = new ec2.Vpc(this, 'FaucetVpc', {
        maxAzs: 2,
        natGateways: 1, // For Lambda internet access (NEAR SDK dependencies)
      });

      // VPC Endpoints for SSM (required for Lambda to access SSM)
      vpc.addInterfaceEndpoint('SSMEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
        privateDnsEnabled: true,
      });

      vpc.addInterfaceEndpoint('SSMMessagesEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
        privateDnsEnabled: true,
      });

      // Create security group
      securityGroup = new ec2.SecurityGroup(this, 'FaucetSecurityGroup', {
        vpc,
        description: 'Security group for NEAR Faucet Lambda',
        allowAllOutbound: true,
      });

      // Allow Lambda to access NEAR RPC endpoint (if NEAR node is in same VPC)
      securityGroup.addIngressRule(
        ec2.Peer.ipv4(vpc.vpcCidrBlock),
        ec2.Port.tcp(3030),
        'Allow access to NEAR RPC endpoint'
      );
    }

    // ===== IAM Role for Lambda =====
    const lambdaRole = new iam.Role(this, 'FaucetLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Grant SSM read permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ssm:GetParameter',
          'ssm:GetParameters',
        ],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${props.ssmMasterAccountIdParam || '/near-localnet/master-account-id'}`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter${props.ssmMasterAccountKeyParam || '/near-localnet/master-account-key'}`,
        ],
      })
    );

    // ===== CloudWatch Log Group =====
    const logGroup = new logs.LogGroup(this, 'FaucetLogGroup', {
      logGroupName: '/aws/lambda/near-localnet-faucet',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ===== Lambda Function =====
    // Use the faucet root directory (contains package.json, src/, and dist/)
    const faucetRootPath = path.join(__dirname, '..', '..');
    
    this.faucetFunction = new lambda.Function(this, 'FaucetFunction', {
      functionName: 'near-localnet-faucet',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(faucetRootPath, {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm install',
              'npm run build',
              'cp -r dist/* /asset-output/',
              'cp package.json /asset-output/',
              'cd /asset-output && npm install --production',
            ].join(' && '),
          ],
          // Use local bundling if Docker is not available or fails
          local: {
            tryBundle(outputDir: string) {
              const fs = require('fs');
              const { execSync } = require('child_process');
              
              try {
                // Build locally
                execSync('npm install && npm run build', {
                  cwd: faucetRootPath,
                  stdio: 'inherit',
                });
                
                // Copy built files to output
                const distPath = path.join(faucetRootPath, 'dist');
                if (fs.existsSync(distPath)) {
                  execSync(`cp -r ${distPath}/* ${outputDir}/`, { stdio: 'inherit' });
                }
                
                // Copy package.json and install production deps
                execSync(`cp ${faucetRootPath}/package.json ${outputDir}/`, { stdio: 'inherit' });
                execSync('npm install --production', { cwd: outputDir, stdio: 'inherit' });
                
                return true;
              } catch (error) {
                console.error('Local bundling failed:', error);
                return false;
              }
            },
          },
        },
      }),
      timeout: cdk.Duration.seconds(300), // 5 minutes for batch operations
      memorySize: 512,
      role: lambdaRole,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment: {
        NEAR_NETWORK: 'localnet',
        NEAR_NODE_URL: props.nearNodeUrl || 'http://localhost:3030',
        SSM_MASTER_ACCOUNT_ID_PARAM: props.ssmMasterAccountIdParam || '/near-localnet/master-account-id',
        SSM_MASTER_ACCOUNT_KEY_PARAM: props.ssmMasterAccountKeyParam || '/near-localnet/master-account-key',
      },
      logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
    });

    // Output Lambda function ARN
    new cdk.CfnOutput(this, 'FaucetFunctionArn', {
      value: this.faucetFunction.functionArn,
      description: 'ARN of the NEAR Faucet Lambda function',
    });

    new cdk.CfnOutput(this, 'FaucetFunctionName', {
      value: this.faucetFunction.functionName,
      description: 'Name of the NEAR Faucet Lambda function',
    });
  }
}

