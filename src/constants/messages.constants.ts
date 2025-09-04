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
  BOT_NOT_IN_CHANNEL:
    'Bot is not in the channel. For private channels, please add the bot manually using /invite @YourBotName in Slack.',
  PRIVATE_CHANNEL_WARNING:
    'Remember, for private channels, please add the bot manually using /invite @YourBotName in Slack.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  MESSAGE_SENT: 'Message sent successfully',
  MESSAGE_SCHEDULED: 'Message scheduled successfully',
  MESSAGE_CANCELLED: 'Message cancelled successfully',
  SUCCESSFULLY_CONNECTED: 'Successfully connected to Slack!',
  SERVER_RUNNING: 'Slack Connect Backend is running',
} as const;
