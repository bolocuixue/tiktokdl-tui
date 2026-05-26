#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { doctor } from "./runtime.js";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`TikTokDL TUI ${packageJson.version}

Usage:
  tiktokdl-tui
  tiktokdl-tui --help
  tiktokdl-tui --version
  tiktokdl-tui --doctor`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(packageJson.version);
  process.exit(0);
}

if (args.includes("--doctor")) {
  const result = await doctor();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

await import("./index.js");
