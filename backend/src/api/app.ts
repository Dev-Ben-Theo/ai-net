import express, { Request, Response, NextFunction } from "express";
import { createServer, Server as HttpServer } from "http";
import { randomUUID } from "crypto";

import { decompose } from "../coordinator/decompose";
import {
  executeDAG,
  type DispatchFn,
  type PaymentReleaseFn,
} from "../coordinator/coordinator";
import { createTask, getTask } from "../coordinator/taskStore";
import { eventBus } from "../coordinator/eventBus";
import { createEventStore, type EventStore } from "../coordinator/eventStore";
import { attachTaskStream, type TaskStreamOptions } from "./routes/stream";
import {
  createPaymentReleaseFn,
  type StellarReleasePaymentFn,
} from "../payment";
import { agentsRouter } from "./routes/agents";
import { healthRouter } from "./routes/health";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { authMiddleware } from "./middleware/auth";
import { requestId } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import { createLogger } from "../utils/logger";
import { createTaskDb, getTaskDb } from "../db/tasks";
import { ValidationError, UnauthorizedError, NotFoundError, AppError } from "../errors";

export interface AppOptions {
  /** Called to execute a single DAG node; defaults to HTTP dispatch */
  dispatch?: DispatchFn;
  /** Called after each node completes; defaults to no-op (returns 'mock-hash') */
  releasePayment?: PaymentReleaseFn;
  /** Event log for stream replay; defaults to an in-memory SQLite store */
  eventStore?: EventStore;
  /** Heartbeat / auth timing for the WebSocket stream */
  stream?: TaskStreamOptions;
}

function tryLoadStellarRelease(): StellarReleasePaymentFn | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../../smart-contracts/src/payment/payment")
      .releasePayment as StellarReleasePaymentFn;
  } catch {
    return undefined;
  }
}

export function createApp(opts: AppOptions = {}): {
  httpServer: HttpServer;
  close: () => void;
} {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.use(requestLogger);

  const dispatch: DispatchFn = opts.dispatch ?? defaultDispatch;
  const releasePayment: PaymentReleaseFn =
    opts.releasePayment ?? createPaymentReleaseFn(tryLoadStellarRelease());

  app.use("/health", healthRouter);
  app.use("/api/agents", agentsRouter);

  app.post(
    "/api/tasks",
    authMiddleware,
    rateLimitMiddleware,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { prompt, walletPublicKey, maxBudgetXLM } = req.body as {
          prompt?: string;
          walletPublicKey?: string;
          maxBudgetXLM?: number;
        };

        if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
          throw new ValidationError("prompt is required");
        }

        if (maxBudgetXLM !== undefined && maxBudgetXLM < 0.1) {
          throw new ValidationError("maxBudgetXLM must be >= 0.1");
        }

        const taskId = `task_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
        const dag = decompose(taskId, prompt);
        const now = new Date().toISOString();
        const correlationId = res.locals.requestId;

        createTask({
          taskId,
          prompt,
          walletPublicKey:
            walletPublicKey ??
            (req.headers["walletpublickey"] as string | undefined) ??
            "anonymous",
          status: "queued",
          dag,
          createdAt: now,
          updatedAt: now,
          requestId: correlationId,
        });

        const log = createLogger({ requestId: correlationId, taskId });

        setImmediate(() => {
          executeDAG(getTask(taskId)!, dispatch, releasePayment).catch((err) => {
            log.error({ err }, "DAG execution error");
          });
        });

        log.info({ dagNodeCount: dag.length }, "task created");

        return res
          .status(201)
          .json({ taskId, dagPreview: dag, status: "queued" });
      } catch (err) {
        next(err);
      }
    },
  );

  app.get("/api/tasks", authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    try {
      const walletPublicKey = req.headers["walletpublickey"] as string | undefined;
      if (!walletPublicKey) {
        throw new UnauthorizedError("walletpublickey header required");
      }
      const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt((req.query.pageSize as string) ?? "20", 10)),
      );
      const taskDb = createTaskDb(getTaskDb());
      const status = req.query.status as string | undefined;
      const q = req.query.q as string | undefined;
      const sort = req.query.sort as
        "createdAt:asc" | "createdAt:desc" | undefined;
      const { tasks, total } = taskDb.list(walletPublicKey, page, pageSize, {
        status,
        q,
        sort,
      });
      return res.json({ tasks, total, page, pageSize });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/tasks/:id", (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = getTask(req.params.id!);
      if (!task) throw new NotFoundError("Task");
      return res.json({ ...task, id: task.taskId, dag: task.dag });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/tasks/:id", (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = getTask(req.params.id!);
      if (!task) throw new NotFoundError("Task");
      if (task.status === "running") {
        throw new AppError("Cannot cancel a running task", 409, "CONFLICT");
      }
      const taskDb = createTaskDb(getTaskDb());
      taskDb.updateStatus(req.params.id!, "cancelled");
      return res.json({ ...task, id: task.taskId, status: "cancelled" });
    } catch (err) {
      next(err);
    }
  });

  const httpServer = createServer(app);

  const eventStore = opts.eventStore ?? createEventStore();
  const stopRecording = eventBus.subscribeAll((event) =>
    eventStore.append(event),
  );

  const detachStream = attachTaskStream({
    httpServer,
    eventStore,
    eventBus,
    getTask,
    ...opts.stream,
  });

  app.use(errorHandler);

  function close(): void {
    detachStream();
    stopRecording();
    eventStore.close();
    httpServer.close();
  }

  return { httpServer, close };
}

async function defaultDispatch(
  taskId: string,
  node: { nodeId: string; agentType: string; prompt: string },
  context: string,
): Promise<unknown> {
  throw new AppError(
    `No agent registered for type: ${node.agentType}`,
    500,
    "AGENT_NOT_FOUND",
  );
}
