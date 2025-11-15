import { getNextRunnableJob, processResult } from './queueManager.js';
import { processJob } from "./jobProcessor.js";
import * as configRepo from "../db/repositories/configRepo.js";

// it will stop the code for given ms
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))



export const startWorker = async (workerId) => {
    const idleDelay = configRepo.get("worker_idle_delay") || 2000;
    console.log("Starting worker with ID:", workerId)
    const finalWorkerId = workerId || `worker-${process.pid}`;

    console.log(`Worker ${finalWorkerId} started with idle delay:`, idleDelay)

    while (true) {
        const job = await getNextRunnableJob(finalWorkerId);

        if (!job) {
            // no job worker should sleep
            // console.log(`Worker ${finalWorkerId} is idle, sleeping for ${idleDelay}ms`);
            await sleep(idleDelay);
            continue;
        }
        console.log(`Worker ${finalWorkerId} Processing job:`, job.id)

        const result = await processJob(job)

        await processResult(job, result.success, result.error)

        console.log(`Worker ${finalWorkerId} Completed job:`, job.id)

        if (result.success) {
            console.log(`Worker ${finalWorkerId} Job succeeded:`, job.id)
        } else {
            console.log(`Worker ${finalWorkerId} Job failed:`, job.id, "Error:", result.error)
        }
    }
}