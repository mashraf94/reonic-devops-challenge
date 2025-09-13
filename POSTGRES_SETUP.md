# 🐘 PostgreSQL Integration Guide

This guide explains how the Lambda function connects to PostgreSQL and how to test it locally.

## 🔧 Database Configuration

The Lambda function supports two ways to configure database credentials:

### 1. Environment Variables (Local Development)
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=postgres
```

### 2. AWS Secrets Manager (Production)
```bash
DB_SECRET_NAME=your-database-secret-name
AWS_REGION=us-east-1
```

The secret in AWS Secrets Manager should be a JSON object with:
```json
{
  "host": "your-db-host",
  "port": 5432,
  "database": "your-db-name",
  "username": "your-db-user",
  "password": "your-db-password"
}
```

## 🚀 Local Testing with Docker Compose

### Quick Start
```bash
# Start PostgreSQL and Lambda services
npm run test:compose

# In another terminal, test the Lambda (choose one):
npm run test:lambda          # Direct HTTP testing
npm run test:lambda:runtime  # Lambda runtime interface testing

# Or use the comprehensive test script
./test-local.sh
```

### Manual Testing
```bash
# Start services
docker compose up -d

# Wait for services to be ready, then test (choose one):

# Method 1: Direct HTTP (easier for testing)
curl -X POST http://localhost:9000/

# Method 2: Lambda Runtime Interface (matches production)
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
     -H "Content-Type: application/json" \
     -d '{}'

# Check logs
docker compose logs lambda

# Stop services
docker compose down
```

## 📊 Database Schema

The Lambda function automatically creates a `test_records` table:

```sql
CREATE TABLE test_records (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔄 Function Behavior

Each time the Lambda function is invoked, it:

1. **Connects** to PostgreSQL using configured credentials
2. **Creates** the `test_records` table if it doesn't exist
3. **Inserts** a new row with a timestamped message
4. **Counts** the total number of rows in the table
5. **Returns** a JSON response with:
   - `insertedId`: ID of the newly inserted record
   - `totalRecords`: Total count of records in the table
   - `timestamp`: Current timestamp

## 🧪 Example Response

```json
{
  "message": "Successfully inserted record and retrieved count",
  "insertedId": 5,
  "totalRecords": 5,
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

## 🔍 Troubleshooting

### Connection Issues
- Ensure PostgreSQL is running and accessible
- Check that credentials are correct
- Verify network connectivity between Lambda and database

### Permission Issues
- Ensure the database user has CREATE TABLE and INSERT permissions
- For AWS Secrets Manager, ensure Lambda has `secretsmanager:GetSecretValue` permission

### Local Development
- Use `docker compose logs` to check service logs
- Ensure ports 5432 (PostgreSQL) and 9000 (Lambda) are available
- Check that the Lambda container can reach the PostgreSQL container

## 🏗️ Production Deployment

For production deployment:

1. **Create a Secrets Manager secret** with database credentials
2. **Update the CDK stack** to include the secret ARN as an environment variable
3. **Ensure the Lambda execution role** has permission to read the secret
4. **Configure VPC settings** if the database is in a private subnet

Example CDK environment variable:
```typescript
environment: {
  DB_SECRET_NAME: 'your-database-secret-name',
  AWS_REGION: 'us-east-1'
}
``` 