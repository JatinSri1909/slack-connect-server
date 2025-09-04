# Slack App Setup Guide

Follow these steps to create and configure your Slack application:

## 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Enter your app name: "Slack Connect"
5. Select your development workspace
6. Click "Create App"

## 2. Configure OAuth & Permissions

1. In your app settings, go to "OAuth & Permissions" in the sidebar
2. Add the following Redirect URLs:
   - For development: `http://localhost:5000/api/auth/slack/callback`
   - For production: `https://your-backend-domain.com/api/auth/slack/callback`

3. Add the following Bot Token Scopes:
   - `channels:read` - View basic information about public channels
   - `groups:read` - View basic information about private channels
   - `chat:write` - Send messages as the app
   - `channels:join` - Join public channels

## 3. Get Your Credentials

1. In "Basic Information", find "App Credentials"
2. Copy your **Client ID** and **Client Secret**
3. Add these to your `.env` file:
   SLACK_CLIENT_ID=your_client_id_here
   SLACK_CLIENT_SECRET=your_client_secret_here

## 4. Install to Workspace (Development)

1. In "OAuth & Permissions", click "Install to Workspace"
2. Authorize the requested permissions
3. You'll see your Bot User OAuth Token (keep this secure)

## 5. Distribution Settings (Optional)

If you want to distribute your app to other workspaces:

1. Go to "Manage Distribution"
2. Complete the checklist requirements
3. Submit for review if needed

## Important Security Notes

- Never commit your Client Secret to version control
- Use environment variables for all sensitive data
- Implement proper token refresh logic (already included in our app)
- Consider implementing rate limiting for production use
