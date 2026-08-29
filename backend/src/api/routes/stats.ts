/**
 * GET /api/stats — network statistics
 *
 * Returns aggregated KPIs for the frontend dashboard.
 * Cache TTL: CACHE_TTL_STATS (default 30s)
 *
 * The underlying stats computation is intentionally stubbed here; the full
 * DB-backed implementation is tracked in Issue #29.  The route is fully wired
 * so the cache middleware exercises the real cache path.
 */

import { Router, Request, Response } from 'express';
import { ttlForRoute } from '../../config/index';
import { cacheMiddleware } from '../middleware/cache';

const router = Router();

// GET /api/stats
router.get(
  '/',
  cacheMiddleware({ ttl: ttlForRoute('stats') }),
  async (_req: Request, res: Response) => {
    // TODO (Issue #29): replace with real DB aggregation via StatsService
    const stats = await computeStats();
    res.json(stats);
  },
);

// ---------------------------------------------------------------------------
// Stats computation (stub — real implementation in Issue #29)
// ---------------------------------------------------------------------------

export interface TimePoint {
  timestamp: string; // ISO-8601
  value: number;
}

export interface StatsPayload {
  totalAgents: number;
  totalTasks: number;
  totalXLMTransacted: string; // stringified for precision
  uptimePercent: number;
  tasksLast24h: TimePoint[];
  xlmLast24h: TimePoint[];
}

async function computeStats(): Promise<StatsPayload> {
  // Build 24 hourly time-points ending at the current hour
  const now = new Date();
  const tasksLast24h: TimePoint[] = [];
  const xlmLast24h: TimePoint[] = [];

  for (let i = 23; i >= 0; i--) {
    const ts = new Date(now);
    ts.setHours(ts.getHours() - i, 0, 0, 0);
    tasksLast24h.push({ timestamp: ts.toISOString(), value: 0 });
    xlmLast24h.push({ timestamp: ts.toISOString(), value: 0 });
  }

  return {
    totalAgents: 0,
    totalTasks: 0,
    totalXLMTransacted: '0.0000000',
    uptimePercent: 100,
    tasksLast24h,
    xlmLast24h,
  };
}

export default router;
import { Router } from 'express';
import { getStats, type DbClient } from '../../db/stats';
import { StatsCache } from '../../utils/statsCache';
import { createLogger } from '../../utils/logger';

export function createStatsRouter(db: DbClient) {
  const router = Router();
  const logger = createLogger({ module: 'stats' });
  const cache = new StatsCache({
    ttlMs: 60_000,
    computeStats: () => getStats(db)
  });

  /**
   * @openapi
   * /api/stats:
   *   get:
   *     summary: Get network statistics and analytics
   *     description: Returns aggregated network performance metrics including total registered agents, completed tasks, system uptime percentage, XLM transacted, and 24-hour activity time series.
   *     operationId: getStats
   *     tags: [Stats]
   *     security: []
   *     responses:
   *       200:
   *         description: Current network statistics retrieved successfully
   *         headers:
   *           X-RateLimit-Limit:
   *             $ref: '#/components/headers/X-RateLimit-Limit'
   *           X-RateLimit-Remaining:
   *             $ref: '#/components/headers/X-RateLimit-Remaining'
   *           X-RateLimit-Reset:
   *             $ref: '#/components/headers/X-RateLimit-Reset'
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StatsResponse'
   *             example:
   *               totalAgents: 12
   *               totalTasks: 348
   *               uptimePercent: 99.98
   *               totalXLMTransacted: 1250.75
   *               tasksLast24h:
   *                 - timestamp: "2026-08-25T12:00:00.000Z"
   *                   value: 45
   *               xlmLast24h:
   *                 - timestamp: "2026-08-25T12:00:00.000Z"
   *                   value: 120.5
   *       500:
   *         description: Unable to load stats
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InternalServerError'
   */
  router.get('/', async (req, res) => {
    try {
      const stats = await cache.get();
      return res.status(200).json(stats);
    } catch (error) {
      logger.error({ err: error }, "failed to load stats");
      return res.status(500).json({ error: 'Unable to load stats' });
    }
  });

  return router;
}
