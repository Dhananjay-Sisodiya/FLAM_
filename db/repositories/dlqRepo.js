import { withLock } from "../../utils/fileStorage.js";

const DLQ_FILE = "dlq.json";
const QUEUE_FILE = "queue.json";

// Move a job object to DLQ and remove it from the queue
export const moveToDLQ = (jobObj, error) => {
    let moved = null;

    // Remove from queue first
    withLock(QUEUE_FILE, (qdata) => {
        qdata.jobs = qdata.jobs || [];
        const idx = qdata.jobs.findIndex((j) => j.id === jobObj.id);
        if (idx !== -1) {
            moved = qdata.jobs.splice(idx, 1)[0];
        }
        return qdata;
    });

    if (!moved) {
        // nothing to move
        return null;
    }

    // Add to DLQ
    withLock(DLQ_FILE, (ddata) => {
        ddata.dlq = ddata.dlq || [];
        ddata.dlq.push({
            id: moved.id,
            command: moved.command,
            attempts: moved.attempts || 0,
            last_error: error,
            failed_at: Date.now(),
        });
        return ddata;
    });

    return moved;
};

export const listDLQJobs = () => {
    return withLock(DLQ_FILE, (ddata) => ddata.dlq || []);
};

export const getDLQById = (id) => {
    return withLock(DLQ_FILE, (ddata) => {
        ddata.dlq = ddata.dlq || [];
        return ddata.dlq.find((j) => j.id === id) || null;
    });
};

export const deleteDLQById = (id) => {
    return withLock(DLQ_FILE, (ddata) => {
        ddata.dlq = (ddata.dlq || []).filter((j) => j.id !== id);
        return true;
    });
};

export const retryJob = (id) => {
    let jobToRetry = null;

    // remove from DLQ
    withLock(DLQ_FILE, (ddata) => {
        ddata.dlq = ddata.dlq || [];
        const idx = ddata.dlq.findIndex((j) => j.id === id);
        if (idx !== -1) {
            jobToRetry = ddata.dlq.splice(idx, 1)[0];
        }
        return ddata;
    });

    if (!jobToRetry) return null;

    const newJob = {
        id: jobToRetry.id,
        command: jobToRetry.command,
        state: "pending",
        attempts: 0,
        max_retries: jobToRetry.max_retries || 3,
        run_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
        last_error: null,
    };

    // push to queue
    withLock(QUEUE_FILE, (qdata) => {
        qdata.jobs = qdata.jobs || [];
        qdata.jobs.push(newJob);
        return qdata;
    });

    return newJob;
};




