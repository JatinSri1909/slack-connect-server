import express from 'express';
import { SlackService } from './slack.service';
import { ScheduledMessageService } from './scheduled.message.service';

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
    
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
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
      message: 'Message scheduled successfully' 
    });
    
  } catch (error) {
    console.error('Error scheduling message:', error);
    res.status(500).json({ error: 'Failed to schedule message' });
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

export default router;