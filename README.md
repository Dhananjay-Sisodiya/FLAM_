<div align="center">

# queuectl – File‑Backed Job Queue

Small, atomic, file-based job queue with retry + DLQ handling and a simple CLI.

</div>

## Contents
1. Overview  
2. Features  
3. Installation & Run  
4. Data Model  
5. Job Lifecycle  
6. Retry & Backoff  
7. Dead Letter Queue (DLQ)  
8. Configuration  
9. Commands (with examples)  
10. Example Session  
11. Troubleshooting  

---
## 1. Overview
`queuectl` is a lightweight queue that stores state in JSON files (`db/data/*.json`). Multiple worker processes coordinate safely using advisory file locks so only one worker claims a job at a time.

Use it to enqueue shell commands, run workers, inspect state, and manage failed jobs.

---
## 2. Features
- Atomic job claiming (no duplicate processing)
- Delayed jobs (`run_at` epoch ms)
- Exponential backoff retries
- Dead Letter Queue after max retries
- Multiple workers via child processes
- Configurable polling delay & retry parameters
- Human-friendly CLI help with examples

---
## 3. Installation & Run
Clone the repo and install dependencies:
```bash
git clone https://github.com/Dhananjay-Sisodiya/FLAM_.git
cd FLAM
npm install
```
Use the CLI directly (bin is declared in `package.json`):
```bash
queuectl --help
```
If `queuectl` isn’t found, add a local link:
```bash
npm link
```

---
## 4. Data Model
### Job (queue.json `jobs[]`)
| Field | Description |
|-------|-------------|
| id | Unique job identifier you supply |
| command | Shell command executed |
| state | `pending` | `processing` | `completed` | `failed` |
| attempts | Number of attempts already made |
| max_retries | Cap before DLQ move |
| run_at | Epoch ms when job becomes runnable |
| created_at | Creation timestamp (ms) |
| updated_at | Last mutation timestamp (ms) |
| processing_started_at | Timestamp when state changed to processing |
| worker_id | Worker that claimed it |
| last_error | Last error message (if any) |

### DLQ (dlq.json `dlq[]`)
| Field | Description |
|-------|-------------|
| id | Original job id |
| command | Original command |
| attempts | Total attempts made |
| error | Final error message |
| failed_at | Timestamp moved to DLQ |

### Config (config.json `config[]`)
Key/value pairs: `max_retries`, `backoff_base`, `worker_idle_delay`.

---
## 5. Job Lifecycle
1. Enqueue → job stored with `state=pending` and `run_at` (now or future).  
2. Worker polls → first pending job with `run_at <= now` is claimed atomically, moved to `processing`.  
3. Execution → command runs.  
4. Success → `state=completed`.  
5. Failure → attempts increment; either rescheduled (backoff) or moved to DLQ if limit exceeded.  

---
## 6. Retry & Backoff
Formula: `delay_seconds = backoff_base ^ attempts` (attempts after increment).  
Rescheduled job: `state=pending`, `run_at = now + delay_ms`.  
Default values: `max_retries=3`, `backoff_base=2`.

Example failure log:
```
bad1 failed attempt 1 → retry in 2s
bad1 failed attempt 2 → retry in 4s
bad1 moved to DLQ
```

---
## 7. Dead Letter Queue (DLQ)
Jobs exceeding `max_retries` are removed from the main queue and appended to `dlq.json`.  
You can retry them back into the main queue via `dlq-retry <id>` (attempts reset to 0).

---
## 8. Configuration
Set via CLI; values persisted in `config.json`.
| Key | Meaning | Default |
|-----|---------|---------|
| max_retries | Attempts before DLQ | 3 |
| backoff_base | Exponential base | 2 |
| worker_idle_delay | Poll interval ms | 2000 |

Examples:
```bash
queuectl config-set max_retries 5
queuectl config-set backoff_base 3
queuectl config-set worker_idle_delay 500
```

---
## 9. Commands
Run `queuectl <command> --help` for inline help.

### enqueue
Add a job (JSON string). Optional `run_at` for future execution.
```bash
queuectl enqueue '{"id":"p1","command":"echo hi"}'
queuectl enqueue '{"id":"delayed","command":"echo later","run_at":'$(($(date +%s000)+5000))'}'
```
Output:
```
Job enqueued with ID: p1
```

### worker-start / worker-stop
Start or stop worker processes.
```bash
queuectl worker-start --count 2
queuectl worker-stop
```
Sample output (truncated):
```
Starting 2 worker processes...
Worker 1 started with PID: 12345
Worker 2 started with PID: 12346
[CLAIM] worker worker-12345 claimed job p1
Worker worker-12345 Processing job: p1
Worker worker-12345 Completed job: p1
Worker worker-12345 Job succeeded: p1
```

### list
List jobs filtered by state.
```bash
queuectl list --state pending
```
Output:
```json
[
  {
    "id": "p1",
    "command": "echo hi",
    "state": "pending",
    "run_at": 1763197724876,
    "attempts": 0
  }
]
```

### status
Shows counts of each state + active worker processes.
```bash
queuectl status
```
Example:
```
📊 Queue Status:
{ activeWorkers: 2, pending: 0, processing: 0, completed: 3, failed: 0 }
```

### dlq-list / dlq-retry
Inspect and retry DLQ jobs.
```bash
queuectl dlq-list
queuectl dlq-retry bad1
```
Example DLQ entry:
```json
{
  "id": "bad1",
  "command": "wrongcmd",
  "attempts": 4,
  "error": "spawn wrongcmd ENOENT",
  "failed_at": 1763198000000
}
```

### config-get / config-set
Get or set configuration values.
```bash
queuectl config-get
queuectl config-get max_retries
queuectl config-set max_retries 5
```
Output:
```
⚙️ Config updated: max_retries = 5
```

---
## 10. Example Session
```bash
# QueueCTL – Handy Commands for Testing

# Show global and per-command help
queuectl --help
queuectl enqueue --help
queuectl worker-start --help
queuectl list --help
queuectl status --help
queuectl dlq-list --help
queuectl dlq-retry --help
queuectl config-get --help
queuectl config-set --help

# Optional: run automated smoke test
npm run smoke

# Basic enqueue and processing
queuectl enqueue '{"id":"p1","command":"echo 1"}'
queuectl enqueue '{"id":"p2","command":"echo 2"}'
queuectl enqueue '{"id":"p3","command":"echo 3"}'

# Enqueue a failing job to exercise retries + DLQ
queuectl enqueue '{"id":"bad1","command":"definitelynotacommand_xyz"}'

# Enqueue a delayed job (~5s in the future)
queuectl enqueue '{"id":"delay1","command":"echo later","run_at":'$(($(date +%s000)+5000))'}'

# Inspect pending jobs
queuectl list --state pending

# Start workers (2 processes)
queuectl worker-start --count 2

# Observe status and lists (run a few times)
queuectl status
queuectl list --state processing
queuectl list --state completed
queuectl dlq-list

# Retry a DLQ job by id (replace bad1 if different)
queuectl dlq-retry bad1

# Tweak configuration (polling + retries)
queuectl config-get
queuectl config-set worker_idle_delay 500
queuectl config-set max_retries 3
queuectl config-set backoff_base 2
queuectl config-get

# Far-future job (should remain pending)
queuectl enqueue '{"id":"future1","command":"echo later","run_at": 9999999999999}'
queuectl list --state pending

# Stop workers
queuectl worker-stop
```

