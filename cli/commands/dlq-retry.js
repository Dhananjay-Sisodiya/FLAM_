import * as dlqRepo from "../../db/repositories/dlqRepo.js";

export const dlqRetryCommand = (id) => {
  const job = dlqRepo.retryJob(id);

  if (!job) {
    return console.log(`❌ Job ${id} not found in DLQ.`);
  }

  console.log(`🔁 Job ${id} moved back to queue.`);
};
