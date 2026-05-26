import path from "node:path";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { APP_ROOT, DOWNLOAD_ROOT, LOG_ROOT, TASK_ROOT } from "./config.js";

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function ensureAppDirs() {
  await ensureDir(APP_ROOT);
  await ensureDir(DOWNLOAD_ROOT);
  await ensureDir(TASK_ROOT);
  await ensureDir(LOG_ROOT);
}

export async function saveTaskSnapshot(taskId, snapshot) {
  await ensureDir(TASK_ROOT);
  const filePath = path.join(TASK_ROOT, `${taskId}.json`);
  await writeFile(filePath, JSON.stringify(snapshot, null, 2));
  return filePath;
}

export async function listTaskSnapshots() {
  await ensureDir(TASK_ROOT);
  const names = await readdir(TASK_ROOT);
  const results = [];
  for (const name of names) {
    if (!name.endsWith(".json")) {
      continue;
    }
    const fullPath = path.join(TASK_ROOT, name);
    try {
      const content = JSON.parse(await readFile(fullPath, "utf8"));
      const info = await stat(fullPath);
      results.push({
        filePath: fullPath,
        updatedAt: info.mtime.toISOString(),
        ...content
      });
    } catch {
      // ignore broken snapshot
    }
  }
  results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return results;
}

export async function listFailureLogs() {
  const root = DOWNLOAD_ROOT;
  const results = [];

  async function walk(dir) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name === "failures.log") {
        const info = await stat(fullPath);
        results.push({
          filePath: fullPath,
          size: info.size,
          updatedAt: info.mtime.toISOString()
        });
      }
    }
  }

  await walk(root);
  results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return results;
}

export async function readFailureLog(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
