import cron from 'node-cron';
import { SlackService } from './slack.service';
import { ScheduledMessage } from '../types';
import { APP_CONSTANTS } from '../constants';
import { getDatabaseAdapter, getQueries } from '../config/database-adapter';
import { RetryService } from './retry.service';

export class ScheduledMessageService {
  private db = getDatabaseAdapter();
  private queries = getQueries();
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
    const result = await this.db.run(
      this.queries.INSERT_SCHEDULED_MESSAGE,
      [
        messageData.team_id,
        messageData.channel_id,
        messageData.channel_name,
        messageData.message,
        messageData.scheduled_time,
        'pending'
      ]
    );
    console.log(`Scheduled message with ID: ${result.lastID}`);
    return result.lastID || 0;
  }

  async getScheduledMessages(teamId: string): Promise<ScheduledMessage[]> {
    return await this.db.all(this.queries.SELECT_PENDING_MESSAGES_BY_TEAM, [teamId]);
  }

  async cancelScheduledMessage(
    messageId: number,
    teamId: string,
  ): Promise<boolean> {
    const result = await this.db.run(
      this.queries.UPDATE_MESSAGE_STATUS,
      [messageId, teamId]
    );
    const success = result.changes > 0;
    if (success) {
      console.log(`Cancelled scheduled message with ID: ${messageId}`);
    }
    return success;
  }

  private async loadExistingScheduledMessages(): Promise<void> {
    try {
      // Load all pending messages on startup
      const rows = await this.db.all(
        this.queries.SELECT_PENDING_MESSAGES_BY_TIME,
        [Date.now()]
      );
      console.log(`Loaded ${rows.length} pending scheduled messages`);
    } catch (err) {
      console.error('Error loading scheduled messages:', err);
    }
  }

  public async processPendingMessages(): Promise<void> {
    // Prevent multiple processing runs simultaneously
    if (this.isProcessing) {
      console.log('Already processing messages, skipping this cycle');
      return;
    }

    this.isProcessing = true;
    const currentTime = Date.now();

    try {
      // Get pending messages that are due to be sent
      const rows = await this.db.all(
        this.queries.SELECT_PENDING_MESSAGES_BY_TIME,
        [currentTime]
      );

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
        const result = await this.db.run(
          this.queries.UPDATE_MESSAGE_PROCESSING,
          [messageId]
        );
        return result.changes;
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
    try {
      await this.db.run(
        this.queries.UPDATE_MESSAGE_FINAL_STATUS,
        [status, messageId]
      );
      console.log(`Updated message ${messageId} status to ${status}`);
    } catch (err) {
      console.error(
        `Error updating message ${messageId} status to ${status}:`,
        err,
      );
      throw err;
    }
  }
}
