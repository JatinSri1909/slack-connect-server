import express from 'express';
import { URIS } from '../constants';
import {
  getChannels,
  sendMessage,
  scheduleMessage,
  getScheduledMessages,
  cancelScheduledMessage,
  getDatabaseStatus,
} from '../controllers/slack.controllers';

const router = express.Router();

// Get channels for a team
router.get(URIS.SLACK_CHANNELS, getChannels);

// Send immediate message
router.post(URIS.SLACK_SEND_MESSAGE, sendMessage);

// Schedule a message
router.post(URIS.SLACK_SCHEDULE_MESSAGE, scheduleMessage);

// Get scheduled messages
router.get(URIS.SLACK_SCHEDULED_MESSAGES, getScheduledMessages);

// Cancel scheduled message
router.delete(URIS.SLACK_CANCEL_MESSAGE, cancelScheduledMessage);

// Database status endpoint (simple admin route)
router.get(URIS.SLACK_DB_STATUS, getDatabaseStatus);

export default router;
