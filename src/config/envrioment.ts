import dotenv from 'dotenv';
import { APP_CONSTANTS, URIS } from '../constants';

// Load environment variables
dotenv.config();

export interface EnvironmentConfig {
  // Server Configuration
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';

  // Frontend Configuration
  FRONTEND_URL: string;

  // Slack Configuration
  SLACK_CLIENT_ID: string;
  SLACK_CLIENT_SECRET: string;
  SLACK_REDIRECT_URI: string;

  // Database Configuration
  DATABASE_PATH: string;

  // CORS Configuration
  CORS_ORIGIN: string;

  // API Configuration
  API_BASE_URL: string;
}

class Environment {
  private config: EnvironmentConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): EnvironmentConfig {
    return {
      // Server Configuration
      PORT: parseInt(process.env.PORT || '5000', 10),
      NODE_ENV:
        (process.env.NODE_ENV as 'development' | 'production' | 'test') ||
        'development',

      // Frontend Configuration
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

      // Slack Configuration
      SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || '',
      SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || '',
      SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI || '',

      // Database Configuration
      DATABASE_PATH: process.env.DATABASE_PATH || './database.sqlite',

      // CORS Configuration
      CORS_ORIGIN:
        process.env.CORS_ORIGIN ||
        process.env.FRONTEND_URL ||
        'http://localhost:5173',

      // API Configuration
      API_BASE_URL:
        process.env.API_BASE_URL ||
        'https://slack-connect-server-1.onrender.com',
    };
  }

  public get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K] {
    return this.config[key];
  }

  public getAll(): EnvironmentConfig {
    return { ...this.config };
  }

  public isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  public isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  public validate(): void {
    const requiredVars = [
      'SLACK_CLIENT_ID',
      'SLACK_CLIENT_SECRET',
      'SLACK_REDIRECT_URI',
    ];

    const missing = requiredVars.filter(
      (varName) => !this.config[varName as keyof EnvironmentConfig],
    );

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`,
      );
    }
  }

  public getSlackAuthUrl(): string {
    const { SLACK_CLIENT_ID, SLACK_REDIRECT_URI } = this.config;
    const scope = APP_CONSTANTS.SLACK_SCOPE;

    return `${URIS.SLACK_OAUTH_AUTHORIZE}?client_id=${SLACK_CLIENT_ID}&scope=${scope}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}`;
  }

  public getBackendUrl(): string {
    if (this.isDevelopment()) {
      return `http://localhost:${this.config.PORT}`;
    }
    return this.config.API_BASE_URL;
  }
}

// Export singleton instance
export const env = new Environment();

// Export individual getters for convenience
export const {
  PORT,
  NODE_ENV,
  FRONTEND_URL,
  SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET,
  SLACK_REDIRECT_URI,
  DATABASE_PATH,
  CORS_ORIGIN,
  API_BASE_URL,
} = env.getAll();

// Export utility functions
export const isDevelopment = () => env.isDevelopment();
export const isProduction = () => env.isProduction();
export const isTest = () => env.isTest();
export const getSlackAuthUrl = () => env.getSlackAuthUrl();
export const getBackendUrl = () => env.getBackendUrl();
