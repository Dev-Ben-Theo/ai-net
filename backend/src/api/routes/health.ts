/**
 * GET /api/health       — shallow health check
 * GET /api/health/deep  — checks Venice + Stellar Horizon reachability
 *
 * Cache TTL: CACHE_TTL_HEALTH (default 10s)
 */

import { Router } from 'express';
import { config, ttlForRoute } from '../../config/index';
import { cacheMiddleware } from '../middleware/cache';

const router = Router();

const startTime = Date.now();

// GET /api/health
router.get(
  '/',
  cacheMiddleware({ ttl: ttlForRoute('health') }),
  (_req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env['npm_package_version'] ?? '0.1.0',
      stellarNetwork: config.STELLAR_NETWORK,
    });
  },
);

// GET /api/health/deep
router.get(
  '/deep',
  cacheMiddleware({ ttl: ttlForRoute('health') }),
  async (_req, res) => {
    const [veniceStatus, horizonStatus] = await Promise.all([
      checkVenice(),
      checkHorizon(),
    ]);

    const allOk = veniceStatus === 'ok' && horizonStatus === 'ok';
    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      services: {
        venice: veniceStatus,
        horizon: horizonStatus,
      },
    });
  },
);

async function checkVenice(): Promise<'ok' | 'unreachable'> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const url = 'https://api.venice.ai/api/v1/models';
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${config.VENICE_API_KEY}` },
    });
    clearTimeout(timer);
    return resp.ok || resp.status === 401 ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

async function checkHorizon(): Promise<'ok' | 'unreachable'> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const resp = await fetch(config.STELLAR_HORIZON_URL, { signal: controller.signal });
    clearTimeout(timer);
    return resp.ok ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

export default router;
