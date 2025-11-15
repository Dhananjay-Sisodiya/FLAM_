import { fork } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

let workerProcesses = [];

// Resolve absolute path to worker file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, "workerProcessor.js");

export const startWorker = (count = 1) => {
    console.log(`Starting ${count} worker processes...`);

    // Check file exists
    if (!fs.existsSync(workerPath)) {
        console.error("ERROR: workerProcessor.js NOT FOUND at:", workerPath);
        return;
    }

    console.log("Using worker file:", workerPath);

    for (let i = 0; i < count; i++) {
        const worker = fork(workerPath, {
            stdio: ["inherit", "inherit", "inherit", "ipc"]
        });

        workerProcesses.push(worker);

        console.log(`Worker ${i + 1} started with PID: ${worker.pid}`);

        worker.on("exit", (code) => {
            console.log(`Worker with PID: ${worker.pid} exited with code ${code}`);
            workerProcesses = workerProcesses.filter(w => w.pid !== worker.pid);
        });
    }
};

export const stopWorker = () => {
    console.log("Stopping all worker processes...");

    workerProcesses.forEach(worker => {
        worker.send({ type: "shutdown" });
    });

    workerProcesses = [];
};

export const getRunningWorkerCount = () => {
    return workerProcesses.length;
};
