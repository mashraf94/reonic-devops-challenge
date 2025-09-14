import { Duration, RemovalPolicy } from "aws-cdk-lib";


export interface EnvironmentConfig {
  readonly stage: string;
  readonly region: string;
  readonly account?: string;

  // Network Configuration
  readonly vpc: {
    readonly cidr: string;
    readonly natGateways: number;
    readonly enableInternet: boolean;
  };

  // Database Configuration
  readonly database: {
    readonly port: number;
    readonly instanceClass: string;
    readonly allocatedStorage: number;
    readonly multiAz: boolean;
    readonly deletionProtection: boolean;
    readonly removalPolicy: RemovalPolicy;
    readonly backupRetention: Duration;
  };

  // Compute Configuration
  readonly lambda: {
    readonly timeout: number;
  };

  // Monitoring Configuration
  readonly monitoring: {
    readonly alertEmail: string;
  }
}

export const getEnvironmentConfig = (stage: string): EnvironmentConfig => {
  const configs: Record<string, EnvironmentConfig> = {
    dev: {
      stage: 'dev',
      region: process.env.AWS_REGION ?? 'us-east-1',
      account: process.env.CDK_DEFAULT_ACCOUNT,
      vpc: {
        enableInternet: false,
        cidr: '10.0.0.0/16',
        natGateways: 1,
      },
      database: {
        port: 5432,
        instanceClass: 't4g.micro',
        allocatedStorage: 20,
        multiAz: false,
        deletionProtection: false,
        removalPolicy: RemovalPolicy.SNAPSHOT,
        backupRetention: Duration.days(1),
      },
      lambda: {
        timeout: 30,
      },
      monitoring: {
        alertEmail: 'mohamed.aktaha@gmail.com',
      },
    },
    prod: {
      stage: 'prod',
      region: process.env.AWS_REGION ?? 'eu-central-1',
      account: process.env.CDK_DEFAULT_ACCOUNT,
      vpc: {
        enableInternet: false,
        cidr: '10.0.0.0/16',
        natGateways: 3,
      },
      database: {
        port: 5445,
        instanceClass: 't4g.small',
        allocatedStorage: 100,
        multiAz: true,
        deletionProtection: true,
        removalPolicy: RemovalPolicy.RETAIN,
        backupRetention: Duration.days(7),
      },
      lambda: {
        timeout: 30,
      },
      monitoring: {
        alertEmail: 'mohamed.aktaha@gmail.com',
      },
    },
  };

  return configs[stage] || configs.dev;
};