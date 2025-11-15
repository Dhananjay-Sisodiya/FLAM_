
import { readJSON,writeJSON } from "../../utils/fileStorage.js";

// here we are reading the json file and writing to it to store the jobs

import { withLock } from "../../utils/fileStorage.js";

const QUEUE_FILE = "queue.json";

export const createJob = (job) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        data.jobs.push(job);
        // return the created job as result
        return job;
    });
};

export const getNextRunnableJob = (workerId) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        const now = Date.now();

        const idx = data.jobs.findIndex(
            (j) => j.state === "pending" && j.run_at <= now
        );

        if (idx === -1){
            console.log("No runnable job found");
            return null;
        } 

        const job = data.jobs[idx];
        job.state = "processing";
        job.worker_id = workerId;
        job.updated_at = now;
        job.processing_started_at = now;

        // Log the claim to aid observability of which worker took which job
        try {
            console.log(`[CLAIM] worker ${workerId} claimed job ${job.id}`);
        } catch (_) {}

        return job;
    });
};

export const markProcessing = (id) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        const now = Date.now();
        const job = data.jobs.find((j) => j.id === id);
        if (!job) return null;
        job.state = "processing";
        job.updated_at = now;
        job.processing_started_at = now;
        return job;
    });
};

export const markCompleted = (id) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        const now = Date.now();
        const job = data.jobs.find((j) => j.id === id);
        if (!job) return null;
        job.state = "completed";
        job.updated_at = now;
        return job;
    });
};

export const markFailed = (id, error) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        const job = data.jobs.find((j) => j.id === id);
        if (!job) return null;
        job.state = "failed";
        job.last_error = error;
        job.updated_at = Date.now();
        return job;
    });
};

export const incrementAttempts = (id) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        const job = data.jobs.find((j) => j.id === id);
        if (!job) return null;
        job.attempts = (job.attempts || 0) + 1;
        job.updated_at = Date.now();
        return job;
    });
};

export const rescheduleJob = (id, runAt) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        const job = data.jobs.find((j) => j.id === id);
        if (!job) return null;
        job.state = "pending";
        job.run_at = runAt;
        job.updated_at = Date.now();
        return job;
    });
};

export const getJobById = (id) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        return data.jobs.find((j) => j.id === id) || null;
    });
};

export const listByState = (state) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        return data.jobs.filter((j) => j.state === state);
    });
};

// Clean up stale processing jobs (jobs stuck in processing state)
export const cleanupStaleJobs = (staleTimeoutMs = 300000) => {
    return withLock(QUEUE_FILE, (data) => {
        data.jobs = data.jobs || [];
        const now = Date.now();
        let cleanedCount = 0;

        data.jobs.forEach((job) => {
            if (
                job.state === "processing" &&
                job.processing_started_at &&
                now - job.processing_started_at > staleTimeoutMs
            ) {
                job.state = "pending";
                job.worker_id = null;
                job.processing_started_at = null;
                job.updated_at = now;
                cleanedCount++;
            }
        });

        return cleanedCount;
    });
};