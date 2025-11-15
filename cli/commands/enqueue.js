import { enqueue } from "../../core/queueManager.js";

export const enqueueCommand=(jobData)=>{
    try {
    const job=JSON.parse(jobData);
    enqueue(job);
    console.log("Job enqueued with ID:", job.id); 
    } catch (error) {
        console.log("Invalid job data:", error.message);
    }
}