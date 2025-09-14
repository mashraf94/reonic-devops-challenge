import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { DockerLambda } from '../constructs/docker-lambda';
import type { DbRegistry } from './database-stack';
import { EnvironmentConfig } from '../config/environment-config';

export interface ComputeStackProps extends StackProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  lambdaSubnets: ec2.ISubnet[];
  lambdaSGs: ec2.ISecurityGroup[];
  dbs: DbRegistry;
}

export class ComputeStack extends Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const dockerLambda = new DockerLambda(this, 'demo', {
      config: props.config,
      fnName: 'reonic_demo',
      database: props.dbs.demoDB,
      repo: ecr.Repository.fromRepositoryName(this, 'demoRepo', process.env.DEMO_ECR_REPO!),
      imageTagOrDigest: process.env.DEMO_IMAGE_SHA!,
      vpc: props.vpc,
      lambdaSubnets: props.lambdaSubnets,
      lambdaSGs: props.lambdaSGs,
    });

    // Stack Outputs
    new CfnOutput(this, 'ApiEndpoint', {
      value: dockerLambda.api.url,
      description: 'API Gateway endpoint URL',
      exportName: `${props.config.stage}-api-endpoint`,
    });

    new CfnOutput(this, 'LambdaFunctionName', {
      value: dockerLambda.fn.functionName,
      description: 'Lambda function name',
      exportName: `${props.config.stage}-lambda-name`,
    });
  }
}
