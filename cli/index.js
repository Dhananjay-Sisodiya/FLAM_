import { program } from "commander";

// COMMANDS
import { enqueueCommand } from "./commands/enqueue.js";
import { workerStartCommand } from "./commands/worker-start.js";
import { workerStopCommand } from "./commands/worker-stop.js";
import { listJobsCommand } from "./commands/list.js";
import { statusCommand } from "./commands/status.js";
import { dlqListCommand } from "./commands/dlq-list.js";
import { dlqRetryCommand } from "./commands/dlq-retry.js";
import { configGetCommand } from "./commands/config-get.js";
import { configSetCommand } from "./commands/config-set.js";


program
  .name("queuectl")
  .description("File-backed job queue CLI: enqueue, run workers, inspect, and manage DLQ.")
  .version("1.0.0")
  .showHelpAfterError(true)
  .showSuggestionAfterError(true);

program.addHelpText(
  "after",
  `
Examples:
  $ queuectl enqueue '{"id":"job1","command":"echo hi"}'
  $ queuectl enqueue '{"id":"future","command":"echo later","run_at":'$(($(date +%s000)+5000))'}'
  $ queuectl list --state pending
  $ queuectl worker-start --count 3
  $ queuectl status
  $ queuectl dlq-list
  $ queuectl dlq-retry some-id
  $ queuectl config-get
  $ queuectl config-set max_retries 3
  $ queuectl config-set backoff_base 2
  $ queuectl config-set worker_idle_delay 500
`
);

// ENQUEUE
program
  .command("enqueue <jobJson>")
  .description(
    "Enqueue a job. Provide JSON with at least id and command. Optional: run_at (ms epoch)."
  )
  .addHelpText(
    "after",
    `
Examples:
  $ queuectl enqueue '{"id":"p1","command":"echo 1"}'
  $ queuectl enqueue '{"id":"delayed","command":"echo later","run_at":'$(($(date +%s000)+10000))'}'
Notes:
  - run_at must be milliseconds since epoch. If omitted, defaults to now.
  - Escape quotes properly in your shell (use single quotes outside, double inside).
`
  )
  .action(enqueueCommand);

// WORKERS
program
  .command("worker-start")
  .option("--count <n>", "Number of workers", "1")
  .description("Start N worker processes that claim and run jobs.")
  .addHelpText(
    "after",
    `
Example:
  $ queuectl worker-start --count 4
Notes:
  - Workers poll every worker_idle_delay ms (configurable).
`
  )
  .action(workerStartCommand);

program
  .command("worker-stop")
  .description("Stop all workers")
  .action(workerStopCommand);

// LIST JOBS
program
  .command("list")
  .option(
    "--state <state>",
    "Filter by state [pending|processing|completed|failed]"
  )
  .description("List jobs in a given state.")
  .addHelpText(
    "after",
    `
Examples:
  $ queuectl list --state pending
  $ queuectl list --state processing
`
  )
  .action(listJobsCommand);

// STATUS
program
  .command("status")
  .description("Show counts for workers and job states.")
  .action(statusCommand);

// DLQ
program
  .command("dlq-list")
  .description("List jobs in the dead-letter queue (DLQ).")
  .action(dlqListCommand);

program
  .command("dlq-retry <id>")
  .description("Retry a job from the DLQ by ID (moves to pending).")
  .addHelpText(
    "after",
    `
Example:
  $ queuectl dlq-retry failing-job-123
`
  )
  .action(dlqRetryCommand);

// CONFIG
program
  .command("config-get [key]")
  .description("Get one config value or all.")
  .addHelpText(
    "after",
    `
Examples:
  $ queuectl config-get
  $ queuectl config-get max_retries
Known keys:
  - max_retries: number of retries before DLQ (default 3)
  - backoff_base: exponential base for retries (default 2)
  - worker_idle_delay: ms between worker polls (default 2000)
`
  )
  .action(configGetCommand);

program
  .command("config-set <key> <value>")
  .description("Set a configuration key to a value.")
  .addHelpText(
    "after",
    `
Examples:
  $ queuectl config-set max_retries 5
  $ queuectl config-set backoff_base 2
  $ queuectl config-set worker_idle_delay 500
`
  )
  .action(configSetCommand);

program.parse(process.argv);
