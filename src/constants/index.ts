// Database table names
export const TABLES = {
  SLACK_TOKENS: 'slack_tokens',
  SCHEDULED_MESSAGES: 'scheduled_messages',
} as const;

// SQL queries
export const SQL_QUERIES = {
  // Slack tokens queries
  INSERT_OR_REPLACE_TOKEN: `
    INSERT OR REPLACE INTO slack_tokens 
    (team_id, access_token, refresh_token, expires_at, team_name, bot_token, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `,
  SELECT_TOKEN_BY_TEAM: 'SELECT * FROM slack_tokens WHERE team_id = ?',
  UPDATE_TOKEN: `
    UPDATE slack_tokens 
    SET access_token = ?, refresh_token = ?, expires_at = ?, bot_token = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE team_id = ?
  `,
  
  // Scheduled messages queries
  INSERT_SCHEDULED_MESSAGE: `
    INSERT INTO scheduled_messages 
    (team_id, channel_id, channel_name, message, scheduled_time, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `,
  SELECT_PENDING_MESSAGES_BY_TEAM: `
    SELECT * FROM scheduled_messages 
    WHERE team_id = ? AND status = "pending" 
    ORDER BY scheduled_time ASC
  `,
  SELECT_PENDING_MESSAGES_BY_TIME: `
    SELECT * FROM scheduled_messages 
    WHERE status = "pending" AND scheduled_time <= ?
  `,
  SELECT_ALL_PENDING_MESSAGES: `
    SELECT * FROM scheduled_messages 
    WHERE status = "pending"
  `,
  UPDATE_MESSAGE_STATUS: `
    UPDATE scheduled_messages 
    SET status = "cancelled" 
    WHERE id = ? AND team_id = ? AND status = "pending"
  `,
  UPDATE_MESSAGE_PROCESSING: `
    UPDATE scheduled_messages 
    SET status = "processing", updated_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND status = "pending"
  `,
  UPDATE_MESSAGE_FINAL_STATUS: `
    UPDATE scheduled_messages 
    SET status = ?, updated_at = ? 
    WHERE id = ?
  `,
  
  // Database status queries
  COUNT_TOKENS: 'SELECT COUNT(*) as count FROM slack_tokens',
  MESSAGE_STATS_BY_STATUS: `
    SELECT status, COUNT(*) as count 
    FROM scheduled_messages 
    GROUP BY status
  `,
  LIST_TABLES: "SELECT name FROM sqlite_master WHERE type='table'",
  TABLE_INFO: 'PRAGMA table_info(scheduled_messages)',
  ADD_UPDATED_AT_COLUMN: `
    ALTER TABLE scheduled_messages 
    ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  `,
} as const;

// URIs and URLs
export const URIS = {
  // Slack API endpoints
  SLACK_OAUTH_AUTHORIZE: 'https://slack.com/oauth/v2/authorize',
  SLACK_OAUTH_ACCESS: 'https://slack.com/api/oauth.v2.access',
  
  // API routes
  API_AUTH: '/api/auth',
  API_SLACK: '/api/slack',
  HEALTH_CHECK: '/health',
  
  // Auth routes
  AUTH_SLACK: '/slack',
  AUTH_SLACK_CALLBACK: '/slack/callback',
  
  // Slack routes
  SLACK_CHANNELS: '/channels/:teamId',
  SLACK_SEND_MESSAGE: '/send-message',
  SLACK_SCHEDULE_MESSAGE: '/schedule-message',
  SLACK_SCHEDULED_MESSAGES: '/scheduled-messages/:teamId',
  SLACK_CANCEL_MESSAGE: '/scheduled-messages/:messageId',
  SLACK_DB_STATUS: '/db-status',
} as const;

// Application constants
export const APP_CONSTANTS = {
  // Server configuration
  DEFAULT_PORT: 5000,
  DEFAULT_FRONTEND_URL: 'http://localhost:5173',
  
  // Slack OAuth
  SLACK_SCOPE: 'channels:read,chat:write,groups:read,channels:join',
  OAUTH_CALLBACK_PATH: '/oauth-callback.html',
  
  // Message statuses
  MESSAGE_STATUS: {
    PENDING: 'pending',
    SENT: 'sent',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    PROCESSING: 'processing',
  } as const,
  
  // Slack API error codes
  SLACK_ERRORS: {
    NOT_IN_CHANNEL: 'not_in_channel',
    CHANNEL_NOT_FOUND: 'channel_not_found',
    IS_ARCHIVED: 'is_archived',
  } as const,
  
  // Cron schedule
  CRON_SCHEDULE: '* * * * *', // Every minute
  
  // Database
  DATABASE_PATH: '../../database.sqlite',
  REQUIRED_TABLES: ['slack_tokens', 'scheduled_messages'],
  
  // Processing delays
  MESSAGE_PROCESSING_DELAY: 100, // ms
  INITIALIZATION_CHECK_INTERVAL: 100, // ms
  
  // HTTP status codes
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  } as const,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  OAUTH_AUTHORIZATION_FAILED: 'OAuth authorization failed',
  AUTHORIZATION_CODE_NOT_PROVIDED: 'Authorization code not provided',
  FAILED_TO_COMPLETE_OAUTH: 'Failed to complete OAuth flow',
  MISSING_REQUIRED_FIELDS: 'Missing required fields',
  SCHEDULED_TIME_MUST_BE_FUTURE: 'Scheduled time must be in the future',
  TEAM_ID_REQUIRED: 'Team ID is required',
  MESSAGE_NOT_FOUND: 'Message not found or already processed',
  FAILED_TO_FETCH_CHANNELS: 'Failed to fetch channels',
  FAILED_TO_SEND_MESSAGE: 'Failed to send message',
  FAILED_TO_SCHEDULE_MESSAGE: 'Failed to schedule message',
  FAILED_TO_FETCH_SCHEDULED_MESSAGES: 'Failed to fetch scheduled messages',
  FAILED_TO_CANCEL_MESSAGE: 'Failed to cancel message',
  FAILED_TO_CHECK_DB_STATUS: 'Failed to check database status',
  SOMETHING_WENT_WRONG: 'Something went wrong!',
  NO_TOKEN_FOUND: 'No token found for team',
  TOKEN_EXPIRED_NO_REFRESH: 'Token expired and no refresh token available',
  SLACK_OAUTH_ERROR: 'Slack OAuth error',
  TOKEN_REFRESH_ERROR: 'Token refresh error',
  NO_BOT_TOKEN_FOUND: 'No bot token found',
  BOT_NOT_IN_CHANNEL: 'Bot is not in the channel. For private channels, please add the bot manually using /invite @YourBotName in Slack.',
  PRIVATE_CHANNEL_WARNING: 'Remember, for private channels, please add the bot manually using /invite @YourBotName in Slack.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  MESSAGE_SENT: 'Message sent successfully',
  MESSAGE_SCHEDULED: 'Message scheduled successfully',
  MESSAGE_CANCELLED: 'Message cancelled successfully',
  SUCCESSFULLY_CONNECTED: 'Successfully connected to Slack!',
  SERVER_RUNNING: 'Slack Connect Backend is running',
} as const;