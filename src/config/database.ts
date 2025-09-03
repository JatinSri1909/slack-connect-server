import sqlite3 from 'sqlite3';
import path from 'path';
import { APP_CONSTANTS, TABLES, SQL_QUERIES } from '../constants';

const dbPath = path.join(__dirname, APP_CONSTANTS.DATABASE_PATH);

export class Database {
  private static instance: Database;
  public db: sqlite3.Database;
  private initialized: boolean = false;

  private constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        this.initializeTables();
      }
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private initializeTables(): void {
    console.log('Initializing database tables...');

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');

    // Create tokens table
    this.db.run(
      `
      CREATE TABLE IF NOT EXISTS ${TABLES.SLACK_TOKENS} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER,
        team_name TEXT,
        bot_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
      (err) => {
        if (err) {
          console.error('Error creating slack_tokens table:', err);
        } else {
          console.log('✓ slack_tokens table ready');
        }
      },
    );

    // Create scheduled messages table
    this.db.run(
      `
      CREATE TABLE IF NOT EXISTS ${TABLES.SCHEDULED_MESSAGES} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        message TEXT NOT NULL,
        scheduled_time INTEGER NOT NULL,
        status TEXT DEFAULT '${APP_CONSTANTS.MESSAGE_STATUS.PENDING}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES ${TABLES.SLACK_TOKENS} (team_id)
      )
    `,
      (err) => {
        if (err) {
          console.error('Error creating scheduled_messages table:', err);
        } else {
          console.log('✓ scheduled_messages table ready');
          // Check if updated_at column exists and add it if it doesn't
          this.db.all(
            SQL_QUERIES.TABLE_INFO,
            (pragmaErr, columns: any[]) => {
              if (pragmaErr) {
                console.error('Error checking table columns:', pragmaErr);
                return;
              }

              const hasUpdatedAt = columns.some(
                (col) => col.name === 'updated_at',
              );
              if (!hasUpdatedAt) {
                this.db.run(
                  SQL_QUERIES.ADD_UPDATED_AT_COLUMN,
                  (alterErr) => {
                    if (alterErr) {
                      console.error(
                        'Error adding updated_at column:',
                        alterErr,
                      );
                    } else {
                      console.log(
                        '✓ Added updated_at column to scheduled_messages',
                      );
                    }
                  },
                );
              }
            },
          );
          this.initialized = true;
        }
      },
    );
  }

  // Wait for database to be initialized
  public async waitForInitialization(): Promise<void> {
    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.initialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, APP_CONSTANTS.INITIALIZATION_CHECK_INTERVAL);
        }
      };
      checkInitialized();
    });
  }

  // Method to verify tables exist
  public async verifyTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.all(
        SQL_QUERIES.LIST_TABLES,
        [],
        (err, tables) => {
          if (err) {
            reject(err);
            return;
          }

          const tableNames = tables.map((table: any) => table.name);
          console.log('Existing tables:', tableNames);

          const requiredTables = APP_CONSTANTS.REQUIRED_TABLES;
          const missingTables = requiredTables.filter(
            (table) => !tableNames.includes(table),
          );

          if (missingTables.length > 0) {
            console.warn('Missing tables:', missingTables);
            // Reinitialize tables
            this.initializeTables();
          }

          resolve();
        },
      );
    });
  }
}
