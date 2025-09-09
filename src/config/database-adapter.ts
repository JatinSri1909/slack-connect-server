import { Database } from './database';
import { postgresDb } from './postgres';
import { SQL_QUERIES, POSTGRES_QUERIES } from '../constants';

export interface DatabaseAdapter {
  get(query: string, params: any[]): Promise<any>;
  all(query: string, params: any[]): Promise<any[]>;
  run(query: string, params: any[]): Promise<{ changes: number; lastID?: number }>;
}

class SQLiteAdapter implements DatabaseAdapter {
  private db = Database.getInstance().db;

  async get(query: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  async all(query: string, params: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async run(query: string, params: any[]): Promise<{ changes: number; lastID?: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });
  }
}

class PostgresAdapter implements DatabaseAdapter {
  private pool = postgresDb.getPool();

  async get(query: string, params: any[]): Promise<any> {
    const result = await this.pool.query(query, params);
    return result.rows[0] || null;
  }

  async all(query: string, params: any[]): Promise<any[]> {
    const result = await this.pool.query(query, params);
    return result.rows || [];
  }

  async run(query: string, params: any[]): Promise<{ changes: number; lastID?: number }> {
    const result = await this.pool.query(query, params);
    return { changes: result.rowCount || 0, lastID: result.rows[0]?.id };
  }
}

// Factory function to get the appropriate database adapter
export function getDatabaseAdapter(): DatabaseAdapter {
  if (process.env.NODE_ENV === 'production') {
    return new PostgresAdapter();
  } else {
    return new SQLiteAdapter();
  }
}

// Factory function to get the appropriate queries
export function getQueries() {
  if (process.env.NODE_ENV === 'production') {
    return POSTGRES_QUERIES;
  } else {
    return SQL_QUERIES;
  }
}
