<div align="center">

# 🚀 queuectl – File-Backed Job Queue System

A lightweight, production-grade **CLI-based background job queue** with atomic job claiming, exponential backoff retries, dead letter queue (DLQ) handling, and persistent file-based storage.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](./LICENSE)

</div>

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Installation & Setup](#installation--setup)
4. [Quick Start](#quick-start)
5. [Architecture Overview](#architecture-overview)
6. [Data Model](#data-model)
7. [Job Lifecycle](#job-lifecycle)
8. [Retry & Exponential Backoff](#retry--exponential-backoff)
9. [Dead Letter Queue (DLQ)](#dead-letter-queue-dlq)
10. [Configuration](#configuration)
11. [CLI Commands Reference](#cli-commands-reference)
12. [Usage Examples](#usage-examples)
13. [Testing & Validation](#testing--validation)
14. [Assumptions & Trade-offs](#assumptions--trade-offs)
15. [Troubleshooting](#troubleshooting)
16. [Future Enhancements](#future-enhancements)

---

## Overview

**queuectl** is a lightweight, file-backed job queue system designed for:

- 🔄 **Enqueuing and managing** background jobs
- 👷 **Running multiple worker processes** in parallel
- 🔁 **Automatic retries** with exponential backoff
- 💀 **Dead Letter Queue (DLQ)** for permanently failed jobs
- 💾 **Persistent storage** across restarts using JSON files
- 🎯 **Atomic job claiming** to prevent duplicate processing
- ⚙️ **Configurable parameters** for retry behavior and polling

The system uses **file-based locking** to ensure only one worker claims a job at a time, making it safe for multi-process concurrent access.

### Use Cases

- Long-running shell commands
- Scheduled background tasks
- Batch processing with retry logic
- Job monitoring and debugging

---

## Key Features

✅ **Atomic Job Claiming** – File locks ensure no duplicate processing  
✅ **Exponential Backoff** – Configurable retry delays  
✅ **Delayed Job Execution** – Schedule jobs for future execution (`run_at`)  
✅ **Dead Letter Queue** – Separate storage for permanently failed jobs  
✅ **Multi-Worker Support** – Run multiple workers via child processes  
✅ **Persistent Storage** – JSON files survive restarts  
✅ **Graceful Shutdown** – Workers finish current job before exiting  
✅ **Rich CLI Interface** – Full command-line management  
✅ **Configurable Parameters** – Adjust retry logic and polling behavior  
✅ **Job Status Tracking** – View queue states at any time  

---

## Installation & Setup

### Prerequisites

- **Node.js** 18.0 or higher
- **npm** 9.0 or higher

### Clone & Install

```bash
# Clone the repository
git clone https://github.com/Dhananjay-Sisodiya/FLAM_.git
cd FLAM

# Install dependencies
npm install

# (Optional) Link the CLI globally
npm link
```

### Verify Installation

```bash
queuectl --help
```

If `queuectl` is not found globally, you can use:

```bash
npx queuectl --help
# OR
node ./cli/index.js --help
```

---

## Quick Start

### 1. **Enqueue a Job**

```bash
queuectl enqueue '{"id":"job1","command":"echo Hello World"}'
```

**Expected Output:**
```
Job enqueued with ID: job1
```

### 2. **Start Workers**

```bash
queuectl worker-start --count 2
```

This starts 2 worker processes that begin polling for pending jobs.

### 3. **Check Status**

```bash
queuectl status
```

**Output:**
```
📊 Queue Status:
{ activeWorkers: 2, pending: 0, processing: 0, completed: 1, failed: 0 }
```

### 4. **Stop Workers**

```bash
queuectl worker-stop
```

That's it! Your job has been processed. See [CLI Commands](#cli-commands-reference) for more.

---

## Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Layer (cli/)                         │
│  Commands: enqueue, worker-start, status, list, dlq, etc   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Core Logic (core/)                         │
│  - queueManager: enqueue, claim, update state              │
│  - workerManager: spawn/stop workers                        │
│  - worker: poll loop for a single worker process           │
│  - jobProcessor: execute shell commands                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│          Data Repositories (db/repositories/)               │
│  - jobRepo: get/update jobs in queue.json                  │
│  - dlqRepo: manage dlq.json entries                        │
│  - configRepo: read/write config.json                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│            Persistence Layer (db/data/)                     │
│  - queue.json: main job queue                              │
│  - dlq.json: dead letter queue                             │
│  - config.json: configuration settings                     │
└─────────────────────────────────────────────────────────────┘
```

### Worker Process Flow

```
Worker Process
    │
    ├─ Poll queue every N ms (configurable)
    │
    ├─ Claim first pending job with run_at <= now
    │   (using file lock for atomicity)
    │
    ├─ Mark as "processing"
    │
    ├─ Execute job command
    │
    ├─ Success? → Mark "completed"
    │   Failure? → Increment attempts
    │       ├─ Exceeded max_retries? → Move to DLQ
    │       └─ Else? → Reschedule with backoff delay
    │
    └─ Repeat
```

### Concurrency Safety

- **File-level locks** (`fs-ext`) prevent race conditions
- Each job claim is atomic – only one worker can claim it
- Multiple workers can poll simultaneously without conflicts

---

## Data Model

### Job Record (queue.json)

```json
{
  "id": "unique-job-id",
  "command": "echo 'Hello World'",
  "state": "pending",
  "attempts": 0,
  "max_retries": 3,
  "run_at": 1700000000000,
  "created_at": 1699999900000,
  "updated_at": 1699999900000,
  "processing_started_at": null,
  "worker_id": null,
  "last_error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (supplied by caller) |
| `command` | string | Shell command to execute |
| `state` | enum | `pending` / `processing` / `completed` / `failed` |
| `attempts` | number | Number of execution attempts made |
| `max_retries` | number | Max retry attempts before DLQ |
| `run_at` | number | Epoch ms when job becomes eligible |
| `created_at` | number | Job creation timestamp |
| `updated_at` | number | Last update timestamp |
| `processing_started_at` | number | When state changed to processing |
| `worker_id` | string | ID of worker processing it |
| `last_error` | string | Error message from last attempt |

### DLQ Record (dlq.json)

```json
{
  "id": "job-id",
  "command": "command-string",
  "attempts": 4,
  "max_retries": 3,
  "error": "Command not found: xyz",
  "failed_at": 1700000100000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Original job ID |
| `command` | string | Command that failed |
| `attempts` | number | Total attempts made |
| `max_retries` | number | Retry limit |
| `error` | string | Final error message |
| `failed_at` | number | Timestamp of DLQ move |

### Configuration (config.json)

```json
{
  "max_retries": 3,
  "backoff_base": 2,
  "worker_idle_delay": 2000
}
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `max_retries` | number | 3 | Attempts before moving to DLQ |
| `backoff_base` | number | 2 | Exponential backoff base |
| `worker_idle_delay` | number | 2000 | Poll interval (ms) |

---

## Job Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                     ENQUEUE                                 │
│  Job created with state='pending', run_at=now or future    │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                 PENDING                                     │
│  Waiting for:                                               │
│  1. run_at timestamp to pass                                │
│  2. Worker to claim it                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                PROCESSING                                   │
│  Worker claimed and executing the command                   │
└──────────┬──────────────────────────────┬────────────────────┘
           │                              │
           │                              │
    ✓ Exit Code 0             ✗ Exit Code ≠ 0
           │                              │
           ▼                              ▼
    ┌─────────────────┐        ┌────────────────────┐
    │   COMPLETED     │        │     FAILED         │
    │  Job succeeded  │        │  Increment attempts │
    │   (end state)   │        │   & retry_at++     │
    └─────────────────┘        └─────┬──────────────┘
                                     │
                            ┌────────▼─────────┐
                            │ Attempts <=      │
                            │ max_retries?     │
                            └────────┬─────────┘
                                  /  \
                               YES/    \NO
                               /        \
                    ┌─────────▼─┐    ┌──▼──────────┐
                    │  PENDING  │    │  DEAD LETTER│
                    │ Reschedule│    │    QUEUE    │
                    │ w/ backoff│    │ (final fail)│
                    └───────────┘    └─────────────┘
```

### State Transitions

| From | To | Trigger | Notes |
|------|----|---------|----|
| `pending` | `processing` | Worker claims | Uses file lock |
| `processing` | `completed` | Command succeeds (exit 0) | Job done |
| `processing` | `pending` | Command fails + retries left | Backoff applied |
| `processing` | DLQ | Command fails + max retries exceeded | Final failure |

---

## Retry & Exponential Backoff

### Backoff Formula

$$\text{delay\_seconds} = \text{backoff\_base}^{\text{attempts}}$$

### Example (default: base=2, max_retries=3)

```
Attempt 1 fails  → delay = 2^1 = 2 seconds  → run_at += 2000ms
Attempt 2 fails  → delay = 2^2 = 4 seconds  → run_at += 4000ms
Attempt 3 fails  → delay = 2^3 = 8 seconds  → run_at += 8000ms
Attempt 4 fails  → max_retries exceeded     → Move to DLQ
```

### Configuration

```bash
# Change backoff base to 3
queuectl config-set backoff_base 3

# Change max retries to 5
queuectl config-set max_retries 5
```

### Total Wait Time (base=2, max_retries=3)

$$\text{Total} = 2 + 4 + 8 = 14 \text{ seconds}$$

---

## Dead Letter Queue (DLQ)

### What is the DLQ?

The **Dead Letter Queue** is a separate storage for jobs that have exhausted all retry attempts. These are permanently failed jobs that require manual intervention.

### Moving to DLQ

A job moves to DLQ when:
1. Job execution fails (non-zero exit code)
2. Attempts have been incremented
3. `attempts > max_retries`

### Inspecting DLQ

```bash
queuectl dlq-list
```

**Output:**
```json
[
  {
    "id": "bad-cmd",
    "command": "nonexistent_command",
    "attempts": 4,
    "max_retries": 3,
    "error": "spawn nonexistent_command ENOENT",
    "failed_at": 1700000100000
  }
]
```

### Retrying a DLQ Job

To retry a DLQ job (move it back to pending with attempts reset):

```bash
queuectl dlq-retry bad-cmd
```

The job will:
- Be removed from DLQ
- Be re-enqueued with `state=pending`, `attempts=0`
- Begin processing again from the first attempt

---

## Configuration

### View Configuration

```bash
# Show all config
queuectl config-get

# Show specific key
queuectl config-get max_retries
```

### Update Configuration

```bash
queuectl config-set max_retries 5
queuectl config-set backoff_base 3
queuectl config-set worker_idle_delay 500
```

### Persistent Storage

All config changes are saved to `db/data/config.json` and survive restarts.

### Default Values

```json
{
  "max_retries": 3,
  "backoff_base": 2,
  "worker_idle_delay": 2000
}
```

---

## CLI Commands Reference

Run `queuectl --help` for global help, or `queuectl <command> --help` for command-specific help.

### `queuectl enqueue`

**Add a new job to the queue.**

```bash
# Basic usage
queuectl enqueue '{"id":"job1","command":"echo hello"}'

# With scheduled execution (5 seconds from now)
queuectl enqueue '{"id":"delayed","command":"echo later","run_at":'$(($(date +%s000)+5000))'}'
```

**Parameters:**
- `<json>` (required): Job object as JSON string
  - `id` (string): Unique job identifier
  - `command` (string): Shell command to execute
  - `run_at` (number, optional): Epoch ms; defaults to now

**Output:**
```
Job enqueued with ID: job1
```

---

### `queuectl worker-start`

**Start one or more worker processes.**

```bash
# Start 1 worker
queuectl worker-start

# Start 3 workers
queuectl worker-start --count 3
```

**Parameters:**
- `--count <n>` (optional, default=1): Number of worker processes

**Output:**
```
Starting 2 worker processes...
Worker 1 started with PID: 12345
Worker 2 started with PID: 12346
```

Workers run in the background and begin polling for jobs immediately.

---

### `queuectl worker-stop`

**Stop all running worker processes gracefully.**

```bash
queuectl worker-stop
```

Workers finish their current job before exiting.

**Output:**
```
Stopping all workers...
All workers stopped.
```

---

### `queuectl status`

**Display queue and worker status.**

```bash
queuectl status
```

**Output:**
```
📊 Queue Status:
{
  activeWorkers: 2,
  pending: 5,
  processing: 1,
  completed: 10,
  failed: 0
}
```

---

### `queuectl list`

**List jobs filtered by state.**

```bash
# List all pending jobs
queuectl list --state pending

# List all completed jobs
queuectl list --state completed

# List all jobs in processing
queuectl list --state processing
```

**Parameters:**
- `--state <state>` (required): One of: `pending`, `processing`, `completed`, `failed`

**Output:**
```json
[
  {
    "id": "job1",
    "command": "echo hello",
    "state": "pending",
    "attempts": 0,
    "run_at": 1700000000000,
    "created_at": 1699999900000
  }
]
```

---

### `queuectl dlq-list`

**View all jobs in the Dead Letter Queue.**

```bash
queuectl dlq-list
```

**Output:**
```json
[
  {
    "id": "bad-job",
    "command": "bad_command",
    "attempts": 4,
    "max_retries": 3,
    "error": "spawn bad_command ENOENT",
    "failed_at": 1700000100000
  }
]
```

---

### `queuectl dlq-retry`

**Retry a job from the Dead Letter Queue.**

```bash
queuectl dlq-retry bad-job
```

The job is moved back to pending with:
- `state = pending`
- `attempts = 0` (reset)
- `run_at = now`

**Output:**
```
Job 'bad-job' moved back to queue for retry.
```

---

### `queuectl config-get`

**View configuration.**

```bash
# View all config
queuectl config-get

# View specific key
queuectl config-get max_retries
```

**Output:**
```
max_retries: 3
backoff_base: 2
worker_idle_delay: 2000
```

---

### `queuectl config-set`

**Update configuration.**

```bash
queuectl config-set max_retries 5
queuectl config-set backoff_base 3
queuectl config-set worker_idle_delay 1000
```

**Output:**
```
⚙️ Config updated: max_retries = 5
```

---

## Usage Examples

### Example 1: Simple Job Processing

```bash
# Start 1 worker
queuectl worker-start

# Enqueue 3 simple jobs
queuectl enqueue '{"id":"job1","command":"echo Job 1 completed"}'
queuectl enqueue '{"id":"job2","command":"echo Job 2 completed"}'
queuectl enqueue '{"id":"job3","command":"echo Job 3 completed"}'

# Check status
queuectl status

# Expected output (after a moment):
# { activeWorkers: 1, pending: 0, processing: 0, completed: 3, failed: 0 }

# Stop worker
queuectl worker-stop
```

### Example 2: Job Retry & DLQ

```bash
# Set low retry count for demo
queuectl config-set max_retries 2

# Enqueue a job that will fail
queuectl enqueue '{"id":"fail1","command":"exit 1"}'

# Start workers
queuectl worker-start --count 1

# Wait ~10s (2 + 4 = 6s backoff + execution time)
sleep 12

# Check DLQ
queuectl dlq-list

# Expected output:
# [{ id: "fail1", command: "exit 1", attempts: 3, error: "...", ... }]

# Retry the job
queuectl dlq-retry fail1

# List jobs – should show fail1 back in queue
queuectl list --state pending

# Stop workers
queuectl worker-stop
```

### Example 3: Delayed Job Execution

```bash
# Enqueue job scheduled for 5 seconds in the future
FUTURE=$(($(date +%s000) + 5000))
queuectl enqueue '{"id":"delayed","command":"echo Delayed execution","run_at":'$FUTURE'}'

# Check status – job should be pending
queuectl status
queuectl list --state pending

# Start worker
queuectl worker-start

# Job will not execute for ~5 seconds
# After 5 seconds, check status again
sleep 6
queuectl status

# Expected: completed should increment
# { activeWorkers: 1, pending: 0, processing: 0, completed: 1, failed: 0 }

queuectl worker-stop
```

### Example 4: Multiple Workers

```bash
# Enqueue 10 jobs
for i in {1..10}; do
  queuectl enqueue '{"id":"job'$i'","command":"echo Job '$i'"}'
done

# Start 3 workers
queuectl worker-start --count 3

# Monitor processing
queuectl status
queuectl list --state processing
queuectl list --state completed

# Stop workers
queuectl worker-stop
```

### Example 5: Configuration & Custom Backoff

```bash
# Set custom retry and backoff parameters
queuectl config-set max_retries 5
queuectl config-set backoff_base 3

# Verify config
queuectl config-get

# Now failing jobs will retry with delays: 3, 9, 27, 81 seconds
```

---

## Testing & Validation

### Automated Smoke Test

Run the included smoke test to validate core flows:

```bash
npm run smoke
```

**What it tests:**
1. ✅ Basic job success
2. ✅ Job failure and retry
3. ✅ DLQ functionality
4. ✅ Delayed job execution
5. ✅ Multiple workers

**Expected output:**
```
=== Smoke Test: queuectl core flows ===
Enqueued jobs: { ok1: '...', ok2: '...', bad: '...', delayed: '...' }
[progress messages...]

=== Results ===
ok1: { id: '...', state: 'completed' }
ok2: { id: '...', state: 'completed' }
delayed: { id: '...', state: 'completed' }
DLQ entry for bad: { id: '...', attempts: 3, ... }

Smoke test PASSED
```

### Manual Testing Workflow

```bash
# 1. Clean slate
rm -f db/data/*.json
npm run smoke

# 2. Test individual commands
queuectl --help
queuectl enqueue --help
queuectl worker-start --help
queuectl status
queuectl list --state pending
queuectl dlq-list
queuectl config-get

# 3. Test edge cases
# - Multiple jobs with same ID (should reject duplicate)
# - Jobs with special characters in commands
# - Very large job payloads
# - Rapid start/stop of workers
```

### Test Scenarios

| Scenario | Command | Expected Result |
|----------|---------|-----------------|
| **Basic Success** | `enqueue → worker-start → wait → status` | Job in completed |
| **Retry & DLQ** | Enqueue failing job → wait → dlq-list | Job in DLQ after max_retries exceeded |
| **Delayed Execution** | Enqueue with `run_at` future → status | Job stays pending until run_at |
| **No Race Condition** | Multiple workers + single job | Only one worker claims it |
| **Graceful Shutdown** | worker-stop during processing | Current job finishes |
| **Config Persistence** | config-set → restart system → config-get | Values persist |

---

## Assumptions & Trade-offs

### Assumptions

1. **Single Machine**
   - All workers and queue data on one machine
   - File system is reliable (not distributed)

2. **Short-Lived Commands**
   - Jobs execute relatively quickly (seconds to minutes)
   - No built-in timeout (but can be added)

3. **Sequential Processing per Worker**
   - Each worker processes one job at a time
   - No parallel execution within a single worker

4. **File-Based Locking**
   - File locks (`fs-ext`) are sufficient for coordination
   - No external locks (etcd, Redis) needed

5. **JSON Storage**
   - Simple JSON files for persistence
   - No database migration complexity
   - Limited scalability for millions of jobs

### Trade-offs Made

| Trade-off | Choice | Reason |
|-----------|--------|--------|
| **Storage** | JSON files | Simplicity + no external dependencies |
| **Scaling** | Single machine | Meets requirements; can evolve to DB later |
| **Locking** | File-based | Lightweight; sufficient for single machine |
| **Concurrency** | Process-based workers | Easier than threads; Node.js child_process stable |
| **Persistence** | Synchronous writes | Simplicity; async writes complex in edge cases |
| **Timeouts** | Not implemented | Can add with `setTimeout` wrapper |
| **Metrics** | Minimal | Basic status command only |

### Future Improvements

- [ ] Add job timeout handling
- [ ] Implement priority queues
- [ ] Add persistent job output logging
- [ ] Metrics and statistics collection
- [ ] Web dashboard for monitoring
- [ ] Distributed locking (for multi-machine support)
- [ ] Database backend (SQLite, PostgreSQL)
- [ ] Job chaining/pipelines

---

## Project Structure

```
FLAM/
├── cli/
│   ├── bin/
│   │   └── queuectl                 # Executable entry point
│   ├── commands/
│   │   ├── config-get.js
│   │   ├── config-set.js
│   │   ├── dlq-list.js
│   │   ├── dlq-retry.js
│   │   ├── enqueue.js
│   │   ├── list.js
│   │   ├── status.js
│   │   ├── worker-start.js
│   │   └── worker-stop.js
│   ├── helpers/
│   │   └── output.js               # CLI formatting utilities
│   └── index.js                     # CLI router
├── core/
│   ├── jobProcessor.js             # Command execution
│   ├── queueManager.js             # Job enqueue/claim logic
│   ├── worker.js                   # Single worker loop
│   ├── workerManager.js            # Process spawning
│   └── workerProcessor.js          # Worker-specific state
├── db/
│   ├── data/
│   │   ├── queue.json              # Main job queue
│   │   ├── dlq.json                # Dead letter queue
│   │   └── config.json             # Configuration
│   └── repositories/
│       ├── configRepo.js
│       ├── dlqRepo.js
│       └── jobRepo.js
├── utils/
│   └── fileStorage.js              # File I/O and locking
├── scripts/
│   └── smoke.js                    # Automated test
├── package.json
└── README.md                        # This file
```

---

## Troubleshooting

### Issue: `queuectl: command not found`

**Solution:**
```bash
# Option 1: Link globally
npm link

# Option 2: Use npx
npx queuectl --help

# Option 3: Run directly
node ./cli/index.js --help
```

---

### Issue: Workers start but jobs don't process

**Possible causes & solutions:**

1. **Jobs not in queue**
   ```bash
   queuectl list --state pending
   # If empty, enqueue jobs first
   queuectl enqueue '{"id":"test","command":"echo test"}'
   ```

2. **run_at is in the future**
   ```bash
   queuectl list --state pending
   # Check run_at timestamp; should be <= current time
   ```

3. **worker_idle_delay too high**
   ```bash
   # Lower the polling interval
   queuectl config-set worker_idle_delay 500
   ```

4. **Check worker logs**
   ```bash
   queuectl status
   # Verify activeWorkers > 0
   ```

---

### Issue: Job data lost after restart

**Possible causes:**

1. **db/data/ directory deleted**
   - Ensure directory exists with proper JSON files
   - Run smoke test to reinitialize

2. **File permissions**
   ```bash
   ls -la db/data/
   chmod 644 db/data/*.json
   ```

---

### Issue: Duplicate job processing

**Should not happen with proper file locking. If observed:**

1. Check Node.js version (18+)
2. Verify `fs-ext` is installed: `npm ls fs-ext`
3. Check file system (must support advisory locks)

---

### Issue: DLQ job won't retry

**Solution:**
```bash
# Verify job is in DLQ
queuectl dlq-list

# Use exact ID from DLQ entry
queuectl dlq-retry <id>

# Verify it's back in queue
queuectl list --state pending
```

---

## Troubleshooting Commands

```bash
# View current queue state
queuectl list --state pending
queuectl list --state processing
queuectl list --state completed

# Reset to clean state (careful!)
rm -rf db/data/*.json

# Run smoke test
npm run smoke

# Check configuration
queuectl config-get

# View specific job
cat db/data/queue.json | jq '.[] | select(.id=="job1")'

# View DLQ
cat db/data/dlq.json

# Check worker processes
ps aux | grep "worker.js"
```

---

## Future Enhancements

### High Priority

- ✋ **Job Timeout** – Kill jobs that exceed time limit
- 📊 **Metrics & Stats** – Track execution times, success rates
- 📝 **Job Output Logging** – Store stdout/stderr per job
- 🎯 **Job Priority** – Process high-priority jobs first

### Medium Priority

- 🗓️ **Scheduled Jobs** – CRON-like scheduling
- 🔄 **Job Chaining** – Job A → Job B dependency
- 🌐 **Web Dashboard** – Monitor queue visually
- 🔔 **Webhooks** – Notify external services on completion

### Low Priority

- 🗄️ **Database Backend** – SQLite, PostgreSQL support
- 🌍 **Distributed Mode** – Multiple machines
- 📡 **Message Queue Integration** – RabbitMQ, Redis
- 🔐 **Authentication** – Secure API access

---

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Run smoke test
npm run smoke

# Run specific command
node cli/index.js enqueue '{"id":"test","command":"echo hello"}'

# Start dev mode with auto-reload (requires nodemon)
npm start
```

### Code Quality

- **No linting configured** – Format manually or add ESLint
- **No type checking** – Consider TypeScript for large projects
- **No unit tests** – Add Jest or Mocha as needed

---

## Contributing

This is a submission project. For production use or contributions:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## License

ISC

---

## Contact & Support

**Repository:** [github.com/Dhananjay-Sisodiya/FLAM_](https://github.com/Dhananjay-Sisodiya/FLAM_)

For issues, questions, or demo requests, please open a GitHub issue or contact the author.

---

<div align="center">

**Built with ❤️ for background job queue management**

</div>
