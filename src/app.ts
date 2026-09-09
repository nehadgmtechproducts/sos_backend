import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import contactRoutes from './routes/contact.routes.js';
import sosRoutes from './routes/sos.routes.js';
import deviceRoutes from './routes/device.routes.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { noStore } from './middleware/cache.js';
import { metrics, snapshot } from './middleware/metrics.js';
import { isProd } from './config/env.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // needed for correct client IPs behind a proxy
  // Dynamic auth responses must not be cacheable, so ETag validators are pointless
  // here — disabling them removes a per-response hash computation (less CPU) and
  // avoids emitting a caching fingerprint for OTP/token payloads.
  app.set('etag', false);
  app.set('x-powered-by', false);

  app.use(metrics); // must be first so it times the whole chain
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // Operational metrics. Open in dev; in production require a bearer token so the
  // memory/latency profile isn't world-readable.
  app.get('/metrics', (req, res) => {
    const token = process.env.METRICS_TOKEN;
    if (isProd && (!token || req.get('x-metrics-token') !== token)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No route for GET /metrics' } });
    }
    res.set('Cache-Control', 'no-store');
    res.json(snapshot());
  });

  // Auth endpoints handle one-time codes and JWTs — never cache them anywhere.
  app.use('/api/v1/auth', noStore, authRoutes);
  app.use('/api/v1/users', noStore, requireAuth, userRoutes);
  app.use('/api/v1/contacts', noStore, requireAuth, contactRoutes);
  app.use('/api/v1/sos', noStore, requireAuth, sosRoutes);
  app.use('/api/v1/devices', noStore, requireAuth, deviceRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// Vercel imports this entry point directly; local startup stays in index.ts.
export default createApp();
