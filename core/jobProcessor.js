import {exec} from "child_process";
import util from 'util'

const execPromise = util.promisify(exec);


export const processJob=async(job)=>{
    try {
        const {stdout,stderr}=await execPromise(job.command);
        return {
            success:true,
            stdout,
            stderr:stderr||null
        }


    } catch (error) {
        return {
            success:false,
            error:error.message || 'Unknown execution error'
        }
    }
}