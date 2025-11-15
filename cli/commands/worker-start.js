import { startWorker } from "../../core/workerManager.js";

// Commander passes options object as the first param when there are only options
export const workerStartCommand = (opts) => {
    const numWorkers = parseInt(opts?.count, 10) || 1;
    startWorker(numWorkers);
    console.log(`${numWorkers} worker(s) started.`);
};