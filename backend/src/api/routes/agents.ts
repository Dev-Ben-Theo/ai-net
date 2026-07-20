import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Keypair, Server as HorizonServer } from "@stellar/stellar-sdk";
import { getAgentDb, createAgentDb, AgentDb } from "../../db/agents";
import { NotFoundError, ValidationError, UnauthorizedError, AppError } from "../../errors";

export interface AgentsRouterOptions {
  healthTimeoutMs?: number;
  db?: AgentDb;
}

const RegisterAgentSchema = z.object({
  agentId: z.string(),
  capabilities: z.array(z.string()),
  pricingXLM: z.number(),
  endpoint: z.string().url(),
  stellarPublicKey: z.string()
});

const DEFAULT_HEALTH_TIMEOUT_MS = 3_000;
const horizon = new HorizonServer("https://horizon-testnet.stellar.org");

export function createAgentsRouter(options: AgentsRouterOptions = {}): Router {
  const router = Router();
  const healthTimeoutMs = options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;

  const getDb = () => options.db ?? createAgentDb(getAgentDb());

  router.get("/", (req: Request, res: Response, next: NextFunction): void => {
    const db = getDb();
    const capability = req.query.capability as string | undefined;
    const minReputation = req.query.minReputation ? parseFloat(req.query.minReputation as string) : undefined;
    const maxPriceXLM = req.query.maxPriceXLM ? parseFloat(req.query.maxPriceXLM as string) : undefined;

    try {
      const agents = db.list({ capability, minReputation, maxPriceXLM });
      res.json(agents);
    } catch (err) {
      next(new AppError("Internal Server Error", 500, "INTERNAL_ERROR"));
    }
  });

  router.get("/:id", (req: Request, res: Response, next: NextFunction): void => {
    const db = getDb();
    const agent = db.findById(req.params.id);
    if (!agent) {
      next(new NotFoundError("Agent"));
      return;
    }
    res.json(agent);
  });

  router.get("/:id/health", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const db = getDb();
    const agent = db.findById(req.params.id);
    if (!agent) {
      next(new NotFoundError("Agent"));
      return;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), healthTimeoutMs);

    try {
      const response = await fetch(agent.endpoint, {
        method: "GET",
        signal: controller.signal,
      });

      res.status(200).json({
        status: response.ok ? "healthy" : "unreachable",
        latencyMs: Date.now() - startedAt,
      });
    } catch {
      res.status(200).json({
        status: "unreachable",
        latencyMs: Date.now() - startedAt,
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  router.post("/register", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parse = RegisterAgentSchema.safeParse(req.body);
    if (!parse.success) {
      next(new ValidationError("Invalid request body", parse.error.flatten()));
      return;
    }

    const data = parse.data;

    try {
      await horizon.loadAccount(data.stellarPublicKey);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        next(new ValidationError("Stellar account not found"));
        return;
      }
      next(new ValidationError("Failed to verify Stellar account", err.message));
      return;
    }

    const db = getDb();
    const agent = {
      id: data.agentId,
      capabilities: data.capabilities,
      pricingXLM: data.pricingXLM,
      endpoint: data.endpoint,
      stellarPublicKey: data.stellarPublicKey,
      reputationScore: 0,
      lastSeenAt: new Date().toISOString()
    };

    db.upsert(agent);
    res.status(201).json(agent);
  });

  router.delete("/:id", (req: Request, res: Response, next: NextFunction): void => {
    const db = getDb();
    const agent = db.findById(req.params.id);
    if (!agent) {
      next(new NotFoundError("Agent"));
      return;
    }

    const signature = req.headers["x-signature"] as string;
    const challenge = req.headers["x-challenge"] as string;

    if (!signature || !challenge) {
      next(new UnauthorizedError("Missing challenge or signature"));
      return;
    }

    try {
      const keypair = Keypair.fromPublicKey(agent.stellarPublicKey);
      const isValid = keypair.verify(Buffer.from(challenge), Buffer.from(signature, "base64"));
      if (!isValid) {
        next(new UnauthorizedError("Invalid signature"));
        return;
      }
    } catch (err) {
      next(new UnauthorizedError("Invalid signature format"));
      return;
    }

    db.delete(req.params.id);
    res.json({ message: "Agent deleted successfully" });
  });

  return router;
}

export const agentsRouter = createAgentsRouter();
