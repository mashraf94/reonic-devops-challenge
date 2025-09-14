import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { EnvironmentConfig } from '../config/environment-config';
import { PostgresDb } from './postgres-db';

export interface MonitoringConfig {
  config: EnvironmentConfig;
  alertEmail?: string;
}

export class ResourceMonitoring extends Construct {
  public readonly alertTopic?: sns.Topic;
  public readonly stage: string;
  public readonly alertEmail: string;
  public readonly lambdaTimeout: number;

  constructor(scope: Construct, id: string, props: MonitoringConfig) {
    super(scope, id);

    this.alertEmail = props.alertEmail ?? props.config.monitoring.alertEmail;
    this.lambdaTimeout = props.config.lambda.timeout;
    this.stage = props.config.stage;

    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      displayName: `${this.stage}-alerts`,
    });

    this.alertTopic.addSubscription(
      new subscriptions.EmailSubscription(this.alertEmail)
    );

  }

  // Default Lambda Monitoring
  public addLambdaMonitoring(lambdaFunction: lambda.IFunction): cloudwatch.Alarm[] {
    const timeoutMs = this.lambdaTimeout * 0.8 * 1000;

    // More than 5 errors/min for 3 mins
    const errorAlarm = new cloudwatch.Alarm(this, `${lambdaFunction.node.id}ErrorAlarm`, {
      metric: lambdaFunction.metricErrors({
        period: Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // Lambdas' exceeding 80% of their allowed runtime for 3 mins
    const durationAlarm = new cloudwatch.Alarm(this, `${lambdaFunction.node.id}DurationAlarm`, {
      metric: lambdaFunction.metricDuration({
        period: Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: timeoutMs,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    if (this.alertTopic) {
      errorAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));
      durationAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));
    }

    return [errorAlarm, durationAlarm];
  }

  public addApiGatewayMonitoring(apiGateway: apigw.RestApi): cloudwatch.Alarm[] {
    // More than 5 5XX Errors/min for 3 mins
    const serverErrorAlarm = new cloudwatch.Alarm(this, `${apiGateway.node.id}ServerErrorAlarm`, {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: apiGateway.restApiName,
        },
        period: Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // More than 10 4XX Errors/min for 3 mins
    const serverWarnAlarm = new cloudwatch.Alarm(this, `${apiGateway.node.id}ServerWarnAlarm`, {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: {
          ApiName: apiGateway.restApiName,
        },
        period: Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // APIGW Latency/min more than 25 seconds for 3 mins
    const latencyAlarm = new cloudwatch.Alarm(this, `${apiGateway.node.id}LatencyAlarm`, {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: {
          ApiName: apiGateway.restApiName,
        },
        period: Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: 25000, // Average HTTP request should be 30 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    if (this.alertTopic) {
      serverErrorAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));
      latencyAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));
      serverWarnAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));
    }

    return [serverErrorAlarm, latencyAlarm, serverWarnAlarm];
  }

  public addRdsMonitoring(rdsInstance: PostgresDb): cloudwatch.Alarm[] {
    // CPU is greater than 80% for 3 minutes
    const cpuAlarm = new cloudwatch.Alarm(this, `${rdsInstance.node.id}CpuAlarm`, {
      metric: rdsInstance.database.metricCPUUtilization({
        period: Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // Free Storage is Less than 15% of allocated storage for 3 mins
    const freeStorageAlarm = new cloudwatch.Alarm(this, `${rdsInstance.node.id}StorageAlarm`, {
      metric: rdsInstance.database.metricFreeStorageSpace({
        period: Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: rdsInstance.storage * 1024 * 1024 * 1024 * 0.15, //Free Storage less than 15% of allocated
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    });

    if (this.alertTopic) {
      cpuAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));
      freeStorageAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));
    }

    return [cpuAlarm, freeStorageAlarm];
  }
}