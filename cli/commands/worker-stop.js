import { stopWorker } from "../../core/workerManager.js";

export const workerStopCommand = () => {

    stopWorker();
    console.log("All workers stopped.");
}