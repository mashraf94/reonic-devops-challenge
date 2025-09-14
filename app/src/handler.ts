import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

async function getDatabaseConfig(): Promise<DatabaseConfig> {
  // Check if environment variables are set
  if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD) {
    return {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };
  }

  // If environment variables are not set, try to get from Secrets Manager
  const secretName = process.env.DB_SECRET_NAME;
  if (!secretName) {
    throw new Error('Database credentials not found in environment variables and no DB_SECRET_NAME specified. Please set DB_HOST, DB_USER, and DB_PASSWORD, or set DB_SECRET_NAME for Secrets Manager.');
  }

  try {
    const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    return {
      host: secret.host || secret.DB_HOST,
      port: parseInt(secret.port || secret.DB_PORT || '5432'),
      database: secret.dbname || secret.DB_NAME || 'postgres',
      user: secret.username || secret.user || secret.DB_USER,
      password: secret.password || secret.DB_PASSWORD,
    };
  } catch (error) {
    console.error('Error retrieving secret from Secrets Manager:', error);
    throw new Error(`Failed to retrieve database credentials from Secrets Manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function initializeDatabase(client: Client): Promise<void> {
  // Create a simple table for testing
  await client.query(`
    CREATE TABLE IF NOT EXISTS test_records (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export const handler = async (event: any) => {
  let client: Client | null = null;
  
  try {
    // Get database configuration
    const dbConfig = await getDatabaseConfig();
    
    // Create database client
    client = new Client(dbConfig);
    await client.connect();
    
    // Initialize database table
    await initializeDatabase(client);
    
    // Insert a new row
    const insertResult = await client.query(
      'INSERT INTO test_records (message) VALUES ($1) RETURNING id',
      [`Hello from Lambda at ${new Date().toISOString()}`]
    );
    
    // Get total count
    const countResult = await client.query('SELECT COUNT(*) as total FROM test_records');
    const totalCount = parseInt(countResult.rows[0].total);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Successfully inserted record and retrieved count',
        insertedId: insertResult.rows[0].id,
        totalRecords: totalCount,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
    
  } finally {
    if (client) {
      await client.end();
    }
  }
}; 