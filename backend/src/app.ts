import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        env.frontendUrl,
        'https://nexus-nta9.vercel.app',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
      ];
      if (
        allowedOrigins.includes(origin) ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        /\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get(['/api/health', '/health'], (_req, res) => {
  res.json({
    data: {
      service: 'nexus-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

