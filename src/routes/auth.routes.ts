import express from 'express';
import { URIS } from '../constants';
import {
  initiateSlackOAuth,
  handleSlackOAuthCallback,
} from '../controllers/auth.controllers';

const router = express.Router();

// Initiate OAuth flow
router.get(URIS.AUTH_SLACK, initiateSlackOAuth);

// Handle OAuth callback
router.get(URIS.AUTH_SLACK_CALLBACK, handleSlackOAuthCallback);

export default router;
