# Reonic DevOps Challenge - Submission

## How I approached the task

**First**, I started simple and designed the architecture for this project:

- VPC network
- Private Subnets for lambda functions
- Isolated subnets for database instances
- Private Link endpoint to Secrets Manager for secure internal access
- Lambda functions in private subnets with appropriate security groups
- RDS PostgreSQL in isolated subnets with security group only allowing Lambda access
- Database credentials managed through Secrets Manager
- Edge API Gateway exposing a REST API backed by the lambda function

**Second**, I translated this architecture to CDK by creating several stacks:
- **Networking Stack**: VPCs, subnets, security groups, and Private Link endpoints
- **Database Stack**: RDS instances, database subnet groups, and parameter groups
- **Compute Stack**: Lambda functions and API Gateway

**Third**, I setup a GitHub Actions pipeline with two main jobs:

1. **Build and Push Docker Image:**
   - Builds the Node.js application and creates the docker image
   - Creates AWS ECR Repository if it doesn't exist
   - Pushes docker image to ECR Repository with proper tagging

2. **Deploy Infrastructure & Lambda Function:**
   - Compiles the CDK stacks and deploys infrastructure to AWS
   - Handles environment-specific deployments based on branch

## The Challenge: Scaling and Multi-Environment Support

After finishing the initial solution, I ran into several challenges:

- **Scalability Issue**: The CDK repo could only manage a single lambda function and one database
- **Multi-environment Complexity**: Managing multi-env support created a mess in infrastructure naming and configuration

## The Solution: Refactoring for Scale

I restructured the entire project using a **stage → stack → construct** pattern:

### Reusable Constructs
- **Docker Lambda**: Opinionated construct with API Gateway integration and sensible defaults
- **Postgres Database**: Environment-specific configurations with proper subnet groups and security
- **Monitoring**: Comprehensive CloudWatch alarms for Lambdas / API Gateways / Databases, and SNS notifications

### Scalable Stack Architecture
- **Compute Stack**: Can now create multiple lambda functions with just a few lines of code
- **Database Stack**: Easy to spin up multiple postgres databases with consistent configurations
- **Network Stack**: Centralized VPC, subnet, and security group management

### Environment Management
- **CDK Stages**: Used AWS CDK Stage construct to create completely isolated dev and prod environments
- **Configuration-driven**: Simple config file to differentiate between dev and prod environments
- **Branch-based deployment**: Dev branch → dev environment, main branch → prod environment
- **Complete separation**: Each stage deploys its own set of stacks, environments are fully isolated

### Monitoring and Deployment Strategy
- **Comprehensive monitoring**: CloudWatch alarms for Lambda errors/duration, API Gateway 4XX/5XX errors/latency, and RDS CPU/storage metrics
- **Alert notifications**: SNS email subscriptions for all critical system health alerts
- **Safe production deployments**: CodeDeploy canary deployments roll out changes to 10% of traffic over 5 minutes with automatic rollback on alarm triggers

## Assumptions and Trade-offs

**Assumptions:**

- **Regional Strategy**: Assumed as Reonic is a German Company, we'd want to host production in Frankfurt to comply with German data regulation and protection laws
  - Even though it's not the most cost-efficient region, compliance was prioritized
  - However, dev environment is hosted in N. Virginia since it's the most cost efficient for development work

- **Database Secret Format**: Had to assume the database secret parser in the original code had a misspelling
  - The code referenced `secret.database` but RDS auto-generated secrets use `secret.dbname`
  - Updated the handler code to support both formats for flexibility

- **No Internet Connectivity Required**: Determined that Lambda functions don't need internet access, so I removed NAT Gateways to reduce costs
  - Database connections are internal VPC traffic
  - Secrets Manager access goes through VPC Endpoint (PrivateLink)
  - In case a Lambda Function, requires internet access, NAT Gateways is set at the config level to be enabled

**Trade-offs:**

- **SSL Connection**: Turned off SSL for postgres v15 instead of setting up SSL connection between Lambda and RDS
  - This avoided heavy changes to database connection setup in lambda function in case it was out of scope
  - Recognized this as a security trade-off for development speed
- **Authentication Method**: Used GitHub Actions secrets with Access Keys as instructed by the task
  - Instead of setting up more secure OIDC connection between GitHub and AWS
  - Simpler approach but less secure than best practices would suggest
- **Connection Management**: Avoided using RDS Proxy for better connection pooling and management with IAM Authentication
  - Would require significant code changes and couldn't use the existing secret string with DB connection info
  - Decided to keep the simpler direct connection approach for this implementation

## How to use the solution and test it

### Setup Requirements

1. **Repository Setup:**
   - Fork the repo to your GitHub account
   - Create a branch called 'dev' from main
   - Enable GitHub Actions on your forked repo

2. **GitHub Repository Configuration:**

   **Required Secrets** (AWS permissions needed: CloudFormation, VPCs, EC2, Lambda, API Gateway, ECR, RDS, Secret Manager, SNS, CodeDeploy):
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

   **Required Variables:**
   - `DEV_AWS_REGION` (e.g., us-east-1)
   - `PROD_AWS_REGION` (e.g., eu-central-1)

3. **Environment Configuration:**
   - Edit `config/environment-config.ts` with your preferences for dev and prod
   - Adjust instance classes, storage sizes, monitoring email, etc.

### Deployment Process

1. Make your changes to application or infrastructure code
2. Push to `dev` branch → deploys to development environment
3. GitHub Actions automatically builds and deploys your app and infrastructure
4. Once satisfied with dev, merge to `main` branch → triggers production deployment

### Testing the Deployed Solution

1. **Get API Endpoint**: Find the API Gateway URL in CloudFormation outputs
2. **Test Functionality**:
   ```bash
   curl -X POST https://your-api-endpoint.execute-api.region.amazonaws.com/stage/
   ```
3. **Monitor Execution**: Check CloudWatch logs for lambda execution and database interactions
4. **Health Monitoring**: Verify CloudWatch alarms are working for errors, latency, and RDS performance

## What I would improve with more time

### Security Enhancements
- Setup IAM Roles for CDK Deploy with OIDC integration instead of GitHub Actions secrets
- Enable SSL connections between Lambda and RDS
- Implement RDS Proxy with IAM Authentication for better connection pooling and security
- Create dedicated database user with limited permissions instead of admin credentials

### Operational Improvements
- Add integration tests in the CI/CD pipeline to test deployed API endpoints
- Setup centralized logging and structured log aggregation for better debugging
- Add cost monitoring and budget alerts to track AWS spend across environments
- Implement automated database schema migrations
