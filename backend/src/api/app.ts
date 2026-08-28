/**
 * Express application factory.
 *
 * Called by tests (pass port=0 for random) and by the server entry-point.
 * Wires up:
 *  - JSON body parsing
 *  - Pino HTTP request logging
 *  - Cache initialisation
 *  - Route mounting (health, stats, agents)
 *  - Global error handler
 */

import express, { Request, Response, NextFunction } from 'express';
import pinoHttp from 'pino-http';
import { config } from '../config/index';
import { initCache } from '../cache/index';
import { logger } from './logger';
import healthRouter from './routes/health';
import statsRouter from './routes/stats';
import agentsRouter from './routes/agents';

export function createApp() {
  // Initialise cache once (idempotent — subsequent calls return the same client)
  try {
    initCache({
      driver: config.CACHE_DRIVER,
      redisUrl: config.REDIS_URL,
      lruMaxSize: config.CACHE_LRU_MAX_SIZE,
      defaultTtlSeconds: Math.max(
        config.CACHE_TTL_AGENTS,
        config.CACHE_TTL_STATS,
        config.CACHE_TTL_HEALTH,
      ),
    });
  } catch {
    // Already initialised (e.g. during testing) — ignore
  }

  const app = express();

  // ── Middleware stack ──────────────────────────────────────────────────────

  app.use(express.json());

  if (config.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  app.use('/api/health', healthRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/agents', agentsRouter);

  // ── 404 catch-all ─────────────────────────────────────────────────────────

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  });

  // ── Global error handler ──────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({
      error: { message: err.message ?? 'Internal server error', code: 'INTERNAL_ERROR' },
    });
  });

  return app;
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'ai-net backend started');
  });

  const shutdown = () => {
    logger.info('Received shutdown signal — draining connections…');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
