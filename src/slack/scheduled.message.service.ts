import { Database } from '../config/database';
import { SlackService } from './slack.service';
import cron from 'node-cron';

interface ScheduledMessage {
  id?: number;
  team_id: string;
  channel_id: string;
  channel_name: string;
  message: string;
  scheduled_time: number;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  created_at?: string;
}

export class ScheduledMessageService {
  private db = Database.getInstance().db;
  private slackService = new SlackService();
  private scheduledJobs: Map<number, any> = new Map();

  constructor() {
    this.initializeScheduler();
    this.loadExistingScheduledMessages();
  }

  private initializeScheduler(): void {
    // Run every minute to check for messages to send
    cron.schedule('* * * * *', () => {
      this.processPendingMessages();
    });
  }

  async scheduleMessage(messageData: Omit<ScheduledMessage, 'id' | 'status' | 'created_at'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO scheduled_messages 
        (team_id, channel_id, channel_name, message, scheduled_time, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `;

      this.db.run(query, [
        messageData.team_id,
        messageData.channel_id,
        messageData.channel_name,
        messageData.message,
        messageData.scheduled_time
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log(`Scheduled message with ID: ${this.lastID}`);
          resolve(this.lastID);
        }
      });
    });
  }

  async getScheduledMessages(teamId: string): Promise<ScheduledMessage[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM scheduled_messages WHERE team_id = ? AND status = "pending" ORDER BY scheduled_time ASC',
        [teamId],
        (err, rows: ScheduledMessage[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async cancelScheduledMessage(messageId: number, teamId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE scheduled_messages SET status = "cancelled" WHERE id = ? AND team_id = ? AND status = "pending"',
        [messageId, teamId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            const success = this.changes > 0;
            if (success) {
              console.log(`Cancelled scheduled message with ID: ${messageId}`);
            }
            resolve(success);
          }
        }
      );
    });
  }

  private async loadExistingScheduledMessages(): Promise<void> {
    // Load all pending messages on startup
    this.db.all(
      'SELECT * FROM scheduled_messages WHERE status = "pending"',
      [],
      (err, rows: ScheduledMessage[]) => {
        if (err) {
          console.error('Error loading scheduled messages:', err);
          return;
        }

        console.log(`Loaded ${rows.length} pending scheduled messages`);
      }
    );
  }

  private async processPendingMessages(): Promise<void> {
    const currentTime = Date.now();
    
    this.db.all(
      'SELECT * FROM scheduled_messages WHERE status = "pending" AND scheduled_time <= ?',
      [currentTime],
      async (err, rows: ScheduledMessage[]) => {
        if (err) {
          console.error('Error fetching pending messages:', err);
          return;
        }

        for (const message of rows) {
          await this.sendScheduledMessage(message);
        }
      }
    );
  }

  private async sendScheduledMessage(message: ScheduledMessage): Promise<void> {
    try {
      console.log(`Sending scheduled message ID: ${message.id}`);
      
      await this.slackService.sendMessage(
        message.team_id,
        message.channel_id,
        message.message
      );

      // Mark as sent
      await this.updateMessageStatus(message.id!, 'sent');
      console.log(`Successfully sent scheduled message ID: ${message.id}`);
      
    } catch (error) {
      console.error(`Failed to send scheduled message ID: ${message.id}`, error);
      await this.updateMessageStatus(message.id!, 'failed');
    }
  }

  private async updateMessageStatus(messageId: number, status: 'sent' | 'failed'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE scheduled_messages SET status = ? WHERE id = ?',
        [status, messageId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}