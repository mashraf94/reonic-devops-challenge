import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';;
import { EnvironmentConfig } from '../config/environment-config';
import { ResourceMonitoring } from './monitoring';

export interface PostgresDbProps {
  vpc: ec2.IVpc;
  config: EnvironmentConfig;
  dbSubnets: ec2.ISubnet[];
  dbSGs: ec2.ISecurityGroup[];
  dbName?: string;
  dbUser?: string;
  port?: number;
  multiAz?: boolean;
  allocatedStorageGb?: number;
  instanceClass?: ec2.InstanceType;
  alertEmail?: string;
}

export class PostgresDb extends Construct {
  public readonly database: rds.DatabaseInstance;
  public readonly secret: secrets.ISecret;
  public readonly pgparameters: rds.IParameterGroup;
  public readonly port: number;
  public readonly storage: number;

  constructor(scope: Construct, id: string, props: PostgresDbProps) {
    super(scope, id);

    this.port = props.port ?? props.config.database.port;
    this.storage = this.storage ?? props.config.database.allocatedStorage;

    // Create custom parameter group to disable SSL on postgres 15+
    this.pgparameters = new rds.ParameterGroup(this, 'Parameters', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      parameters: {
        'rds.force_ssl': '0',
      },
    });

    // Create RDS instance
    this.database = new rds.DatabaseInstance(this, 'Database', {
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.dbSubnets
      },
      securityGroups: props.dbSGs,
      parameterGroup: this.pgparameters,
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_15 }),
      instanceType: props.instanceClass ?? ec2.InstanceType.of(
        props.config.database.instanceClass.split('.')[0] as ec2.InstanceClass,
        props.config.database.instanceClass.split('.')[1] as ec2.InstanceSize
      ),
      credentials: rds.Credentials.fromGeneratedSecret(props.dbUser ?? 'reonic'),
      databaseName: props.dbName ?? 'reonic',
      port: this.port,
      multiAz: props.multiAz ?? props.config.database.multiAz,
      allocatedStorage: this.storage,
      maxAllocatedStorage: this.storage * 2,
      deletionProtection: props.config.database.deletionProtection,
      removalPolicy: props.config.database.removalPolicy,
      storageEncrypted: true,
      backupRetention: props.config.database.backupRetention,
      enablePerformanceInsights: props.config.stage == 'prod',
      cloudwatchLogsExports: ['postgresql'],
    });

    this.secret = this.database.secret!;

    // Add monitoring
    const monitoring = new ResourceMonitoring(this, 'Monitoring', {
      config: props.config,
      alertEmail: props.alertEmail,
    });

    monitoring.addRdsMonitoring(this);
  }
}
