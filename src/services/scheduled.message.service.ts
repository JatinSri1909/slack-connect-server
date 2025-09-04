import cron from 'node-cron';
import { Database } from '../config/database';
import { SlackService } from './slack.service';
import { ScheduledMessage } from '../types';
import { APP_CONSTANTS, SQL_QUERIES } from '../constants';
import { RetryService } from './retry.service';

export class ScheduledMessageService {
  private db = Database.getInstance().db;
  private slackService = new SlackService();
  private isProcessing = false;

  constructor() {
    this.initializeScheduler();
    this.loadExistingScheduledMessages();
  }

  private initializeScheduler(): void {
    // Run every minute to check for messages to send
    cron.schedule(APP_CONSTANTS.CRON_SCHEDULE, () => {
      this.processPendingMessages();
    });
  }

  async scheduleMessage(
    messageData: Omit<ScheduledMessage, 'id' | 'status' | 'created_at'>,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        SQL_QUERIES.INSERT_SCHEDULED_MESSAGE,
        [
          messageData.team_id,
          messageData.channel_id,
          messageData.channel_name,
          messageData.message,
          messageData.scheduled_time,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            console.log(`Scheduled message with ID: ${this.lastID}`);
            resolve(this.lastID);
          }
        },
      );
    });
  }

  async getScheduledMessages(teamId: string): Promise<ScheduledMessage[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        SQL_QUERIES.SELECT_PENDING_MESSAGES_BY_TEAM,
        [teamId],
        (err, rows: ScheduledMessage[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        },
      );
    });
  }

  async cancelScheduledMessage(
    messageId: number,
    teamId: string,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(
        SQL_QUERIES.UPDATE_MESSAGE_STATUS,
        [messageId, teamId],
        function (err) {
          if (err) {
            reject(err);
          } else {
            const success = this.changes > 0;
            if (success) {
              console.log(`Cancelled scheduled message with ID: ${messageId}`);
            }
            resolve(success);
          }
        },
      );
    });
  }

  private async loadExistingScheduledMessages(): Promise<void> {
    // Load all pending messages on startup
    this.db.all(
      SQL_QUERIES.SELECT_ALL_PENDING_MESSAGES,
      [],
      (err, rows: ScheduledMessage[]) => {
        if (err) {
          console.error('Error loading scheduled messages:', err);
          return;
        }

        console.log(`Loaded ${rows.length} pending scheduled messages`);
      },
    );
  }

  private async processPendingMessages(): Promise<void> {
    // Prevent multiple processing runs simultaneously
    if (this.isProcessing) {
      console.log('Already processing messages, skipping this cycle');
      return;
    }

    this.isProcessing = true;
    const currentTime = Date.now();

    try {
      // Use a promise-based approach instead of callback
      const rows = await new Promise<ScheduledMessage[]>((resolve, reject) => {
        this.db.all(
          SQL_QUERIES.SELECT_PENDING_MESSAGES_BY_TIME,
          [currentTime],
          (err, rows: ScheduledMessage[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          },
        );
      });

      console.log(`Processing ${rows.length} pending messages`);

      // Process messages sequentially to avoid race conditions
      for (const message of rows) {
        try {
          await this.sendScheduledMessage(message);
          // Add a small delay to prevent race conditions
          await new Promise((resolve) =>
            setTimeout(resolve, APP_CONSTANTS.MESSAGE_PROCESSING_DELAY),
          );
        } catch (error) {
          console.error(`Error processing message ${message.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in processPendingMessages:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async sendScheduledMessage(message: ScheduledMessage): Promise<void> {
    const messageId = message.id!;

    try {
      console.log(
        `[${new Date().toISOString()}] Processing scheduled message ID: ${messageId}`,
      );

      // Use atomic update with better status management and retry logic
      const updateResult = await RetryService.executeDatabaseOperationWithRetry(async () => {
        return new Promise<number>((resolve, reject) => {
          this.db.run(
            SQL_QUERIES.UPDATE_MESSAGE_PROCESSING,
            [messageId],
            function (err) {
              if (err) reject(err);
              else resolve(this.changes);
            },
          );
        });
      });

      if (updateResult === 0) {
        console.log(
          `Message ID ${messageId} was not updated (already processed or not pending)`,
        );
        return;
      }

      // Try to join the channel first
      try {
        await this.slackService.joinChannel(
          message.team_id,
          message.channel_id,
        );
      } catch (joinError) {
        console.log(
          `Warning: Couldn't join channel for message ID: ${messageId}`,
        );
      }

      // Send the message
      await this.slackService.sendMessage(
        message.team_id,
        message.channel_id,
        message.message,
      );

      // Mark as sent
      await this.updateMessageStatus(
        messageId,
        APP_CONSTANTS.MESSAGE_STATUS.SENT,
      );
      console.log(
        `[${new Date().toISOString()}] Successfully sent scheduled message ID: ${messageId}`,
      );
    } catch (error: any) {
      console.error(`Failed to send scheduled message ID: ${messageId}`, error);
      await this.updateMessageStatus(
        messageId,
        APP_CONSTANTS.MESSAGE_STATUS.FAILED,
      );
    }
  }

  private async updateMessageStatus(
    messageId: number,
    status: 'sent' | 'failed',
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const updateTime = new Date().toISOString();
      const params = [status, updateTime, messageId];

      this.db.run(
        SQL_QUERIES.UPDATE_MESSAGE_FINAL_STATUS,
        params,
        function (err) {
          if (err) {
            console.error(
              `Error updating message ${messageId} status to ${status}:`,
              err,
            );
            reject(err);
          } else {
            console.log(`Updated message ${messageId} status to ${status}`);
            resolve();
          }
        },
      );
    });
  }
}
