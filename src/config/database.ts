import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../database.sqlite');

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
    this.db.run(`
      CREATE TABLE IF NOT EXISTS slack_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER,
        team_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating slack_tokens table:', err);
      } else {
        console.log('✓ slack_tokens table ready');
      }
    });

    // Create scheduled messages table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        message TEXT NOT NULL,
        scheduled_time INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES slack_tokens (team_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating scheduled_messages table:', err);
      } else {
        console.log('✓ scheduled_messages table ready');
        this.initialized = true;
      }
    });
  }

  // Wait for database to be initialized
  public async waitForInitialization(): Promise<void> {
    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.initialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      checkInitialized();
    });
  }

  // Method to verify tables exist
  public async verifyTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT name FROM sqlite_master WHERE type='table'",
        [],
        (err, tables) => {
          if (err) {
            reject(err);
            return;
          }
          
          const tableNames = tables.map((table: any) => table.name);
          console.log('Existing tables:', tableNames);
          
          const requiredTables = ['slack_tokens', 'scheduled_messages'];
          const missingTables = requiredTables.filter(table => !tableNames.includes(table));
          
          if (missingTables.length > 0) {
            console.warn('Missing tables:', missingTables);
            // Reinitialize tables
            this.initializeTables();
          }
          
          resolve();
        }
      );
    });
  }
}