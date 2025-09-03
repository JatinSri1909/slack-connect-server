import { Request, Response } from 'express';
import { SlackService } from '../services/slack.service';
import { APP_CONSTANTS, URIS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';
import { getSlackAuthUrl } from '../config/envrioment';

const slackService = new SlackService();

/**
 * Initiate OAuth flow by generating Slack authorization URL
 */
export const initiateSlackOAuth = (req: Request, res: Response): void => {
  try {
    const authUrl = getSlackAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_COMPLETE_OAUTH,
    });
  }
};

/**
 * Handle OAuth callback from Slack
 */
export const handleSlackOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, error } = req.query;

    if (error) {
      res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_MESSAGES.OAUTH_AUTHORIZATION_FAILED,
        details: error,
      });
      return;
    }

    if (!code) {
      res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_MESSAGES.AUTHORIZATION_CODE_NOT_PROVIDED,
      });
      return;
    }

    const tokenData = await slackService.exchangeCodeForToken(code as string);

    // Return success response for the callback page
    res.json({
      success: true,
      team: {
        id: tokenData.team_id,
        name: tokenData.team_name,
      },
      message: SUCCESS_MESSAGES.SUCCESSFULLY_CONNECTED,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_COMPLETE_OAUTH,
    });
  }
};
