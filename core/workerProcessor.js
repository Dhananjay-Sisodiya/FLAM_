import { startWorker } from "./worker.js";

// Generate unique worker ID
const workerId = `worker-${process.pid}`;

// Graceful shutdown listener
process.on("message", (msg) => {
  if (msg.type === "shutdown") {
    console.log(`Worker ${workerId} (PID: ${process.pid}) shutting down...`);
    process.exit(0);
  }
});

console.log(`Starting worker with ID: ${workerId}`);
// Start worker loop with ID
startWorker(workerId);
