export interface EnvironmentConfig {
  readonly stage: string;
  readonly region: string;
  readonly account?: string;

  // Network Configuration
  readonly vpc: {
    readonly cidr: string;
  };

  // Database Configuration  
  readonly database: {
    readonly port: number;
    readonly instanceClass: string;
    readonly allocatedStorage: number;
    readonly multiAz: boolean;
  };

  // Compute Configuration
  readonly lambda: {
    readonly timeout: number;
  };
}

export const getEnvironmentConfig = (stage: string): EnvironmentConfig => {
  const configs: Record<string, EnvironmentConfig> = {
    DEV: {
      stage: 'DEV',
      region: 'eu-central-1',
      account: process.env.CDK_DEFAULT_ACCOUNT,
      vpc: {
        cidr: '10.0.0.0/16',
      },
      database: {
        port: 5432,
        instanceClass: 't4g.micro',
        allocatedStorage: 20,
        multiAz: false,
      },
      lambda: {
        timeout: 30,
      },
    },
    PROD: {
      stage: 'PROD',
      region: 'eu-central-1',
      account: process.env.CDK_DEFAULT_ACCOUNT,
      vpc: {
        cidr: '10.0.0.0/16',
      },
      database: {
        port: 5445,
        instanceClass: 't4g.small',
        allocatedStorage: 100,
        multiAz: true,
      },
      lambda: {
        timeout: 60,
      },
    },
  };

  return configs[stage] || configs.DEV;
};