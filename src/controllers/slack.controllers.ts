import { Request, Response } from 'express';
import { SlackService } from '../services/slack.service';
import { ScheduledMessageService } from '../services/scheduled.message.service';
import { Database } from '../config/database';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  APP_CONSTANTS,
  SQL_QUERIES,
} from '../constants';

const slackService = new SlackService();
const scheduledMessageService = new ScheduledMessageService();

/**
 * Get channels for a team
 */
export const getChannels = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { teamId } = req.params;
    const channels = await slackService.getChannels(teamId);

    const formattedChannels = channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      is_private: channel.is_private,
    }));

    res.json({ channels: formattedChannels });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_MESSAGES.FAILED_TO_FETCH_CHANNELS,
    });
  }
};

/**
 * Send immediate message
 */
export const sendMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { teamId, channelId, message } = req.body;

    if (!teamId || !channelId || !message) {
      res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS,
      });
      return;
    }

    await slackService.sendMessage(teamId, channelId, message);
    res.json({ success: true, message: SUCCESS_MESSAGES.MESSAGE_SENT });
  } catch (error: any) {
    console.error('Error sending message:', error);

    // Check for Slack API specific errors
    if (error.data?.error === APP_CONSTANTS.SLACK_ERRORS.NOT_IN_CHANNEL) {
      res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: APP_CONSTANTS.SLACK_ERRORS.NOT_IN_CHANNEL,
        message: ERROR_MESSAGES.PRIVATE_CHANNEL_WARNING,
      });
      return;
    }

    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.data?.error || 'unknown_error',
      message: ERROR_MESSAGES.FAILED_TO_SEND_MESSAGE,
    });
  }
};

/**
 * Schedule a message
 */
export const scheduleMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { teamId, channelId, channelName, message, scheduledTime } = req.body;

    if (!teamId || !channelId || !channelName || !message || !scheduledTime) {
      res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS,
      });
      return;
    }

    const scheduledTimeMs = new Date(scheduledTime).getTime();

    if (scheduledTimeMs <= Date.now()) {
      res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.SCHEDULED_TIME_MUST_BE_FUTURE,
      });
      return;
    }

    // Try to join the channel early to verify bot access
    try {
      await slackService.joinChannel(teamId, channelId);
    } catch (joinError) {
      console.log(
        `Warning: Could not pre-verify channel access for scheduling: ${channelId}`,
      );
      // We continue anyway as the join will be attempted again when the message is sent
    }

    const messageId = await scheduledMessageService.scheduleMessage({
      team_id: teamId,
      channel_id: channelId,
      channel_name: channelName,
      message,
      scheduled_time: scheduledTimeMs,
    });

    res.json({
      success: true,
      messageId,
      message: SUCCESS_MESSAGES.MESSAGE_SCHEDULED,
      warning: ERROR_MESSAGES.PRIVATE_CHANNEL_WARNING,
    });
  } catch (error: any) {
    console.error('Error scheduling message:', error);

    // Check for Slack API specific errors
    if (error.data?.error === APP_CONSTANTS.SLACK_ERRORS.NOT_IN_CHANNEL) {
      res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: APP_CONSTANTS.SLACK_ERRORS.NOT_IN_CHANNEL,
        message: ERROR_MESSAGES.PRIVATE_CHANNEL_WARNING,
      });
      return;
    }

    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.data?.error || 'unknown_error',
      message: ERROR_MESSAGES.FAILED_TO_SCHEDULE_MESSAGE,
    });
  }
};

/**
 * Get scheduled messages for a team
 */
export const getScheduledMessages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { teamId } = req.params;
    const messages = await scheduledMessageService.getScheduledMessages(teamId);

    res.json({ messages });
  } catch (error) {
    console.error('Error fetching scheduled messages:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_MESSAGES.FAILED_TO_FETCH_SCHEDULED_MESSAGES,
    });
  }
};

/**
 * Cancel scheduled message
 */
export const cancelScheduledMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { messageId } = req.params;
    const { teamId } = req.body;

    if (!teamId) {
      res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.TEAM_ID_REQUIRED,
      });
      return;
    }

    const success = await scheduledMessageService.cancelScheduledMessage(
      parseInt(messageId),
      teamId,
    );

    if (success) {
      res.json({ success: true, message: SUCCESS_MESSAGES.MESSAGE_CANCELLED });
    } else {
      res.status(APP_CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.MESSAGE_NOT_FOUND,
      });
    }
  } catch (error) {
    console.error('Error cancelling message:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_MESSAGES.FAILED_TO_CANCEL_MESSAGE,
    });
  }
};

/**
 * Get database status (admin endpoint)
 */
export const getDatabaseStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const db = Database.getInstance().db;

    // Get basic stats
    const tokenCount = await new Promise<number>((resolve, reject) => {
      db.get(SQL_QUERIES.COUNT_TOKENS, (err, row: any) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    const messageStats = await new Promise<any>((resolve, reject) => {
      db.all(SQL_QUERIES.MESSAGE_STATS_BY_STATUS, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      status: 'healthy',
      database: {
        connectedTeams: tokenCount,
        messageStats: messageStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking database status:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: ERROR_MESSAGES.FAILED_TO_CHECK_DB_STATUS,
      timestamp: new Date().toISOString(),
    });
  }
};
