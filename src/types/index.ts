export interface SlackToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  team_id: string;
  team_name: string;
  bot_token?: string;
}

export interface ScheduledMessage {
  id?: number;
  team_id: string;
  channel_id: string;
  channel_name: string;
  message: string;
  scheduled_time: number;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  created_at?: string;
}
