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
  private isProcessing = false; // Add processing lock

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
        'SELECT * FROM scheduled_messages WHERE status = "pending" AND scheduled_time <= ?',
        [currentTime],
        (err, rows: ScheduledMessage[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    console.log(`Processing ${rows.length} pending messages`);

    // Process messages sequentially to avoid race conditions
    for (const message of rows) {
      try {
        await this.sendScheduledMessage(message);
        // Add a small delay to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
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
    console.log(`[${new Date().toISOString()}] Processing scheduled message ID: ${messageId}`);
    
    // Use atomic update with better status management
    const updateResult = await new Promise<number>((resolve, reject) => {
      this.db.run(
        'UPDATE scheduled_messages SET status = "processing", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "pending"',
        [messageId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    if (updateResult === 0) {
      console.log(`Message ID ${messageId} was not updated (already processed or not pending)`);
      return;
    }

    // Try to join the channel first
    try {
      await this.slackService.joinChannel(message.team_id, message.channel_id);
    } catch (joinError) {
      console.log(`Warning: Couldn't join channel for message ID: ${messageId}`);
    }
    
    // Send the message
    await this.slackService.sendMessage(
      message.team_id,
      message.channel_id,
      message.message
    );

    // Mark as sent
    await this.updateMessageStatus(messageId, 'sent');
    console.log(`[${new Date().toISOString()}] Successfully sent scheduled message ID: ${messageId}`);
    
  } catch (error: any) {
    console.error(`Failed to send scheduled message ID: ${messageId}`, error);
    await this.updateMessageStatus(messageId, 'failed');
  }
}

  private async updateMessageStatus(messageId: number, status: 'sent' | 'failed'): Promise<void> {
    return new Promise((resolve, reject) => {
      const updateTime = new Date().toISOString();
      let query = '';
      let params: any[] = [];
      
      if (status === 'sent') {
        query = 'UPDATE scheduled_messages SET status = ?, updated_at = ? WHERE id = ?';
        params = [status, updateTime, messageId];
      } else {
        query = 'UPDATE scheduled_messages SET status = ?, updated_at = ? WHERE id = ?';
        params = [status, updateTime, messageId];
      }
      
      this.db.run(query, params, function(err) {
        if (err) {
          console.error(`Error updating message ${messageId} status to ${status}:`, err);
          reject(err);
        } else {
          console.log(`Updated message ${messageId} status to ${status}`);
          resolve();
        }
      });
    });
  }
}