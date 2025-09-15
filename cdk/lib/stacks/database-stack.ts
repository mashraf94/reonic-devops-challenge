import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { PostgresDb } from '../constructs/postgres-db';
import { EnvironmentConfig } from '../config/environment-config';

export interface DatabaseStackProps extends StackProps {
  vpc: ec2.IVpc;
  config: EnvironmentConfig;
  dbSubnets: ec2.ISubnet[];
  dbSGs: ec2.ISecurityGroup[];
}

export type DbRegistry = {
  demoDB: PostgresDb,
};

export class DatabaseStack extends Stack {
  public readonly dbs: DbRegistry;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const demoDB = new PostgresDb(this, 'demo', {
      vpc: props.vpc,
      config: props.config,
      dbSubnets: props.dbSubnets,
      dbSGs: props.dbSGs,
      dbName: 'reonic_demo',
      port: 5439,
    });

    this.dbs = { demoDB };
  }
}
