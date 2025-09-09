// Postgres SQL queries
export const POSTGRES_QUERIES = {
  // Token queries
  INSERT_OR_REPLACE_TOKEN: `
    INSERT INTO slack_tokens (team_id, access_token, refresh_token, expires_at, team_name, bot_token)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (team_id) 
    DO UPDATE SET 
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      team_name = EXCLUDED.team_name,
      bot_token = EXCLUDED.bot_token,
      updated_at = CURRENT_TIMESTAMP
  `,

  SELECT_TOKEN_BY_TEAM: `
    SELECT * FROM slack_tokens WHERE team_id = $1
  `,

  UPDATE_TOKEN: `
    UPDATE slack_tokens 
    SET access_token = $1, refresh_token = $2, expires_at = $3, bot_token = $4, updated_at = CURRENT_TIMESTAMP
    WHERE team_id = $5
  `,

  DELETE_TOKEN: `
    DELETE FROM slack_tokens WHERE team_id = $1
  `,

  DELETE_TOKEN_BY_TEAM: `
    DELETE FROM slack_tokens WHERE team_id = $1
  `,

  // Scheduled message queries
  INSERT_SCHEDULED_MESSAGE: `
    INSERT INTO scheduled_messages (team_id, channel_id, channel_name, message, scheduled_time, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `,

  SELECT_SCHEDULED_MESSAGES_BY_TEAM: `
    SELECT * FROM scheduled_messages 
    WHERE team_id = $1 
    ORDER BY scheduled_time DESC
  `,

  SELECT_PENDING_MESSAGES_BY_TEAM: `
    SELECT * FROM scheduled_messages 
    WHERE team_id = $1 AND status = 'pending' 
    ORDER BY scheduled_time ASC
  `,

  SELECT_PENDING_MESSAGES_BY_TIME: `
    SELECT * FROM scheduled_messages 
    WHERE status = 'pending' AND scheduled_time <= $1
    ORDER BY scheduled_time ASC
  `,

  UPDATE_MESSAGE_PROCESSING: `
    UPDATE scheduled_messages 
    SET status = 'processing', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND status = 'pending'
  `,

  UPDATE_MESSAGE_FINAL_STATUS: `
    UPDATE scheduled_messages 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `,

  UPDATE_MESSAGE_STATUS: `
    UPDATE scheduled_messages 
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND team_id = $2 AND status = 'pending'
  `,

  DELETE_SCHEDULED_MESSAGE: `
    DELETE FROM scheduled_messages 
    WHERE id = $1 AND team_id = $2 AND status = 'pending'
  `,

  SELECT_SCHEDULED_MESSAGE_BY_ID: `
    SELECT * FROM scheduled_messages 
    WHERE id = $1 AND team_id = $2
  `,

  // Database status queries
  GET_DATABASE_STATUS: `
    SELECT 
      (SELECT COUNT(*) FROM slack_tokens) as token_count,
      (SELECT COUNT(*) FROM scheduled_messages WHERE status = 'pending') as pending_messages,
      (SELECT COUNT(*) FROM scheduled_messages WHERE status = 'sent') as sent_messages,
      (SELECT COUNT(*) FROM scheduled_messages WHERE status = 'failed') as failed_messages
  `,
} as const;
