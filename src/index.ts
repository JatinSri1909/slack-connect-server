import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import slackRoutes from './routes/slack.routes';
import cronRoutes from './routes/cron.routes';
import { Database } from './config/database';
import { postgresDb } from './config/postgres';
import { ScheduledMessageService } from './services/scheduled.message.service';
import {
  URIS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  APP_CONSTANTS,
} from './constants';
import { env, PORT, CORS_ORIGIN } from './config/envrioment';

// Validate environment variables
env.validate();

const app = express();

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database (use Postgres in production, SQLite in development)
async function initializeDatabase() {
  if (process.env.NODE_ENV === 'production') {
    await postgresDb.ensureInitialized();
  } else {
    Database.getInstance();
  }
}

// Initialize database and then start the server
initializeDatabase().then(() => {
  // Initialize scheduled message service
  new ScheduledMessageService();
  
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}${URIS.HEALTH_CHECK}`);
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// Routes
app.use(URIS.API_AUTH, authRoutes);
app.use(URIS.API_SLACK, slackRoutes);
app.use('/api/cron', cronRoutes);

// Health check endpoint
app.get(URIS.HEALTH_CHECK, (req, res) => {
  res.json({ status: 'OK', message: SUCCESS_MESSAGES.SERVER_RUNNING });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_MESSAGES.SOMETHING_WENT_WRONG,
    });
  },
);

