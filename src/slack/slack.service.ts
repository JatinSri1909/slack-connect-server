import { WebClient } from '@slack/web-api';
import axios from 'axios';
import { Database } from '../config/database';

interface SlackToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  team_id: string;
  team_name: string;
  bot_token?: string; // Added to store the bot token separately if available
}

export class SlackService {
  private db = Database.getInstance().db;

  async getBotToken(teamId: string): Promise<string | null> {
    try {
      // Retrieve the token from storage
      const tokenData = await this.getStoredToken(teamId);
      
      if (!tokenData) {
        console.error('No token found for team:', teamId);
        return null;
      }
      
      // Return the bot token if available, otherwise use the access token
      return tokenData.bot_token || tokenData.access_token;
    } catch (error) {
      console.error('Error getting bot token:', error);
      return null;
    }
  }

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
        team_name: data.team.name,
        bot_token: data.access_token // In OAuth v2, the access_token is the bot token
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
        (team_id, access_token, refresh_token, expires_at, team_name, bot_token, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(query, [
        tokenData.team_id,
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.expires_at,
        tokenData.team_name,
        tokenData.bot_token || tokenData.access_token // Use access token as fallback
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
         SET access_token = ?, refresh_token = ?, expires_at = ?, bot_token = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE team_id = ?`,
        [accessToken, refreshToken, expiresAt, accessToken, teamId],
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

  async joinChannel(teamId: string, channelId: string): Promise<boolean> {
    try {
      const token = await this.getBotToken(teamId);
      if (!token) {
        console.error('No bot token found for team:', teamId);
        return false;
      }

      const client = new WebClient(token);
      
      // Try to join the channel
      await client.conversations.join({ channel: channelId });
      console.log(`Successfully joined channel: ${channelId}`);
      return true;
    } catch (error: any) {
      // Channel might be private, or bot might already be in the channel
      console.log(`Could not join channel ${channelId}: ${error.message || 'Unknown error'}`);
      return false;
    }
  }

  async sendMessage(teamId: string, channelId: string, message: string): Promise<void> {
    try {
      const token = await this.getValidToken(teamId);
      const client = new WebClient(token);
      
      try {
        // Try to join the channel first
        await this.joinChannel(teamId, channelId);
      } catch (joinError) {
        // Ignore join errors and still try to send the message
        console.log("Couldn't join channel, will try to send message anyway");
      }
      
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