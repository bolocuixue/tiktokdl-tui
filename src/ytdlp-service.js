import path from "node:path";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { DOWNLOAD_ROOT, DEFAULT_CONCURRENCY, DEFAULT_RETRIES, MAX_CONCURRENCY } from "./config.js";

const execFileAsync = promisify(execFile);

function sanitizeName(value) {
  return String(value ?? "")
    .replace(/[<>:\"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function currentDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeConcurrency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CONCURRENCY;
  }
  return Math.min(Math.floor(parsed), MAX_CONCURRENCY);
}

function normalizeRetries(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_RETRIES;
  }
  return Math.floor(parsed);
}

function normalizeContinue(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const lowered = String(value ?? "").trim().toLowerCase();
  if (!lowered) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(lowered)) {
    return false;
  }
  return true;
}

function accountUrl(username) {
  return `https://www.tiktok.com/@${username}`;
}

function downloadDirForUser(username, dateStamp = currentDateStamp()) {
  return path.join(DOWNLOAD_ROOT, "yt-dlp", sanitizeName(username), dateStamp);
}

function outputTemplate(downloadDir) {
  return path.join(downloadDir, "%(uploader_id,channel_id,uploader|unknown)s_%(id)s.%(ext)s");
}

function parseHumanSizeToBytes(value) {
  if (!value) {
    return null;
  }

  const match = String(value).trim().match(/^([\d.]+)\s*([KMGTP]?i?B)$/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = {
    B: 1,
    KIB: 1024,
    MIB: 1024 ** 2,
    GIB: 1024 ** 3,
    TIB: 1024 ** 4,
    KB: 1000,
    MB: 1000 ** 2,
    GB: 1000 ** 3,
    TB: 1000 ** 4
  };

  return Number.isFinite(amount) && multipliers[unit] ? Math.round(amount * multipliers[unit]) : null;
}

function parseEtaToSeconds(value) {
  if (!value) {
    return null;
  }

  const parts = String(value).trim().split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

function parseProgressLine(line) {
  const progressMatch = line.match(/\[download\]\s+([\d.]+)% of\s+(.+?) at\s+(.+?)\/s ETA\s+([0-9:]+)/i);
  if (progressMatch) {
    const percent = Number(progressMatch[1]);
    const totalBytes = parseHumanSizeToBytes(progressMatch[2]);
    const speedBytes = parseHumanSizeToBytes(progressMatch[3]);
    return {
      percent: Number.isFinite(percent) ? percent : null,
      totalBytes,
      downloadedBytes: totalBytes && Number.isFinite(percent) ? Math.round(totalBytes * percent / 100) : null,
      speedBytes,
      etaSeconds: parseEtaToSeconds(progressMatch[4])
    };
  }

  const completeMatch = line.match(/\[download\]\s+100% of\s+(.+?) in\s+([0-9:]+) at\s+(.+?)\/s/i);
  if (completeMatch) {
    const totalBytes = parseHumanSizeToBytes(completeMatch[1]);
    const speedBytes = parseHumanSizeToBytes(completeMatch[3]);
    return {
      percent: 100,
      totalBytes,
      downloadedBytes: totalBytes,
      speedBytes,
      etaSeconds: 0
    };
  }

  return null;
}

async function runJson(pythonCommand, args, maxBufferMb = 128) {
  const { stdout } = await execFileAsync(pythonCommand, ["-m", "yt_dlp", ...args], {
    maxBuffer: 1024 * 1024 * maxBufferMb
  });
  return JSON.parse(stdout);
}

async function runYtDlp(pythonCommand, args, maxBufferMb = 64) {
  return execFileAsync(pythonCommand, ["-m", "yt_dlp", ...args], {
    maxBuffer: 1024 * 1024 * maxBufferMb
  });
}

export async function listAccountVideos(pythonCommand, username) {
  const playlist = await runJson(pythonCommand, ["--flat-playlist", "-J", accountUrl(username)]);
  const entries = Array.isArray(playlist.entries) ? playlist.entries : [];

  return {
    source: "yt-dlp",
    username,
    playlistId: playlist.id ?? null,
    total: playlist.playlist_count ?? entries.length,
    items: entries.map((entry) => ({
      id: entry.id,
      title: entry.title ?? "",
      url: entry.url ?? `${accountUrl(username)}/video/${entry.id}`,
      uploader: entry.uploader ?? username,
      uploaderId: entry.uploader_id ?? null,
      duration: entry.duration ?? null,
      viewCount: entry.view_count ?? null
    }))
  };
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(workerId) {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index, workerId);
    }
  }

  const workerCount = Math.min(concurrency, Math.max(items.length, 1));
  await Promise.all(Array.from({ length: workerCount }, (_, index) => runWorker(index + 1)));
  return results;
}

async function downloadSingleVideo(pythonCommand, item, downloadDir, retriesUsed, continueUsed, hooks = {}) {
  await mkdir(downloadDir, { recursive: true });

  const args = [
    "--newline",
    "--print",
    "after_move:filepath",
    "--retries",
    String(retriesUsed),
    continueUsed ? "--continue" : "--no-continue",
    "-o",
    outputTemplate(downloadDir),
    item.url
  ];

  const child = spawn(pythonCommand, ["-m", "yt_dlp", ...args], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdoutBuffer = "";
  let stderrBuffer = "";
  const stdoutLines = [];

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString();
    const parts = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (trimmed) {
        stdoutLines.push(trimmed);
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk.toString();
    const parts = stderrBuffer.split(/\r?\n/);
    stderrBuffer = parts.pop() ?? "";
    for (const line of parts) {
      const progress = parseProgressLine(line);
      if (progress) {
        hooks.onProgress?.(progress);
      }
    }
  });

  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`yt-dlp exited ${code}`));
      }
    });
  });

  if (stdoutBuffer.trim()) {
    stdoutLines.push(stdoutBuffer.trim());
  }

  const filePath = stdoutLines.at(-1) ?? null;
  const fileInfo = filePath ? await stat(filePath) : null;

  return {
    ok: true,
    id: item.id,
    title: item.title,
    url: item.url,
    filePath,
    bytes: fileInfo?.size ?? null
  };
}

async function downloadItems(pythonCommand, username, listed, selected, options = {}, hooks = {}) {

  const concurrencyUsed = normalizeConcurrency(options.concurrency);
  const retriesUsed = normalizeRetries(options.retries);
  const continueUsed = normalizeContinue(options.continueDownload);
  const dateStamp = currentDateStamp();
  const downloadDir = downloadDirForUser(username, dateStamp);
  await mkdir(downloadDir, { recursive: true });

  const results = await mapConcurrent(selected, concurrencyUsed, async (item, index, workerId) => {
    const startedAt = Date.now();
    hooks.onTaskStart?.(item, index, workerId);
    try {
      const result = await downloadSingleVideo(
        pythonCommand,
        item,
        downloadDir,
        retriesUsed,
        continueUsed,
        {
          onProgress(progress) {
            hooks.onTaskProgress?.(item, progress, index, workerId);
          }
        }
      );
      const done = {
        ...result,
        durationMs: Date.now() - startedAt
      };
      hooks.onTaskSuccess?.(done, index, workerId);
      return done;
    } catch (error) {
      const failed = {
        ok: false,
        id: item.id,
        title: item.title,
        url: item.url,
        error: error.message,
        durationMs: Date.now() - startedAt
      };
      hooks.onTaskFailure?.(failed, index, workerId);
      return failed;
    }
  });

  const downloads = results.filter((entry) => entry.ok);
  const failures = results.filter((entry) => !entry.ok);
  const manifestPath = path.join(downloadDir, "manifest.json");
  const failureLogPath = path.join(downloadDir, "failures.log");

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        ok: failures.length === 0,
        source: "yt-dlp",
        username,
        total: listed.total,
        requestedDownloads: selected.length,
        concurrencyUsed,
        retriesUsed,
        continueUsed,
        dateStamp,
        generatedAt: new Date().toISOString(),
        downloads,
        failures
      },
      null,
      2
    )
  );

  if (failures.length > 0) {
    await writeFile(
      failureLogPath,
      `${failures.map((item) => JSON.stringify(item)).join("\n")}\n`,
      "utf8"
    );
  }

  return {
    source: "yt-dlp",
    username,
    total: listed.total,
    requestedDownloads: selected.length,
    concurrencyUsed,
    retriesUsed,
    continueUsed,
    dateStamp,
    items: listed.items,
    downloads,
    failures,
    downloadDir,
    manifestPath,
    failureLogPath
  };
}

export async function downloadAccountVideos(pythonCommand, username, options = {}, hooks = {}) {
  const listed = await listAccountVideos(pythonCommand, username);
  const selected =
    Number.isFinite(options.limit) && options.limit > 0
      ? listed.items.slice(0, options.limit)
      : listed.items;

  return downloadItems(pythonCommand, username, listed, selected, options, hooks);
}

export async function downloadSpecificVideos(pythonCommand, username, items, options = {}, hooks = {}) {
  const listed = {
    source: "yt-dlp",
    username,
    total: items.length,
    items
  };

  return downloadItems(pythonCommand, username, listed, items, options, hooks);
}
