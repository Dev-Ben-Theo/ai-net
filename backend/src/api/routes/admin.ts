import { Router, Request, Response } from "express";
import { getGlobalJobQueue, type JobQueue, type JobStatus } from "../../queue";

export function createAdminQueueRouter(queue?: JobQueue): Router {
  const router = Router();
  const jobQueue = queue ?? getGlobalJobQueue();

  /**
   * @openapi
   * /api/admin/queue/status:
   *   get:
   *     summary: Get background job queue status and statistics
   *     description: Returns aggregated metrics on pending, active, completed, failed, and dead-letter jobs along with worker status.
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Queue status and metrics
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QueueStatusResponse'
   *             example:
   *               status: "healthy"
   *               stats:
   *                 queued: 2
   *                 active: 1
   *                 completed: 140
   *                 failed: 1
   *                 deadLetter: 0
   *               worker:
   *                 running: true
   *                 activeWorkers: 1
   *                 concurrency: 5
   *                 pollIntervalMs: 1000
   *               activeJobs: []
   *               deadLetterJobs: []
   */
  router.get("/status", (_req: Request, res: Response) => {
    const stats = jobQueue.getStats();
    const worker = jobQueue.getWorker();
    const active = jobQueue.listJobs({ status: "active", pageSize: 20 });
    const deadLetter = jobQueue.getDeadLetterJobs(1, 20);

    res.json({
      status: "healthy",
      stats,
      worker: worker
        ? worker.getStatus()
        : {
            running: false,
            activeWorkers: 0,
            concurrency: 0,
            pollIntervalMs: 0,
          },
      activeJobs: active.jobs,
      deadLetterJobs: deadLetter.jobs,
    });
  });

  router.get("/", (_req: Request, res: Response) => {
    const stats = jobQueue.getStats();
    const worker = jobQueue.getWorker();
    res.json({
      status: "healthy",
      stats,
      worker: worker
        ? worker.getStatus()
        : {
            running: false,
            activeWorkers: 0,
            concurrency: 0,
            pollIntervalMs: 0,
          },
    });
  });

  /**
   * @openapi
   * /api/admin/queue/jobs:
   *   get:
   *     summary: List background jobs in queue
   *     description: Query jobs filtered by status (queued, active, completed, failed, dead_letter) or taskId with pagination.
   *     tags: [Admin]
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [queued, active, completed, failed, dead_letter]
   *         description: Filter jobs by status
   *       - in: query
   *         name: taskId
   *         schema: { type: string }
   *         description: Filter jobs by associated task ID
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: pageSize
   *         schema: { type: integer, default: 50 }
   *     responses:
   *       200:
   *         description: List of jobs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 jobs:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/QueueJob'
   *                 total: { type: integer }
   *                 page: { type: integer }
   *                 pageSize: { type: integer }
   */
  router.get("/jobs", (req: Request, res: Response) => {
    const status = req.query.status as JobStatus | undefined;
    const taskId = req.query.taskId as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 50;

    const result = jobQueue.listJobs({ status, taskId, page, pageSize });
    res.json(result);
  });

  /**
   * @openapi
   * /api/admin/queue/dead-letter:
   *   get:
   *     summary: List dead-letter jobs
   *     description: Retrieves jobs that permanently failed after exhausting maximum retry attempts.
   *     tags: [Admin]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: pageSize
   *         schema: { type: integer, default: 50 }
   *     responses:
   *       200:
   *         description: List of dead-letter jobs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 jobs:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/QueueJob'
   *                 total: { type: integer }
   *                 page: { type: integer }
   *                 pageSize: { type: integer }
   */
  router.get("/dead-letter", (req: Request, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 50;

    const result = jobQueue.getDeadLetterJobs(page, pageSize);
    res.json(result);
  });

  /**
   * @openapi
   * /api/admin/queue/retry/{id}:
   *   post:
   *     summary: Retry a dead-letter job
   *     description: Resets attempt count and moves a dead-letter job back to queued status for worker processing.
   *     tags: [Admin]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *         description: Unique Job ID
   *         example: "job_98fe76dc54ba"
   *     responses:
   *       200:
   *         description: Job moved back to queue for retry
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean, example: true }
   *                 message: { type: string, example: "Job job_98fe76dc54ba moved to pending for retry" }
   *       404:
   *         description: Job not found or not in dead-letter state
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundError'
   */
  router.post("/retry/:id", (req: Request, res: Response) => {
    const jobId = req.params.id;
    const success = jobQueue.retryDeadLetter(jobId);

    if (!success) {
      res.status(404).json({ error: `Dead-letter job ${jobId} not found or not in dead-letter status` });
      return;
    }

    res.json({ success: true, message: `Job ${jobId} moved to pending for retry` });
  });

  return router;
}
