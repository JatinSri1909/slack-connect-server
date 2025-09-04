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
