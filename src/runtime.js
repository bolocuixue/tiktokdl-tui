import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { APP_ROOT } from "./config.js";

const execFileAsync = promisify(execFile);

async function tryExec(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 8
    });
    return {
      ok: true,
      command,
      stdout: stdout.trim()
    };
  } catch (error) {
    return {
      ok: false,
      command,
      error: error.message
    };
  }
}

export async function detectPython() {
  const candidates =
    process.platform === "win32"
      ? [
          ["py", ["-3", "-c", "import sys; print(sys.executable)"]],
          ["python", ["-c", "import sys; print(sys.executable)"]],
          ["python3", ["-c", "import sys; print(sys.executable)"]]
        ]
      : [
          ["python3", ["-c", "import sys; print(sys.executable)"]],
          ["python", ["-c", "import sys; print(sys.executable)"]]
        ];

  for (const [command, args] of candidates) {
    const result = await tryExec(command, args);
    if (result.ok) {
      return {
        ok: true,
        command,
        executable: result.stdout
      };
    }
  }

  return {
    ok: false,
    error: "Python not found"
  };
}

export async function detectYtDlp(pythonCommand) {
  const result = await tryExec(pythonCommand, ["-m", "yt_dlp", "--version"]);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      installHint: `${pythonCommand} -m pip install -r requirements.txt`
    };
  }

  return {
    ok: true,
    version: result.stdout
  };
}

export async function doctor() {
  const python = await detectPython();
  const ytdlp = python.ok ? await detectYtDlp(python.command) : { ok: false, error: "Python unavailable" };

  return {
    platform: `${os.platform()} ${os.release()}`,
    node: process.version,
    appRoot: APP_ROOT,
    requirementsPath: path.join(process.cwd(), "requirements.txt"),
    python,
    ytdlp
  };
}

export function openPath(targetPath) {
  if (process.platform === "win32") {
    spawn("explorer.exe", [targetPath], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  if (process.platform === "darwin") {
    spawn("open", [targetPath], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [targetPath], { detached: true, stdio: "ignore" }).unref();
}
