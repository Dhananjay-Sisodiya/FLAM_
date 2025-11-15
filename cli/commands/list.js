import * as jobRepo from "../../db/repositories/jobRepo.js";

export const listJobsCommand = (options) => {
  const { state } = options;

  if (!state) {
    return console.log("❗ Please specify a state using --state <pending|processing|completed|failed>");
  }

  const jobs = jobRepo.listByState(state);
  console.log(jobs);
};
