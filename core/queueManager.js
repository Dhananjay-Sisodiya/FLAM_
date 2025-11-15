import * as jobRepo from '../db/repositories/jobRepo.js'
import * as dlqRepo from '../db/repositories/dlqRepo.js'
import * as configRepo from '../db/repositories/configRepo.js'

// enqueue a new job

export const enqueue = (job) => {
    const now = Date.now();
    // Respect provided run_at (ms since epoch); default to now
    const providedRunAt =
        job && job.run_at !== undefined
            ? Number(job.run_at)
            : job && job.runAt !== undefined
            ? Number(job.runAt)
            : NaN;

    const runAt = Number.isFinite(providedRunAt) ? providedRunAt : now;

    const newJob = {
        ...job,
        state: "pending",
        attempts: 0,
        max_retries: configRepo.get("max_retries") || 3,
        run_at: runAt,
        created_at: now,
        updated_at: now,
        last_error: null,
    }

    return jobRepo.createJob(newJob)

}

// fetch new runnable job

export const getNextRunnableJob = (workerId) => {
    return jobRepo.getNextRunnableJob(workerId)
}

// mark completed 
export const markCompleted = (id) => {
    return jobRepo.markCompleted(id);
};


export const handleFailure = (job, error) => {
    const maxRetries = configRepo.get("max_retries") || 3
    const backOffBase = configRepo.get("backoff_base") || 2

    // increment attempts atomically inside repo
    jobRepo.incrementAttempts(job.id)

    const updated = jobRepo.getJobById(job.id);
    console.log(updated )
    const attempts = updated.attempts

    if (attempts > maxRetries) {
        // Move to DLQ
        dlqRepo.moveToDLQ(updated, error)
        console.log(`${updated.id} moved to DLQ`)
        return { movedToDLQ: true }

    }

    const delaySeconds = Math.pow(backOffBase, attempts)
    const delayMs = delaySeconds * 1000
    const nextRunAt = Date.now() + delayMs

    // Reschedule back to pending with backoff
    jobRepo.rescheduleJob(job.id, nextRunAt)
    console.log(`${updated.id} failed attempt ${attempts} → retry in ${delaySeconds}s`)

    return {
        retryScheduled: true,
        nextRunAt,
        attempts
    }


}

export const processResult = (job, success, error) => {
    if (success) {
        return markCompleted(job.id)
    } else {
        return handleFailure(job, error)
    }
}