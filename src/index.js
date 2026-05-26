#!/usr/bin/env node
import blessed from "blessed";
import { spawn } from "node:child_process";
import { URL } from "node:url";
import { DEFAULT_CONCURRENCY, DEFAULT_RETRIES } from "./config.js";
import { doctor, detectPython, openPath } from "./runtime.js";
import { downloadAccountVideos, downloadSpecificVideos, listAccountVideos } from "./ytdlp-service.js";
import { ensureAppDirs, listFailureLogs, listTaskSnapshots, readFailureLog, saveTaskSnapshot } from "./storage.js";

const UI = {
  appTitle: "\u6296\u97f3/TikTok \u4e0b\u8f7d\u5de5\u5177",
  quitHint: "q: \u9000\u51fa  esc: \u8fd4\u56de",
  mainMenu: "\u4e3b\u83dc\u5355",
  menuDownloadAccount: "1. \u4e0b\u8f7d\u6574\u4e2a\u8d26\u53f7",
  menuManifest: "2. \u83b7\u53d6\u8d26\u53f7\u6e05\u5355",
  menuSingleVideo: "3. \u4e0b\u8f7d\u5355\u4e2a\u89c6\u9891",
  menuSnapshots: "4. \u6062\u590d / \u67e5\u770b\u4efb\u52a1\u5feb\u7167",
  menuFailures: "5. \u67e5\u770b\u5931\u8d25\u65e5\u5fd7",
  menuDoctor: "6. \u73af\u5883\u68c0\u67e5",
  menuService: "7. \u542f\u52a8\u672c\u5730\u670d\u52a1",
  menuExit: "0. \u9000\u51fa",
  username: "\u8d26\u53f7",
  limit: "\u6570\u91cf\u9650\u5236\uff08\u7559\u7a7a=\u5168\u90e8\uff09",
  concurrency: "\u5e76\u53d1\u6570",
  retries: "\u91cd\u8bd5\u6b21\u6570",
  continueDownload: "\u65ad\u70b9\u7eed\u4f20\uff08true/false\uff09",
  envCheck: "\u73af\u5883\u68c0\u67e5",
  envRunning: "\u6b63\u5728\u68c0\u67e5\u73af\u5883",
  envDone: "\u73af\u5883\u68c0\u67e5\u5b8c\u6210",
  manifestTitle: "\u6e05\u5355",
  manifestLoading: "\u6b63\u5728\u83b7\u53d6\u6e05\u5355",
  manifestHint: "\u6e05\u5355\u5df2\u52a0\u8f7d | d: \u4e0b\u8f7d\u8d26\u53f7  s: \u4e0b\u8f7d\u9009\u4e2d",
  snapshotsTitle: "\u4efb\u52a1\u5feb\u7167",
  snapshotsHint: "\u4efb\u52a1\u5feb\u7167 | r: \u91cd\u8dd1  f: \u91cd\u8dd1\u5931\u8d25\u9879  d: \u6253\u5f00\u76ee\u5f55  o: \u5feb\u7167  m: \u6e05\u5355\u8def\u5f84",
  noSnapshots: "\u6ca1\u6709\u4efb\u52a1\u5feb\u7167",
  failureLogsTitle: "\u5931\u8d25\u65e5\u5fd7",
  failureLogsHint: "\u5931\u8d25\u65e5\u5fd7 | enter/o: \u6253\u5f00\u9009\u4e2d\u65e5\u5fd7",
  noFailureLogs: "\u6ca1\u6709\u5931\u8d25\u65e5\u5fd7",
  failureLogContent: "\u5931\u8d25\u65e5\u5fd7\u5185\u5bb9",
  taskSnapshot: "\u4efb\u52a1\u5feb\u7167",
  manifestPath: "\u6e05\u5355\u8def\u5f84",
  downloadError: "\u4e0b\u8f7d\u9519\u8bef",
  manifestError: "\u6e05\u5355\u9519\u8bef",
  pythonNotFound: "\u672a\u627e\u5230 Python",
  summary: "\u603b\u89c8",
  workers: "Worker",
  events: "\u65e5\u5fd7",
  serviceTitle: "\u670d\u52a1",
  serviceAlreadyRunning: "\u670d\u52a1\u5df2\u7ecf\u5728\u8fd0\u884c",
  serviceStartAttempted: "\u670d\u52a1\u542f\u52a8\u5c1d\u8bd5\u5b8c\u6210",
  serviceStdout: "stdout",
  serviceStderr: "stderr",
  downloadFinished: "\u4e0b\u8f7d\u5b8c\u6210",
  downloadStatus: "\u6b63\u5728\u4e0b\u8f7d",
  completed: "\u5df2\u5b8c\u6210",
  failures: "\u5931\u8d25\u5217\u8868",
  openDirHint: "o: \u6253\u5f00\u76ee\u5f55",
  showFailuresHint: "f: \u67e5\u770b\u5931\u8d25",
  singleVideoTitle: "\u5355\u89c6\u9891\u4e0b\u8f7d",
  singleVideoUrl: "\u89c6\u9891\u94fe\u63a5",
  singleVideoName: "\u6807\u9898\uff08\u53ef\u7a7a\uff09",
  total: "\u603b\u6570",
  success: "\u6210\u529f",
  failed: "\u5931\u8d25",
  active: "\u6d3b\u8dc3",
  bytes: "\u5b57\u8282",
  speed: "\u901f\u5ea6",
  eta: "ETA",
  outputDir: "\u8f93\u51fa\u76ee\u5f55",
  taskStart: "\u5f00\u59cb",
  taskDone: "\u5b8c\u6210",
  taskFail: "\u5931\u8d25",
  generatedManifest: "\u6e05\u5355",
  downloads: "\u6210\u529f\u6570",
  failureLog: "\u5931\u8d25\u65e5\u5fd7",
  idle: "\u7a7a\u95f2",
  noVideo: "\u6ca1\u6709\u53ef\u7528\u89c6\u9891",
  startLocalService: "\u542f\u52a8\u672c\u5730\u670d\u52a1",
  installHintPrefix: "\u5b89\u88c5\u547d\u4ee4",
  appRoot: "\u5e94\u7528\u76ee\u5f55",
  requirementsPath: "\u4f9d\u8d56\u6587\u4ef6",
  platform: "\u5e73\u53f0",
  node: "Node",
  python: "Python",
  ytdlp: "yt-dlp"
};

await ensureAppDirs();

const screen = blessed.screen({
  smartCSR: true,
  title: "tiktokdl-tui",
  fullUnicode: true
});

const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: "100%",
  height: 3,
  content: ` ${UI.appTitle} `,
  style: {
    fg: "white",
    bg: "blue",
    bold: true
  }
});

const statusBar = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: "100%",
  height: 1,
  content: ` ${UI.quitHint} `,
  style: {
    fg: "black",
    bg: "white"
  }
});

const body = blessed.box({
  parent: screen,
  top: 3,
  bottom: 1,
  left: 0,
  width: "100%"
});

let viewStack = [];
let cachedPython = null;
let serverProcess = null;

function clearBody() {
  while (body.children.length > 0) {
    body.children[0].destroy();
  }
}

function setStatus(text) {
  statusBar.setContent(` ${text} `);
  screen.render();
}

function pushView(renderFn) {
  viewStack.push(renderFn);
  renderFn();
}

function replaceView(renderFn) {
  viewStack[viewStack.length - 1] = renderFn;
  renderFn();
}

function popView() {
  if (viewStack.length <= 1) {
    return;
  }
  viewStack.pop();
  const current = viewStack[viewStack.length - 1];
  current();
}

function renderTextPage(title, content) {
  clearBody();
  const box = blessed.box({
    parent: body,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "line",
    label: ` ${title} `,
    content,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true
  });
  box.focus();
  screen.render();
}

function promptInput(label, initialValue = "") {
  return new Promise((resolve) => {
    const prompt = blessed.prompt({
      parent: screen,
      top: "center",
      left: "center",
      width: "60%",
      height: 9,
      border: "line",
      label: ` ${label} `,
      keys: true,
      vi: true
    });

    prompt.input(label, initialValue, (_err, value) => {
      prompt.destroy();
      screen.render();
      resolve(value ?? "");
    });
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${bytes || 0} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }
  const totalSeconds = Math.ceil(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function extractTikTokVideoId(value) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? sanitizeName(value);
  } catch {
    return sanitizeName(value);
  }
}

function sanitizeName(value) {
  return String(value ?? "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function createProgressState(total) {
  return {
    total,
    success: 0,
    failed: 0,
    activeWorkers: new Map(),
    completedBytes: 0,
    startedAt: Date.now(),
    logLines: []
  };
}

function addLog(progress, line) {
  progress.logLines.push(line);
  if (progress.logLines.length > 200) {
    progress.logLines.shift();
  }
}

function renderDownloadLayout(summaryBox, workersBox, logBox, progress, meta) {
  const now = Date.now();
  const elapsedSeconds = Math.max((now - progress.startedAt) / 1000, 0.001);
  const activeBytes = Array.from(progress.activeWorkers.values()).reduce((sum, worker) => sum + worker.downloadedBytes, 0);
  const totalBytes = progress.completedBytes + activeBytes;
  const speed = totalBytes / elapsedSeconds;
  const remaining = progress.total - progress.success - progress.failed;
  const successPerSecond = progress.success / elapsedSeconds;
  const eta = successPerSecond > 0 ? remaining / successPerSecond : null;

  summaryBox.setContent(
    [
      `${UI.username}: ${meta.username}`,
      `${UI.outputDir}: ${meta.downloadDir ?? "-"}`,
      "",
      `${UI.total}: ${progress.total}`,
      `${UI.success}: ${progress.success}`,
      `${UI.failed}: ${progress.failed}`,
      `${UI.active}: ${progress.activeWorkers.size}`,
      `${UI.bytes}: ${formatBytes(totalBytes)}`,
      `${UI.speed}: ${formatBytes(speed)}/s`,
      `${UI.eta}: ${formatDuration(eta)}`
    ].join("\n")
  );

  const workerLines =
    progress.activeWorkers.size > 0
      ? Array.from(progress.activeWorkers.entries()).map(([workerId, info]) => {
          const workerElapsed = Math.max((now - info.startedAt) / 1000, 0.001);
          const workerSpeed = info.downloadedBytes / workerElapsed;
          return `${workerId}. ${info.videoId}\n   ${formatBytes(workerSpeed)}/s  ${info.percent ?? "--"}%`;
        })
      : [UI.idle];
  workersBox.setContent(workerLines.join("\n\n"));

  logBox.setContent(progress.logLines.join("\n"));
  logBox.setScrollPerc(100);
  screen.render();
}

async function getPythonCommand() {
  if (cachedPython?.ok) {
    return cachedPython.command;
  }
  const python = await detectPython();
  cachedPython = python;
  return python.ok ? python.command : null;
}

async function askDownloadOptions(username, defaults = {}) {
  const limit = await promptInput(UI.limit, defaults.limit ? String(defaults.limit) : "");
  const concurrency = await promptInput(UI.concurrency, String(defaults.concurrency ?? DEFAULT_CONCURRENCY));
  const retries = await promptInput(UI.retries, String(defaults.retries ?? DEFAULT_RETRIES));
  const continueRaw = await promptInput(UI.continueDownload, defaults.continueDownload ?? "true");
  return {
    username,
    limit: limit ? Number(limit) : 0,
    concurrency: Number(concurrency),
    retries: Number(retries),
    continueDownload: continueRaw
  };
}

async function showDoctor() {
  setStatus(UI.envRunning);
  const result = await doctor();
  const lines = [
    `${UI.platform}: ${result.platform}`,
    `${UI.node}: ${result.node}`,
    `${UI.appRoot}: ${result.appRoot}`,
    `${UI.requirementsPath}: ${result.requirementsPath}`,
    "",
    result.python.ok
      ? `${UI.python}: OK (${result.python.command} -> ${result.python.executable})`
      : `${UI.python}: FAIL (${result.python.error})`,
    result.ytdlp.ok
      ? `${UI.ytdlp}: OK (${result.ytdlp.version})`
      : `${UI.ytdlp}: FAIL (${result.ytdlp.error})`,
    !result.ytdlp.ok && result.python.ok
      ? `${UI.installHintPrefix}: ${result.python.command} -m pip install -r requirements.txt`
      : ""
  ].filter(Boolean);
  renderTextPage(UI.envCheck, lines.join("\n"));
  setStatus(UI.envDone);
}

async function runDownloadFlow(username, options, specificItems = null) {
  const pythonCommand = await getPythonCommand();
  if (!pythonCommand) {
    renderTextPage(UI.downloadError, UI.pythonNotFound);
    return;
  }

  let previewTotal = 0;
  if (specificItems) {
    previewTotal = specificItems.length;
  } else if (Number.isFinite(options.limit) && options.limit > 0) {
    previewTotal = options.limit;
  } else {
    try {
      const listed = await listAccountVideos(pythonCommand, username);
      previewTotal = listed.total;
    } catch {
      previewTotal = 0;
    }
  }

  clearBody();
  const summaryBox = blessed.box({
    parent: body,
    top: 0,
    left: 0,
    width: "40%",
    height: "45%",
    border: "line",
    label: ` ${UI.summary} `
  });
  const workersBox = blessed.box({
    parent: body,
    top: 0,
    left: "40%",
    width: "60%",
    height: "45%",
    border: "line",
    label: ` ${UI.workers} `,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true
  });
  const logBox = blessed.box({
    parent: body,
    top: "45%",
    left: 0,
    width: "100%",
    height: "55%",
    border: "line",
    label: ` ${UI.events} `,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true
  });
  logBox.focus();
  screen.render();

  const progress = createProgressState(previewTotal);
  const meta = { username, downloadDir: "-" };
  renderDownloadLayout(summaryBox, workersBox, logBox, progress, meta);

  const taskId = `${username}-${Date.now()}`;
  const snapshot = {
    type: "download-account",
    username,
    startedAt: new Date().toISOString(),
    options,
    mode: specificItems ? "specific-items" : "account"
  };
  await saveTaskSnapshot(taskId, snapshot);
  setStatus(`${UI.downloadStatus} ${username}`);

  const hooks = {
    onTaskStart(item, index, workerId) {
      progress.activeWorkers.set(workerId, {
        videoId: item.id,
        downloadedBytes: 0,
        percent: 0,
        startedAt: Date.now()
      });
      addLog(progress, `${UI.taskStart} ${index + 1}: ${item.id}`);
      renderDownloadLayout(summaryBox, workersBox, logBox, progress, meta);
    },
    onTaskProgress(_item, prog, _index, workerId) {
      const worker = progress.activeWorkers.get(workerId);
      if (worker) {
        worker.downloadedBytes = prog.downloadedBytes ?? worker.downloadedBytes;
        worker.percent = prog.percent ?? worker.percent;
      }
      renderDownloadLayout(summaryBox, workersBox, logBox, progress, meta);
    },
    onTaskSuccess(item, index, workerId) {
      progress.success += 1;
      progress.completedBytes += item.bytes ?? 0;
      progress.activeWorkers.delete(workerId);
      meta.downloadDir = item.filePath ? item.filePath.split("\\").slice(0, -1).join("\\") : meta.downloadDir;
      addLog(progress, `${UI.taskDone} ${index + 1}: ${item.id}`);
      renderDownloadLayout(summaryBox, workersBox, logBox, progress, meta);
    },
    onTaskFailure(item, index, workerId) {
      progress.failed += 1;
      progress.activeWorkers.delete(workerId);
      addLog(progress, `${UI.taskFail} ${index + 1}: ${item.id} ${item.error}`);
      renderDownloadLayout(summaryBox, workersBox, logBox, progress, meta);
    }
  };

  const result = specificItems
    ? await downloadSpecificVideos(pythonCommand, username, specificItems, options, hooks)
    : await downloadAccountVideos(pythonCommand, username, options, hooks);

  progress.total = result.requestedDownloads;
  progress.success = result.downloads.length;
  progress.failed = result.failures.length;
  progress.completedBytes = result.downloads.reduce((sum, item) => sum + (item.bytes ?? 0), 0);
  progress.activeWorkers.clear();
  meta.downloadDir = result.downloadDir;

  addLog(progress, "");
  addLog(progress, `${UI.outputDir}: ${result.downloadDir}`);
  addLog(progress, `${UI.generatedManifest}: ${result.manifestPath}`);
  addLog(progress, `${UI.downloads}: ${result.downloads.length}`);
  addLog(progress, `${UI.failed}: ${result.failures.length}`);
  if (result.failures.length > 0) {
    addLog(progress, `${UI.failureLog}: ${result.failureLogPath}`);
  }
  renderDownloadLayout(summaryBox, workersBox, logBox, progress, meta);

  logBox.on("keypress", (_ch, key) => {
    if (key.name === "o") {
      openPath(result.downloadDir);
    } else if (key.name === "f" && result.failures.length > 0) {
      renderTextPage(UI.failures, JSON.stringify(result.failures, null, 2));
    }
  });

  await saveTaskSnapshot(taskId, {
    ...snapshot,
    finishedAt: new Date().toISOString(),
    result: {
      source: result.source,
      total: result.total,
      requestedDownloads: result.requestedDownloads,
      concurrencyUsed: result.concurrencyUsed,
      retriesUsed: result.retriesUsed,
      continueUsed: result.continueUsed,
      downloadDir: result.downloadDir,
      manifestPath: result.manifestPath,
      failureLogPath: result.failureLogPath,
      downloads: result.downloads.length,
      failures: result.failures.length
    }
  });

  setStatus(`${UI.downloadFinished} ${username} | o: ${UI.openDirHint}  f: ${UI.showFailuresHint}`);
}

async function showManifestPage(username) {
  const pythonCommand = await getPythonCommand();
  if (!pythonCommand) {
    renderTextPage(UI.manifestError, UI.pythonNotFound);
    return;
  }

  setStatus(`${UI.manifestLoading} ${username}`);
  const result = await listAccountVideos(pythonCommand, username);
  clearBody();

  const list = blessed.list({
    parent: body,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "line",
    label: ` ${UI.manifestTitle} ${username} `,
    keys: true,
    mouse: true,
    vi: true,
    style: {
      selected: {
        bg: "green",
        fg: "black"
      }
    },
    items: result.items.slice(0, 50).map((item, index) => `${index + 1}. ${item.id}  ${item.title}`)
  });

  list.focus();
  list.on("keypress", async (_ch, key) => {
    if (key.name === "d") {
      const options = await askDownloadOptions(username);
      await runDownloadFlow(username, options);
    } else if (key.name === "s") {
      const selected = result.items[list.selected];
      if (selected) {
        const options = await askDownloadOptions(username, { limit: 1 });
        await runDownloadFlow(username, { ...options, limit: 1 }, [selected]);
      }
    }
  });

  screen.render();
  setStatus(UI.manifestHint);
}

async function promptManifest() {
  const username = await promptInput(UI.username, "gazelleelseenya");
  if (!username) {
    return;
  }
  replaceView(() => showManifestPage(username));
}

async function showTaskActions() {
  const tasks = await listTaskSnapshots();
  clearBody();

  const list = blessed.list({
    parent: body,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "line",
    label: ` ${UI.snapshotsTitle} `,
    keys: true,
    mouse: true,
    vi: true,
    style: {
      selected: {
        bg: "green",
        fg: "black"
      }
    },
    items: tasks.length === 0
      ? [UI.noSnapshots]
      : tasks.map((task, index) => `${index + 1}. ${task.type} ${task.username ?? ""} updated=${task.updatedAt}`)
  });

  list.focus();
  list.on("keypress", async (_ch, key) => {
    if (tasks.length === 0) {
      return;
    }

    const selected = tasks[list.selected];
    if (!selected?.username) {
      return;
    }

    if (key.name === "r") {
      await runDownloadFlow(selected.username, selected.options ?? {});
    } else if (key.name === "f") {
      const failureLogPath = selected?.result?.failureLogPath;
      if (failureLogPath) {
        const entries = await readFailureLog(failureLogPath);
        const items = entries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          url: entry.url
        }));
        if (items.length > 0) {
          await runDownloadFlow(selected.username, { ...(selected.options ?? {}), limit: items.length }, items);
        }
      }
    } else if (key.name === "d") {
      if (selected?.result?.downloadDir) {
        openPath(selected.result.downloadDir);
      }
    } else if (key.name === "o") {
      renderTextPage(UI.taskSnapshot, JSON.stringify(selected, null, 2));
    } else if (key.name === "m") {
      if (selected?.result?.manifestPath) {
        renderTextPage(UI.manifestPath, selected.result.manifestPath);
      }
    }
  });

  screen.render();
  setStatus(UI.snapshotsHint);
}

async function showFailureLogs() {
  setStatus(UI.failureLogsHint);
  const logs = await listFailureLogs();
  clearBody();

  const list = blessed.list({
    parent: body,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "line",
    label: ` ${UI.failureLogsTitle} `,
    keys: true,
    mouse: true,
    vi: true,
    style: {
      selected: {
        bg: "green",
        fg: "black"
      }
    },
    items: logs.length === 0
      ? [UI.noFailureLogs]
      : logs.map((item, index) => `${index + 1}. ${item.filePath} size=${item.size}`)
  });

  list.focus();
  list.on("keypress", async (_ch, key) => {
    if (logs.length === 0) {
      return;
    }

    const selected = logs[list.selected];
    if (key.name === "enter" || key.name === "o") {
      const entries = await readFailureLog(selected.filePath);
      renderTextPage(UI.failureLogContent, JSON.stringify(entries, null, 2));
    }
  });

  screen.render();
  setStatus(UI.failureLogsHint);
}

async function startLocalService() {
  if (serverProcess && !serverProcess.killed) {
    renderTextPage(UI.serviceTitle, `${UI.serviceAlreadyRunning}\n\n[s] \u505c\u6b62\u670d\u52a1`);
    return;
  }

  const child = spawn("node", ["src/server.js"], {
    cwd: "C:\\Users\\admin\\source\\js-reverse-tiktok-api",
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  serverProcess = child;
  await new Promise((resolve) => setTimeout(resolve, 1500));
  renderTextPage(UI.serviceTitle, `${UI.serviceStdout}:\n${stdout || "(none)"}\n\n${UI.serviceStderr}:\n${stderr || "(none)"}`);
  setStatus(UI.serviceStartAttempted);
}

async function runSingleVideoFlow() {
  const videoUrl = await promptInput(UI.singleVideoUrl, "https://www.tiktok.com/@gazelleelseenya/video/7642383741221948692");
  if (!videoUrl) {
    return;
  }

  const username = await promptInput(UI.username, "single-video");
  const title = await promptInput(UI.singleVideoName, "");
  const options = await askDownloadOptions(username || "single-video", { limit: 1, concurrency: 1 });
  const selected = {
    id: extractTikTokVideoId(videoUrl),
    title: title || extractTikTokVideoId(videoUrl),
    url: videoUrl
  };
  await runDownloadFlow(username || "single-video", { ...options, limit: 1 }, [selected]);
}

function showMainMenu() {
  clearBody();
  const menu = blessed.list({
    parent: body,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "line",
    label: ` ${UI.mainMenu} `,
    keys: true,
    mouse: true,
    vi: true,
    style: {
      selected: {
        bg: "green",
        fg: "black"
      }
    },
    items: [
      UI.menuDownloadAccount,
      UI.menuManifest,
      UI.menuSingleVideo,
      UI.menuSnapshots,
      UI.menuFailures,
      UI.menuDoctor,
      UI.menuService,
      UI.menuExit
    ]
  });

  menu.focus();
  menu.on("select", async (_item, index) => {
    if (index === 0) {
      const username = await promptInput(UI.username, "gazelleelseenya");
      if (username) {
        const options = await askDownloadOptions(username);
        await runDownloadFlow(username, options);
      }
    } else if (index === 1) {
      await promptManifest();
    } else if (index === 2) {
      await runSingleVideoFlow();
    } else if (index === 3) {
      await showTaskActions();
    } else if (index === 4) {
      await showFailureLogs();
    } else if (index === 5) {
      await showDoctor();
    } else if (index === 6) {
      await startLocalService();
    } else if (index === 7) {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill();
      }
      screen.destroy();
      process.exit(0);
    }
  });

  screen.render();
}

screen.key(["q", "C-c"], () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  screen.destroy();
  process.exit(0);
});

screen.key(["escape"], () => {
  popView();
});

pushView(showMainMenu);
