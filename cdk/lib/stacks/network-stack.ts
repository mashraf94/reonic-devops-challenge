import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { EnvironmentConfig } from '../config/environment-config';

export interface NetworkStackProps extends StackProps {
    readonly config: EnvironmentConfig;
}

export class NetworkStack extends Stack {
    public readonly vpc: ec2.Vpc;
    public readonly lambdaSG: ec2.SecurityGroup;
    public readonly lambdaSubnets: ec2.SelectedSubnets;
    public readonly rdsSG: ec2.SecurityGroup;
    public readonly rdsSubnets: ec2.SelectedSubnets;
    public readonly secretsEndpointSG: ec2.SecurityGroup;

    constructor(scope: Construct, id: string, props: NetworkStackProps) {
        super(scope, id, props);

        // Create VPC with proper subnet configuration
        this.vpc = new ec2.Vpc(this, 'VPC', {
            ipAddresses: ec2.IpAddresses.cidr(props.config.vpc.cidr),
            natGateways: props.config.vpc.natGateways,
            subnetConfiguration: [
                {
                    name: 'public',
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                },
                {
                    name: 'Lambda',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
                {
                    name: 'RDS',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
            ],
        });

        this.lambdaSubnets = this.vpc.selectSubnets({
            subnetGroupName: 'Lambda',
        });

        this.rdsSubnets = this.vpc.selectSubnets({
            subnetGroupName: 'RDS',
        });

        // Add VPC Endpoint for SSM Access
        this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        });

        // Security Groups
        this.lambdaSG = new ec2.SecurityGroup(this, 'Lambda', {
            vpc: this.vpc,
        });

        this.rdsSG = new ec2.SecurityGroup(this, 'RDS', {
            vpc: this.vpc,
            allowAllOutbound: false,
        });
    }
}