import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkStack } from '../stacks/network-stack';
import { DatabaseStack } from '../stacks/database-stack';
import { ComputeStack } from '../stacks/compute-stack';
import { EnvironmentConfig } from '../config/environment-config';

export interface ReonicStageProps extends StageProps {
  readonly config: EnvironmentConfig;
}

export class ReonicStage extends Stage {
  constructor(scope: Construct, id: string, props: ReonicStageProps) {
    super(scope, id, props);

    // 1. Network Stack (Foundation)
    const networkStack = new NetworkStack(this, 'Network', {
      config: props.config,
      env: {
        account: props.config.account,
        region: props.config.region,
      },
    });

    // 3. Database Stack (depends on Network)
    const databaseStack = new DatabaseStack(this, 'Database', {
      config: props.config,
      vpc: networkStack.vpc,
      dbSGs: [networkStack.rdsSG],
      dbSubnets: networkStack.rdsSubnets.subnets,
      env: {
        account: props.config.account,
        region: props.config.region,
      },
    });
    databaseStack.addDependency(networkStack);

    // 4. Compute Stack (depends on Network and Database)
    const computeStack = new ComputeStack(this, 'Compute', {
      config: props.config,
      vpc: networkStack.vpc,
      lambdaSGs: [networkStack.lambdaSG],
      lambdaSubnets: networkStack.lambdaSubnets.subnets,
      dbs: databaseStack.dbs,
      env: {
        account: props.config.account,
        region: props.config.region,
      },
    });
    computeStack.addDependency(networkStack);
    computeStack.addDependency(databaseStack);
  }
}