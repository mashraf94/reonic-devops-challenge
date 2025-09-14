#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ReonicStage } from '../lib/stages/reonic-stage';
import { getEnvironmentConfig } from '../lib/config/environment-config';

const app = new cdk.App();

// Create DEV Stage
const devConfig = getEnvironmentConfig('dev');
new ReonicStage(app, 'dev', {
  config: devConfig,
  env: {
    account: devConfig.account,
    region: devConfig.region,
  },
});

// Create PROD Stage
const prodConfig = getEnvironmentConfig('prod');
new ReonicStage(app, 'prod', {
  config: prodConfig,
  env: {
    account: prodConfig.account,
    region: prodConfig.region,
  },
});
