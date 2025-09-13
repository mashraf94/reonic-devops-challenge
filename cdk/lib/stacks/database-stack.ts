import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { EnvironmentConfig } from '../config/environment-config';

export interface DatabaseStackProps extends StackProps {
  readonly config: EnvironmentConfig;
  readonly vpc: ec2.IVpc;
  readonly rdsSG: ec2.ISecurityGroup;
  readonly rdsSubnets: ec2.ISubnet[];
}

export class DatabaseStack extends Stack {
  public readonly rds: rds.DatabaseInstance;
  public readonly rdsSecret: secretsmanager.ISecret;
  public readonly rdsEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);


    // Create subnet group
    const rdsSubnetGroup = new rds.SubnetGroup(this, 'RDSSubnetGroup', {
      description: 'Isolated Subnet group for RDS',
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.rdsSubnets
      },
    });

    // Create RDS instance
    this.rds = new rds.DatabaseInstance(this, 'RDSDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        props.config.database.instanceClass.split('.')[0] as ec2.InstanceClass,
        props.config.database.instanceClass.split('.')[1] as ec2.InstanceSize
      ),
      vpc: props.vpc,
      subnetGroup: rdsSubnetGroup,
      securityGroups: [props.rdsSG],
      databaseName: 'reonic',
      credentials: rds.Credentials.fromGeneratedSecret('reonic', {
        secretName: `${props.config.stage}-rds-credentials`,
      }),
      port: props.config.database.port,
      multiAz: props.config.database.multiAz,
      allocatedStorage: props.config.database.allocatedStorage,
      maxAllocatedStorage: props.config.database.allocatedStorage * 2,
      storageEncrypted: true,
      backupRetention: Duration.days(props.config.stage === 'PROD' ? 7 : 1),
      deletionProtection: props.config.stage === 'PROD',
      removalPolicy: props.config.stage === 'PROD'
        ? RemovalPolicy.SNAPSHOT
        : RemovalPolicy.DESTROY,
      enablePerformanceInsights: props.config.stage === 'PROD',
      cloudwatchLogsExports: ['postgresql'],
    });

    // Get the auto-generated secret
    this.rdsSecret = this.rds.secret!;
    this.rdsEndpoint = this.rds.dbInstanceEndpointAddress;

    // Outputs for cross-stack references
    new CfnOutput(this, 'RDSEndpoint', {
      value: this.rdsEndpoint,
      exportName: 'rds-endpoint',
    });

    new CfnOutput(this, 'RDSSecretArn', {
      value: this.rdsSecret.secretArn,
      exportName: 'rds-secret-arn',
    });
  }
}