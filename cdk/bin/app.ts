#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
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
