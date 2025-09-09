import express from 'express';
import { ScheduledMessageService } from '../services/scheduled.message.service';

const router = express.Router();

// Manual trigger endpoint for immediate processing (for testing/external cron)
router.get('/process-messages', async (req, res) => {
  try {
    console.log('Cron job triggered: Processing scheduled messages');
    
    // Initialize the scheduled message service
    const scheduledMessageService = new ScheduledMessageService();
    
    // Process pending messages
    await scheduledMessageService.processPendingMessages();
    
    res.json({ 
      success: true, 
      message: 'Scheduled messages processed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process scheduled messages',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
