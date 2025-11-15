import fs from "fs";
import path from "path";
import fsExt from "fs-ext";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// base directory for data files
const basePath = path.resolve(__dirname, "..", "db", "data");

// ensure data dir exists
if (!fs.existsSync(basePath)) {
  fs.mkdirSync(basePath, { recursive: true });
}

// default files
const DEFAULTS = {
  "queue.json": { jobs: [] },
  "dlq.json": { dlq: [] },
  "config.json": { max_retries: 3, backoff_base: 2, worker_idle_delay: 1000 }
};

// ensure default files exist
Object.keys(DEFAULTS).forEach((f) => {
  const p = path.join(basePath, f);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(DEFAULTS[f], null, 2));
  }
});

/**
 * withLock(fileName, callback)
 * Acquire exclusive lock on the given file, parse JSON into an object,
 * call `callback(data, filePath)` while lock is held, then write data back
 * (in case it was mutated) and return the callback result.
 */
export function withLock(fileName, callback) {
  if (fileName.includes("/") || fileName.includes("\\")) {
    throw new Error(`withLock must receive only a filename, not a path. Got: ${fileName}`);
  }

  const filePath = path.join(basePath, fileName);

  // ensure the file exists
  if (!fs.existsSync(filePath)) {
    const def = DEFAULTS[fileName] || {};
    fs.writeFileSync(filePath, JSON.stringify(def, null, 2));
  }

  const fd = fs.openSync(filePath, "r+");
  try {
    fsExt.flockSync(fd, "ex"); // exclusive lock

    // read current content from path
    const raw = fs.readFileSync(filePath, "utf8");
    let data = {};
    try {
      data = raw && raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      // if file corrupted, reinitialize to default
      data = DEFAULTS[fileName] || {};
    }

    // call the callback with data and filePath; callback should mutate `data` if it wants changes
    const result = callback(data, filePath);

    // write back the (possibly mutated) data
    try {
      fs.ftruncateSync(fd, 0);
      fs.writeSync(fd, JSON.stringify(data, null, 2), 0, "utf8");
    } catch (err) {
      throw err;
    }

    return result;
  } finally {
    try { fsExt.flockSync(fd, "un"); } catch (e) { /* ignore */ }
    try { fs.closeSync(fd); } catch (e) { /* ignore */ }
  }
}

/**
 * Convenience readJSON/writeJSON that operate by acquiring their own lock.
 * Prefer using withLock() to perform atomic read-modify-write sequences.
 */
export function readJSON(fileName) {
  return withLock(fileName, (data) => data);
}

export function writeJSON(fileName, newData) {
  return withLock(fileName, (data) => {
    // replace data content
    Object.keys(data).forEach(k => delete data[k]);
    Object.assign(data, newData);
    return true;
  });
}