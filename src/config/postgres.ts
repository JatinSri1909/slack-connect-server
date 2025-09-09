import { sql } from '@vercel/postgres';
import { Pool } from 'pg';

// Create a connection pool for development
let pool: Pool | null = null;

export class PostgresDatabase {
  private static instance: PostgresDatabase;
  private isInitialized: boolean = false;

  private constructor() {
    // Don't initialize in constructor - do it lazily
  }

  public static getInstance(): PostgresDatabase {
    if (!PostgresDatabase.instance) {
      PostgresDatabase.instance = new PostgresDatabase();
    }
    return PostgresDatabase.instance;
  }

  public async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }
  }

  private async initializeDatabase(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing Postgres database...');
      await this.createTables();
      this.isInitialized = true;
      console.log('✓ Postgres database initialized successfully');
    } catch (error) {
      console.error('Error initializing Postgres database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    try {
      // Create slack_tokens table
      await sql`
        CREATE TABLE IF NOT EXISTS slack_tokens (
          id SERIAL PRIMARY KEY,
          team_id VARCHAR(255) UNIQUE NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at BIGINT,
          team_name VARCHAR(255),
          bot_token TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('✓ slack_tokens table ready');

      // Create scheduled_messages table
      await sql`
        CREATE TABLE IF NOT EXISTS scheduled_messages (
          id SERIAL PRIMARY KEY,
          team_id VARCHAR(255) NOT NULL,
          channel_id VARCHAR(255) NOT NULL,
          channel_name VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          scheduled_time BIGINT NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES slack_tokens (team_id) ON DELETE CASCADE
        )
      `;
      console.log('✓ scheduled_messages table ready');

      // Create indexes for better performance
      await sql`
        CREATE INDEX IF NOT EXISTS idx_scheduled_messages_team_id 
        ON scheduled_messages (team_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_time 
        ON scheduled_messages (status, scheduled_time)
      `;

      console.log('✓ Database indexes created');

    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  // Get a connection pool for development (when not using Vercel)
  public getPool(): Pool {
    if (!pool) {
      pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
    }
    return pool;
  }

  // Use Vercel's sql helper for production
  public getSql() {
    return sql;
  }
}

// Export singleton instance
export const postgresDb = PostgresDatabase.getInstance();
