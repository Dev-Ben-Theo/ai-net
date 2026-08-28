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
