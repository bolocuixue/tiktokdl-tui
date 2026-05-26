import os from "node:os";
import path from "node:path";

export const APP_NAME = "tiktokdl-tui";
export const APP_ROOT = path.join(os.homedir(), ".tiktokdl-tui");
export const DOWNLOAD_ROOT = path.join(APP_ROOT, "downloads");
export const TASK_ROOT = path.join(APP_ROOT, "tasks");
export const LOG_ROOT = path.join(APP_ROOT, "logs");
export const DEFAULT_CONCURRENCY = 4;
export const MAX_CONCURRENCY = 10;
export const DEFAULT_RETRIES = 3;
