import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { EnvironmentConfig } from '../config/environment-config';

export interface ImageRepoStackProps extends StackProps {
  readonly config: EnvironmentConfig;
}

export class ImageRepoStack extends Stack {
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: ImageRepoStackProps) {
    super(scope, id, props);

    // Create ECR repository for Lambda image
    this.ecrRepository = new ecr.Repository(this, 'LambdaRepository', {
      repositoryName: `reonic-lambda-${props.config.stage.toLowerCase()}`,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          rulePriority: 1,
          maxImageCount: 10,
        },
      ],
    });

    // Outputs
    new CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      exportName: `${props.config.stage}-ecr-uri`,
    });
  }
}