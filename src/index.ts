import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './auth/routes';
import slackRoutes from './slack/routes';
import { Database } from './config/database';
import { ScheduledMessageService } from './slack/scheduled.message.service';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
Database.getInstance();

// Initialize scheduled message service
new ScheduledMessageService();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/slack', slackRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Slack Connect Backend is running' });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});