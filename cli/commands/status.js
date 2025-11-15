import { getRunningWorkerCount } from "../../core/workerManager.js";
import * as jobRepo from "../../db/repositories/jobRepo.js";

export const statusCommand = () => {
  const activeWorkers = getRunningWorkerCount();
  const stats = {
    activeWorkers,
    pending: jobRepo.listByState("pending").length,
    processing: jobRepo.listByState("processing").length,
    completed: jobRepo.listByState("completed").length,
    failed: jobRepo.listByState("failed").length,
  };

  console.log("📊 Queue Status:");
  console.log(stats);
};
