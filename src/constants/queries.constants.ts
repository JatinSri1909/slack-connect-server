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
  DELETE_TOKEN_BY_TEAM: 'DELETE FROM slack_tokens WHERE team_id = ?',

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
