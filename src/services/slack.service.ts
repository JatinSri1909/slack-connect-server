import axios, { AxiosError } from 'axios';
import { WebClient } from '@slack/web-api';
import { Database } from '../config/database';
import { SlackToken } from '../types';
import { URIS, ERROR_MESSAGES, APP_CONSTANTS, SQL_QUERIES } from '../constants';
import {
  SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET,
  SLACK_REDIRECT_URI,
} from '../config/envrioment';
import { RetryService } from './retry.service';
import { ValidationService } from './validation.service';

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
      const response = await axios.post(URIS.SLACK_OAUTH_ACCESS, null, {
        params: {
          client_id: SLACK_CLIENT_ID,
          client_secret: SLACK_CLIENT_SECRET,
          code: code,
          redirect_uri: SLACK_REDIRECT_URI,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const data = response.data;

      if (!data.ok) {
        throw new Error(`${ERROR_MESSAGES.SLACK_OAUTH_ERROR}: ${data.error}`);
      }

      const tokenData: SlackToken = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_in
          ? Date.now() + data.expires_in * 1000
          : undefined,
        team_id: data.team.id,
        team_name: data.team.name,
        bot_token: data.access_token, // In OAuth v2, the access_token is the bot token
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
      this.db.run(
        SQL_QUERIES.INSERT_OR_REPLACE_TOKEN,
        [
          tokenData.team_id,
          tokenData.access_token,
          tokenData.refresh_token,
          tokenData.expires_at,
          tokenData.team_name,
          tokenData.bot_token || tokenData.access_token, // Use access token as fallback
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  }

  async getValidToken(teamId: string): Promise<string> {
    const token = await this.getStoredToken(teamId);

    if (!token) {
      throw new Error(ERROR_MESSAGES.NO_TOKEN_FOUND);
    }

    // Check if token is expired and refresh if needed
    if (token.expires_at && Date.now() >= token.expires_at) {
      if (token.refresh_token) {
        return await this.refreshToken(teamId, token.refresh_token);
      } else {
        throw new Error(ERROR_MESSAGES.TOKEN_EXPIRED_NO_REFRESH);
      }
    }

    return token.access_token;
  }

  private async getStoredToken(teamId: string): Promise<SlackToken | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        SQL_QUERIES.SELECT_TOKEN_BY_TEAM,
        [teamId],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        },
      );
    });
  }

  private async refreshToken(
    teamId: string,
    refreshToken: string,
  ): Promise<string> {
    try {
      const response = await axios.post(URIS.SLACK_OAUTH_ACCESS, null, {
        params: {
          client_id: SLACK_CLIENT_ID,
          client_secret: SLACK_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
      });

      const data = response.data;

      if (!data.ok) {
        // Handle specific refresh token errors
        if (data.error === 'invalid_grant' || data.error === 'invalid_refresh_token') {
          console.error(`Invalid refresh token for team ${teamId}: ${data.error}`);
          await this.clearInvalidTokens(teamId);
          throw new Error(ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
        }
        throw new Error(`${ERROR_MESSAGES.TOKEN_REFRESH_ERROR}: ${data.error}`);
      }

      // Update stored token
      await this.updateStoredToken(
        teamId,
        data.access_token,
        data.refresh_token,
        data.expires_in,
      );

      return data.access_token;
    } catch (error: any) {
      console.error('Error refreshing token:', error);
      
      // If it's a network error or invalid grant, clear tokens
      if (error.response?.status === 400 || error.message.includes('invalid_grant')) {
        await this.clearInvalidTokens(teamId);
        throw new Error(ERROR_MESSAGES.REAUTH_REQUIRED);
      }
      
      throw error;
    }
  }

  private async updateStoredToken(
    teamId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

      this.db.run(
        SQL_QUERIES.UPDATE_TOKEN,
        [accessToken, refreshToken, expiresAt, accessToken, teamId],
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  }

  private async clearInvalidTokens(teamId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        SQL_QUERIES.DELETE_TOKEN_BY_TEAM,
        [teamId],
        (err) => {
          if (err) {
            console.error(`Error clearing invalid tokens for team ${teamId}:`, err);
            reject(err);
          } else {
            console.log(`Cleared invalid tokens for team ${teamId}`);
            resolve();
          }
        },
      );
    });
  }

  async getChannels(teamId: string): Promise<any[]> {
    try {
      const token = await this.getValidToken(teamId);
      const client = new WebClient(token);

      const result = await RetryService.executeApiCallWithRetry(async () => {
        return await client.conversations.list({
          types: 'public_channel,private_channel',
        });
      });

      return result.channels || [];
    } catch (error) {
      console.error('Error fetching channels:', error);
      throw error;
    }
  }

  async joinChannel(
    teamId: string,
    channelId: string,
  ): Promise<{ joined: boolean; isPrivate: boolean; error?: string }> {
    try {
      const token = await this.getBotToken(teamId);
      if (!token) {
        return {
          joined: false,
          isPrivate: false,
          error: ERROR_MESSAGES.NO_BOT_TOKEN_FOUND,
        };
      }

      const client = new WebClient(token);

      // First, get channel info to check if it's private
      let isPrivate = false;
      try {
        const channelInfo = await client.conversations.info({
          channel: channelId,
        });
        isPrivate = channelInfo.channel?.is_private || false;
      } catch (infoError) {
        console.log(`Could not get channel info for ${channelId}`);
      }

      // Try to join the channel
      await client.conversations.join({ channel: channelId });
      console.log(`Successfully joined channel: ${channelId}`);
      return { joined: true, isPrivate };
    } catch (error: any) {
      console.log(
        `Could not join channel ${channelId}: ${error.message || 'Unknown error'}`,
      );

      // Check if it's a private channel error
      const isPrivateChannelError =
        error.data?.error === APP_CONSTANTS.SLACK_ERRORS.CHANNEL_NOT_FOUND ||
        error.data?.error === APP_CONSTANTS.SLACK_ERRORS.NOT_IN_CHANNEL ||
        error.data?.error === APP_CONSTANTS.SLACK_ERRORS.IS_ARCHIVED;

      return {
        joined: false,
        isPrivate: isPrivateChannelError,
        error: error.data?.error || error.message,
      };
    }
  }

  async sendMessage(
    teamId: string,
    channelId: string,
    message: string,
  ): Promise<void> {
    try {
      // Validate inputs
      if (!ValidationService.validateTeamId(teamId)) {
        throw new Error('Invalid team ID format');
      }

      if (!ValidationService.validateChannelId(channelId)) {
        throw new Error('Invalid channel ID format');
      }

      const messageValidation = ValidationService.validateAndSanitizeMessage(message);
      if (!messageValidation.isValid) {
        throw new Error(messageValidation.error);
      }

      const sanitizedMessage = messageValidation.sanitizedMessage!;

      const token = await this.getValidToken(teamId);
      const client = new WebClient(token);

      await RetryService.executeApiCallWithRetry(async () => {
        return await client.chat.postMessage({
          channel: channelId,
          text: sanitizedMessage,
        });
      });
    } catch (error: any) {
      // Handle rate limiting specifically
      if (error instanceof AxiosError && RetryService.isRateLimited(error)) {
        const retryAfter = RetryService.getRetryAfterDelay(error);
        if (retryAfter > 0) {
          console.log(`Rate limited, waiting ${retryAfter}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          // Retry once more after rate limit delay
          try {
            const token = await this.getValidToken(teamId);
            const client = new WebClient(token);
            await client.chat.postMessage({
              channel: channelId,
              text: message,
            });
            return;
          } catch (retryError) {
            throw retryError;
          }
        }
      }

      // Enhance error message for private channels
      if (error.data?.error === APP_CONSTANTS.SLACK_ERRORS.NOT_IN_CHANNEL) {
        const enhancedError = new Error(ERROR_MESSAGES.BOT_NOT_IN_CHANNEL);
        throw enhancedError;
      }
      throw error;
    }
  }
}
