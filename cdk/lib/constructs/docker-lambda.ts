import { Construct } from 'constructs';
import { Duration, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import { EnvironmentConfig } from '../config/environment-config';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { PostgresDb } from './postgres-db';
import { ResourceMonitoring } from './monitoring';

export interface DockerLambdaProps {
  vpc: ec2.IVpc;
  repo: ecr.IRepository;
  config: EnvironmentConfig;
  database?: PostgresDb;
  lambdaSubnets: ec2.ISubnet[];
  lambdaSGs: ec2.ISecurityGroup[];
  fnName: string;
  imageTagOrDigest: string;
  corsAllowOrigins?: string[];
  corsAllowHeaders?: string[];
  canaryDeploy?: boolean;
  alertEmail?: string;
}

export class DockerLambda extends Construct {
  public readonly fn: lambda.DockerImageFunction;
  public readonly alias: lambda.Alias;
  public readonly api: apigw.LambdaRestApi;

  constructor(scope: Construct, id: string, props: DockerLambdaProps) {
    super(scope, id);

    // Lambda Main Function based on Docker Image
    this.fn = new lambda.DockerImageFunction(this, 'Fn', {
      functionName: props.fnName,
      code: lambda.DockerImageCode.fromEcr(props.repo, {
        tagOrDigest: props.imageTagOrDigest || 'latest',
      }),
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.seconds(props.config.lambda.timeout),
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.lambdaSubnets,
      },
      securityGroups: props.lambdaSGs,
      tracing: props.config.stage == 'prod' ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      insightsVersion: props.config.stage == 'prod' ? lambda.LambdaInsightsVersion.VERSION_1_0_404_0 : undefined,
    });

    if (props.database) {
      this.fn.addEnvironment('DB_SECRET_NAME', props.database!.secret.secretName);

      // IAM Permission for managing RDS Secret
      props.database!.secret.grantRead(this.fn);
      props.database!.database.connections.allowFrom(
        this.fn,
        ec2.Port.tcp(props.database!.port)
      );
    }

    // Lambda Live Alias
    this.alias = new lambda.Alias(this, 'Alias', {
      aliasName: 'live',
      version: this.fn.currentVersion,
    });

    // Canary Deployments for smart rollouts
    if (props.canaryDeploy) {
      new codedeploy.LambdaDeploymentGroup(this, 'DG', {
        alias: this.alias,
        deploymentConfig: codedeploy.LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
      });
    }

    // API Gateway
    this.api = new apigw.LambdaRestApi(this, 'Api', {
      handler: this.alias,
      restApiName: `${props.fnName}-api`,
      deployOptions: {
        loggingLevel: props.config.stage == 'prod' ? apigateway.MethodLoggingLevel.ERROR : apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true,
        stageName: props.config.stage,
        tracingEnabled: props.config.stage == 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: props.corsAllowOrigins ?? apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: props.corsAllowHeaders ?? ['Content-Type', 'Authorization'],
      },
    });

    // Add monitoring
    const monitoring = new ResourceMonitoring(this, 'ComputeMonitoring', {
      config: props.config,
      alertEmail: props.alertEmail,
    });

    monitoring.addLambdaMonitoring(this.fn);
    monitoring.addApiGatewayMonitoring(this.api);
  }
}
