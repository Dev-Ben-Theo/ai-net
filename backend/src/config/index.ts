/**
 * Configuration module — loads and validates all env vars at startup.
 * Every other module imports from here; direct process.env access is banned.
 *
 * Fails fast (throws) if any required var is missing or malformed.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Stellar
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  STELLAR_HORIZON_URL: z
    .string()
    .url()
    .default('https://horizon-testnet.stellar.org'),

  // Venice AI
  VENICE_API_KEY: z.string().min(1, 'VENICE_API_KEY is required'),

  // Database
  DATABASE_URL: z.string().min(1).default('./data/ai-net.db'),

  // Cache
  CACHE_DRIVER: z.enum(['lru', 'redis']).default('lru'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CACHE_LRU_MAX_SIZE: z.coerce.number().int().positive().default(500),

  // Per-endpoint TTLs (seconds)
  CACHE_TTL_AGENTS: z.coerce.number().int().nonnegative().default(60),
  CACHE_TTL_STATS: z.coerce.number().int().nonnegative().default(30),
  CACHE_TTL_HEALTH: z.coerce.number().int().nonnegative().default(10),
});

// ---------------------------------------------------------------------------
// Parse — throws ZodError on missing/invalid vars
// ---------------------------------------------------------------------------

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`[config] Invalid environment variables:\n${messages}`);
  }

  return result.data;
}

// Singleton — evaluated once at import time
export const config = loadConfig();

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** TTL in seconds for a given route group */
export function ttlForRoute(group: 'agents' | 'stats' | 'health'): number {
  switch (group) {
    case 'agents':
      return config.CACHE_TTL_AGENTS;
    case 'stats':
      return config.CACHE_TTL_STATS;
    case 'health':
      return config.CACHE_TTL_HEALTH;
  }
}

export type Config = typeof config;
