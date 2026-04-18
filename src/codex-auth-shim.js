#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runAuthCli } from "./lib/auth-cli.js";
import { commandPin } from "./lib/commands.js";

async function main() {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const context = {
    cwd: process.cwd(),
    homeDir: os.homedir(),
    platform: process.platform,
    arch: process.arch,
    projectRoot,
    execPath: process.execPath,
  };
  if (process.argv[2] === "pin") {
    await commandPin(context, process.argv.slice(3));
    return;
  }
  await runAuthCli(context, process.argv.slice(2));
}

main().catch((error) => {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
});
