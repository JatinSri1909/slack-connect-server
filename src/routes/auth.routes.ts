import express from 'express';
import { SlackService } from '../services/slack.service';
import { APP_CONSTANTS, URIS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';

const router = express.Router();
const slackService = new SlackService();

// Initiate OAuth flow
router.get(URIS.AUTH_SLACK, (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.FRONTEND_URL || APP_CONSTANTS.DEFAULT_FRONTEND_URL}${APP_CONSTANTS.OAUTH_CALLBACK_PATH}`;
  const scope = APP_CONSTANTS.SLACK_SCOPE;

  const authUrl = `${URIS.SLACK_OAUTH_AUTHORIZE}?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.json({ authUrl });
});

// Handle OAuth callback
router.get(URIS.AUTH_SLACK_CALLBACK, async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_MESSAGES.OAUTH_AUTHORIZATION_FAILED,
        details: error,
      });
    }

    if (!code) {
      return res.status(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_MESSAGES.AUTHORIZATION_CODE_NOT_PROVIDED,
      });
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
});

export default router;
