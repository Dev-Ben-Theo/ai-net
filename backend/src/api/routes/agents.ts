/**
 * Agent registry API routes.
 *
 * GET  /api/agents         — list agents (cached, CACHE_TTL_AGENTS)
 * GET  /api/agents/:id     — get single agent (cached, CACHE_TTL_AGENTS)
 * POST /api/agents/register — register agent → INVALIDATES agents + stats cache
 * DELETE /api/agents/:id   — deregister agent → INVALIDATES agents + stats cache
 *
 * Full implementation tracked in Issue #24.  The routes are scaffolded here so
 * cache middleware and invalidation are fully exercised.
 */

import { Router, Request, Response } from 'express';
import { ttlForRoute } from '../../config/index';
import { cacheMiddleware } from '../middleware/cache';
import { invalidateOnAgentRegistration } from '../../cache/invalidation';

const router = Router();

// In-memory stub store until Issue #24 wires up the DB
const agentStore = new Map<string, AgentRecord>();

export interface AgentRecord {
  id: string;
  name: string;
  capabilities: string[];
  pricingXLM: number;
  endpoint: string;
  stellarPublicKey: string;
  reputationScore: number;
  lastSeenAt: string;
}

// ── GET /api/agents ──────────────────────────────────────────────────────────

router.get(
  '/',
  cacheMiddleware({ ttl: ttlForRoute('agents') }),
  (req: Request, res: Response) => {
    let agents = Array.from(agentStore.values());

    // Optional filters
    if (req.query['capability']) {
      agents = agents.filter((a) =>
        a.capabilities.includes(req.query['capability'] as string),
      );
    }
    if (req.query['minReputation']) {
      const min = parseFloat(req.query['minReputation'] as string);
      agents = agents.filter((a) => a.reputationScore >= min);
    }
    if (req.query['maxPriceXLM']) {
      const max = parseFloat(req.query['maxPriceXLM'] as string);
      agents = agents.filter((a) => a.pricingXLM <= max);
    }

    res.json(agents);
  },
);

// ── GET /api/agents/:id ──────────────────────────────────────────────────────

router.get(
  '/:id',
  cacheMiddleware({ ttl: ttlForRoute('agents') }),
  (req: Request, res: Response) => {
    const agent = agentStore.get(req.params['id']!);
    if (!agent) {
      res.status(404).json({ error: { message: 'Agent not found', code: 'AGENT_NOT_FOUND' } });
      return;
    }
    res.json(agent);
  },
);

// ── POST /api/agents/register ─────────────────────────────────────────────────
// Must be before /:id to avoid matching 'register' as an id

router.post('/register', async (req: Request, res: Response) => {
  const { agentId, capabilities, pricingXLM, endpoint, stellarPublicKey } = req.body as {
    agentId: string;
    capabilities: string[];
    pricingXLM: number;
    endpoint: string;
    stellarPublicKey: string;
  };

  if (!agentId || !capabilities?.length || !stellarPublicKey) {
    res.status(400).json({
      error: { message: 'agentId, capabilities, and stellarPublicKey are required', code: 'INVALID_BODY' },
    });
    return;
  }

  const record: AgentRecord = {
    id: agentId,
    name: agentId,
    capabilities,
    pricingXLM: pricingXLM ?? 1,
    endpoint: endpoint ?? '',
    stellarPublicKey,
    reputationScore: 1,
    lastSeenAt: new Date().toISOString(),
  };
  agentStore.set(agentId, record);

  // Invalidate cached agent list and stats
  await invalidateOnAgentRegistration();

  res.status(201).json({ registered: true, agent: record });
});

// ── DELETE /api/agents/:id ────────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params['id']!;
  if (!agentStore.has(id)) {
    res.status(404).json({ error: { message: 'Agent not found', code: 'AGENT_NOT_FOUND' } });
    return;
  }

  agentStore.delete(id);
  await invalidateOnAgentRegistration();

  res.status(204).send();
});

export default router;
