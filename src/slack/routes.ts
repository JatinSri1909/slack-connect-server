import express from 'express';
import { SlackService } from './slack.service';
import { ScheduledMessageService } from './scheduled.message.service';
import { Database } from '../config/database';

const router = express.Router();
const slackService = new SlackService();
const scheduledMessageService = new ScheduledMessageService();

// Get channels for a team
router.get('/channels/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const channels = await slackService.getChannels(teamId);
    
    const formattedChannels = channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      is_private: channel.is_private
    }));
    
    res.json({ channels: formattedChannels });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Send immediate message
router.post('/send-message', async (req, res) => {
  try {
    const { teamId, channelId, message } = req.body;
    
    if (!teamId || !channelId || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await slackService.sendMessage(teamId, channelId, message);
    res.json({ success: true, message: 'Message sent successfully' });
    
  } catch (error: any) {
    console.error('Error sending message:', error);
    
    // Check for Slack API specific errors
    if (error.data?.error === 'not_in_channel') {
      return res.status(400).json({
        success: false,
        error: 'not_in_channel',
        message: 'The bot attempted to join but could not access this channel. For private channels, please add the bot manually using /invite @YourBotName in Slack.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.data?.error || 'unknown_error',
      message: 'Failed to send message'
    });
  }
});

// Schedule a message
router.post('/schedule-message', async (req, res) => {
  try {
    const { teamId, channelId, channelName, message, scheduledTime } = req.body;
    
    if (!teamId || !channelId || !channelName || !message || !scheduledTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const scheduledTimeMs = new Date(scheduledTime).getTime();
    
    if (scheduledTimeMs <= Date.now()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    // Try to join the channel early to verify bot access
    try {
      await slackService.joinChannel(teamId, channelId);
    } catch (joinError) {
      console.log(`Warning: Could not pre-verify channel access for scheduling: ${channelId}`);
      // We continue anyway as the join will be attempted again when the message is sent
    }

    const messageId = await scheduledMessageService.scheduleMessage({
      team_id: teamId,
      channel_id: channelId,
      channel_name: channelName,
      message,
      scheduled_time: scheduledTimeMs
    });

    res.json({ 
      success: true, 
      messageId,
      message: 'Message scheduled successfully',
      warning: 'Remember, for private channels, please add the bot manually using /invite @YourBotName in Slack.'
    });
    
  } catch (error: any) {
    console.error('Error scheduling message:', error);
    
    // Check for Slack API specific errors
    if (error.data?.error === 'not_in_channel') {
      return res.status(400).json({
        success: false,
        error: 'not_in_channel',
        message: 'The bot attempted to join but could not access this channel. For private channels, please add the bot manually using /invite @YourBotName in Slack.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.data?.error || 'unknown_error',
      message: 'Failed to schedule message'
    });
  }
});

// Get scheduled messages
router.get('/scheduled-messages/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const messages = await scheduledMessageService.getScheduledMessages(teamId);
    
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching scheduled messages:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled messages' });
  }
});

// Cancel scheduled message
router.delete('/scheduled-messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { teamId } = req.body;
    
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const success = await scheduledMessageService.cancelScheduledMessage(
      parseInt(messageId), 
      teamId
    );
    
    if (success) {
      res.json({ success: true, message: 'Message cancelled successfully' });
    } else {
      res.status(404).json({ error: 'Message not found or already processed' });
    }
    
  } catch (error) {
    console.error('Error cancelling message:', error);
    res.status(500).json({ error: 'Failed to cancel message' });
  }
});

// Database status endpoint (simple admin route)
router.get('/db-status', async (req, res) => {
  try {
    const db = Database.getInstance().db;
    
    // Get basic stats
    const tokenCount = await new Promise<number>((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM slack_tokens', (err, row: any) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    const messageStats = await new Promise<any>((resolve, reject) => {
      db.all('SELECT status, COUNT(*) as count FROM scheduled_messages GROUP BY status', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      status: 'healthy',
      database: {
        connectedTeams: tokenCount,
        messageStats: messageStats
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking database status:', error);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to check database status',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;