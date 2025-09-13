#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { getEnvironmentConfig } from '../lib/config/environment-config';
import { ImageRepoStack } from '../lib/stacks/image-repo-stack';

const app = new cdk.App();

// Get environment from context
const stage = app.node.tryGetContext('stage') || 'DEV';
const config = getEnvironmentConfig(stage);

// 1. Network Stack (Foundation)
const networkStack = new NetworkStack(app, 'Reonic-Network', {
  config,
  env: {
    account: config.account,
    region: config.region,
  },
});


// 2. Image Repo Stack
const imageRepoStack = new ImageRepoStack(app, 'Reonic-ImageRepo', {
  config,
});

// 3. Database Stack (depends on Network)
const databaseStack = new DatabaseStack(app, 'Reonic-Database', {
  config,
  vpc: networkStack.vpc,
  rdsSG: networkStack.rdsSG,
  rdsSubnets: networkStack.rdsSubnets.subnets,
  env: {
    account: config.account,
    region: config.region,
  },
});
databaseStack.addDependency(networkStack);

// 4. Compute Stack (depends on Network and Database)
const computeStack = new ComputeStack(app, 'Reonic-Compute', {
  config,
  vpc: networkStack.vpc,
  ecr: imageRepoStack.ecrRepository,
  lambdaSG: networkStack.lambdaSG,
  lambdaSubnets: networkStack.lambdaSubnets.subnets,
  rdsSecret: databaseStack.rdsSecret,
  rdsEndpoint: databaseStack.rdsEndpoint,
  env: {
    account: config.account,
    region: config.region,
  },
});
computeStack.addDependency(networkStack);
computeStack.addDependency(imageRepoStack);
computeStack.addDependency(databaseStack);
