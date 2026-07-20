import { Router, Request, Response, NextFunction } from 'express';
import { getStats, type DbClient } from '../../db/stats';
import { StatsCache } from '../../utils/statsCache';
import { AppError } from '../../errors';

export function createStatsRouter(db: DbClient) {
  const router = Router();
  const cache = new StatsCache({
    ttlMs: 60_000,
    computeStats: () => getStats(db)
  });

  router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await cache.get();
      return res.status(200).json(stats);
    } catch (error) {
      next(new AppError('Unable to load stats', 500, 'STATS_LOAD_ERROR'));
    }
  });

  return router;
}
