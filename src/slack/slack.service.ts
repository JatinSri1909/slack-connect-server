import { WebClient } from '@slack/web-api';
import axios from 'axios';
import { Database } from '../config/database';

interface SlackToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  team_id: string;
  team_name: string;
}

export class SlackService {
  private db = Database.getInstance().db;

  async exchangeCodeForToken(code: string): Promise<SlackToken> {
    try {
      const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
        params: {
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          code: code,
          redirect_uri: process.env.SLACK_REDIRECT_URI
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = response.data;
      
      if (!data.ok) {
        throw new Error(`Slack OAuth error: ${data.error}`);
      }

      const tokenData: SlackToken = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        team_id: data.team.id,
        team_name: data.team.name
      };

      await this.storeToken(tokenData);
      return tokenData;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  private async storeToken(tokenData: SlackToken): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO slack_tokens 
        (team_id, access_token, refresh_token, expires_at, team_name, updated_at) 
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(query, [
        tokenData.team_id,
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.expires_at,
        tokenData.team_name
      ], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getValidToken(teamId: string): Promise<string> {
    const token = await this.getStoredToken(teamId);
    
    if (!token) {
      throw new Error('No token found for team');
    }

    // Check if token is expired and refresh if needed
    if (token.expires_at && Date.now() >= token.expires_at) {
      if (token.refresh_token) {
        return await this.refreshToken(teamId, token.refresh_token);
      } else {
        throw new Error('Token expired and no refresh token available');
      }
    }

    return token.access_token;
  }

  private async getStoredToken(teamId: string): Promise<SlackToken | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM slack_tokens WHERE team_id = ?',
        [teamId],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  private async refreshToken(teamId: string, refreshToken: string): Promise<string> {
    try {
      const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
        params: {
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }
      });

      const data = response.data;
      
      if (!data.ok) {
        throw new Error(`Token refresh error: ${data.error}`);
      }

      // Update stored token
      await this.updateStoredToken(teamId, data.access_token, data.refresh_token, data.expires_in);
      
      return data.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  private async updateStoredToken(teamId: string, accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : null;
      
      this.db.run(
        `UPDATE slack_tokens 
         SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE team_id = ?`,
        [accessToken, refreshToken, expiresAt, teamId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getChannels(teamId: string): Promise<any[]> {
    try {
      const token = await this.getValidToken(teamId);
      const client = new WebClient(token);
      
      const result = await client.conversations.list({
        types: 'public_channel,private_channel'
      });

      return result.channels || [];
    } catch (error) {
      console.error('Error fetching channels:', error);
      throw error;
    }
  }

  async sendMessage(teamId: string, channelId: string, message: string): Promise<void> {
    try {
      const token = await this.getValidToken(teamId);
      const client = new WebClient(token);
      
      await client.chat.postMessage({
        channel: channelId,
        text: message
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
}