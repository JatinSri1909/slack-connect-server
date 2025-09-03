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