import express from 'express';
import { SlackService } from '../slack/slack.service';

const router = express.Router();
const slackService = new SlackService();

// Initiate OAuth flow
router.get('/slack', (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth-callback.html`;
  const scope = 'channels:read,chat:write,groups:read,channels:join';
  
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  res.json({ authUrl });
});

// Handle OAuth callback
router.get('/slack/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    
    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: 'OAuth authorization failed', 
        details: error 
      });
    }
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Authorization code not provided' 
      });
    }

    const tokenData = await slackService.exchangeCodeForToken(code as string);
    
    // Return success response for the callback page
    res.json({
      success: true,
      team: {
        id: tokenData.team_id,
        name: tokenData.team_name
      },
      message: 'Successfully connected to Slack!'
    });
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete OAuth flow' 
    });
  }
});