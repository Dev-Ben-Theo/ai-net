import express, { Request, Response, NextFunction } from "express";
import type { AddressInfo } from "net";
import request from "supertest";
import { createAgentsRouter } from "../src/api/routes/agents";
import { AgentRecord, createAgentDb } from "../src/db/agents";
import Database from "better-sqlite3";
import { AppError } from "../src/errors";

const codingAgent: AgentRecord = {
  id: "coding-1",
  capabilities: ["coding"],
  pricingXLM: 2.5,
  endpoint: "http://127.0.0.1:3001/health",
  stellarPublicKey: "GBXX...",
  reputationScore: 0,
  lastSeenAt: new Date().toISOString()
};

function testErrorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      error: { code: err.code, message: err.message },
    };
    if (err.details !== undefined) {
      (body.error as Record<string, unknown>).details = err.details;
    }
    res.status(err.statusCode).json(body);
    return;
  }
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
}

function createTestApp(initialAgents: AgentRecord[] = [], healthTimeoutMs = 500) {
  const rawDb = new Database(":memory:");
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id               TEXT PRIMARY KEY,
      capabilities     TEXT NOT NULL,
      pricingXLM       REAL NOT NULL,
      endpoint         TEXT NOT NULL,
      stellarPublicKey TEXT NOT NULL,
      reputationScore  REAL NOT NULL DEFAULT 0,
      lastSeenAt       TEXT NOT NULL
    )
  `);
  const db = createAgentDb(rawDb);
  for (const agent of initialAgents) {
    db.upsert(agent);
  }
  const app = express();
  app.use(express.json());
  app.use("/api/agents", createAgentsRouter({ db, healthTimeoutMs }));
  app.use(testErrorHandler);
  return app;
}

function listen(app: express.Express) {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

describe("Agents API route", () => {
  it("returns 200 with an empty array when no agents are registered", async () => {
    const response = await request(createTestApp()).get("/api/agents");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns all agents from the local registry cache", async () => {
    const response = await request(createTestApp([codingAgent])).get("/api/agents");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([codingAgent]);
  });

  it("returns a single agent by id", async () => {
    const response = await request(createTestApp([codingAgent])).get("/api/agents/coding-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(codingAgent);
  });

  it("returns 404 for an unknown agent id", async () => {
    const response = await request(createTestApp()).get("/api/agents/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "NOT_FOUND", message: "Agent not found" } });
  });

  it("returns healthy status and latency for a reachable agent endpoint", async () => {
    const healthApp = express();
    healthApp.get("/health", (_req, res) => res.status(200).json({ ok: true }));
    const healthServer = listen(healthApp);

    try {
      const response = await request(createTestApp([{
        ...codingAgent,
        endpoint: `${healthServer.url}/health`,
      }])).get("/api/agents/coding-1/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("healthy");
      expect(response.body.latencyMs).toEqual(expect.any(Number));
    } finally {
      healthServer.server.close();
    }
  });

  it("returns unreachable status when an agent endpoint times out", async () => {
    const slowApp = express();
    slowApp.get("/health", (_req, res) => {
      setTimeout(() => res.status(200).json({ ok: true }), 100);
    });
    const slowServer = listen(slowApp);

    try {
      const response = await request(createTestApp([{
        ...codingAgent,
        endpoint: `${slowServer.url}/health`,
      }], 10)).get("/api/agents/coding-1/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("unreachable");
      expect(response.body.latencyMs).toEqual(expect.any(Number));
    } finally {
      slowServer.server.close();
    }
  });

  it("returns 404 when checking health for an unknown agent", async () => {
    const response = await request(createTestApp()).get("/api/agents/missing/health");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "NOT_FOUND", message: "Agent not found" } });
  });
});
