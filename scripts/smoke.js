// ESM script to verify main flows: enqueue, workers, retries, DLQ, delayed jobs
import * as workerManager from "../core/workerManager.js";
import * as queueManager from "../core/queueManager.js";
import * as jobRepo from "../db/repositories/jobRepo.js";
import * as dlqRepo from "../db/repositories/dlqRepo.js";
import * as configRepo from "../db/repositories/configRepo.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(predicate, { timeoutMs = 15000, intervalMs = 200, label = "condition" } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await sleep(intervalMs);
  }
  throw new Error(`Timeout waiting for ${label} after ${timeoutMs}ms`);
}

async function main() {
  const ts = Date.now();
  const ids = {
    ok1: `smk-${ts}-ok1`,
    ok2: `smk-${ts}-ok2`,
    bad: `smk-${ts}-bad1`,
    delayed: `smk-${ts}-delay`,
  };

  console.log("\n=== Smoke Test: queuectl core flows ===\n");

  // Fast polling and quick retries to keep test short
  configRepo.set("worker_idle_delay", 200);
  configRepo.set("max_retries", 2);
  configRepo.set("backoff_base", 1); // 1s per retry

  // Enqueue jobs
  queueManager.enqueue({ id: ids.ok1, command: "echo ok1" });
  queueManager.enqueue({ id: ids.ok2, command: "echo ok2" });
  queueManager.enqueue({ id: ids.bad, command: "definitelynotacommand_xyz" });
  queueManager.enqueue({ id: ids.delayed, command: "echo delayed", run_at: Date.now() + 1500 });

  console.log("Enqueued jobs:", ids);

  // Start workers
  workerManager.startWorker(2);

  // Wait for ok jobs to complete
  await waitFor(
    () => jobRepo.getJobById(ids.ok1)?.state === "completed",
    { label: `${ids.ok1} completed`, timeoutMs: 10000 }
  );
  await waitFor(
    () => jobRepo.getJobById(ids.ok2)?.state === "completed",
    { label: `${ids.ok2} completed`, timeoutMs: 10000 }
  );

  // Wait for delayed to complete
  await waitFor(
    () => jobRepo.getJobById(ids.delayed)?.state === "completed",
    { label: `${ids.delayed} completed`, timeoutMs: 15000 }
  );

  // Wait for bad job to hit DLQ
  await waitFor(
    () => !!dlqRepo.getDLQById(ids.bad),
    { label: `${ids.bad} in DLQ`, timeoutMs: 15000 }
  );

  // Stop workers
  workerManager.stopWorker();

  // Summaries
  const ok1 = jobRepo.getJobById(ids.ok1);
  const ok2 = jobRepo.getJobById(ids.ok2);
  const delayed = jobRepo.getJobById(ids.delayed);
  const badDLQ = dlqRepo.getDLQById(ids.bad);

  console.log("\n=== Results ===");
  console.log("ok1:", { id: ok1?.id, state: ok1?.state });
  console.log("ok2:", { id: ok2?.id, state: ok2?.state });
  console.log("delayed:", { id: delayed?.id, state: delayed?.state });
  console.log("DLQ entry for bad:", badDLQ);

  console.log("\nSmoke test PASSED\n");
}

main().catch((err) => {
  console.error("Smoke test FAILED:", err.message);
  try { workerManager.stopWorker(); } catch {}
  process.exit(1);
});
