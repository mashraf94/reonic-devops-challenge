import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { EnvironmentConfig } from '../config/environment-config';

export interface ComputeStackProps extends StackProps {
  readonly config: EnvironmentConfig;
  readonly vpc: ec2.IVpc;
  readonly ecr: ecr.IRepository;
  readonly lambdaSG: ec2.ISecurityGroup;
  readonly lambdaSubnets: ec2.ISubnet[];
  readonly rdsSecret: secretsmanager.ISecret;
  readonly rdsEndpoint: string;
}

export class ComputeStack extends Stack {
  public readonly lambdaFunction: lambda.Function;
  public readonly api: apigateway.LambdaRestApi;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // Create Lambda function
    this.lambdaFunction = new lambda.DockerImageFunction(this, 'APIFunction', {
      functionName: `reonic-api-${props.config.stage}`,
      code: lambda.DockerImageCode.fromEcr(props.ecr, {
        tagOrDigest: process.env.IMAGE_SHA || process.env.IMAGE_TAG || 'latest',
      }),
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.lambdaSubnets,
      },
      securityGroups: [props.lambdaSG],
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.seconds(props.config.lambda.timeout),
      environment: {
        DB_SECRET_NAME: props.rdsSecret.secretName,
      },
    });

    // Grant permissions
    props.rdsSecret.grantRead(this.lambdaFunction);

    // Create Lambda alias for blue/green deployments
    const liveAlias = new lambda.Alias(this, 'LiveAlias', {
      aliasName: 'live',
      version: this.lambdaFunction.currentVersion,
    });

    // Create API Gateway with Lambda integration
    this.api = new apigateway.LambdaRestApi(this, 'LambdaAPIGW', {
      handler: liveAlias,
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
      },
    });

    // Outputs
    new CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${props.config.stage}-api-url`,
    });

    new CfnOutput(this, 'LambdaFunctionArn', {
      value: this.lambdaFunction.functionArn,
      exportName: `${props.config.stage}-lambda-arn`,
    });
  }
}