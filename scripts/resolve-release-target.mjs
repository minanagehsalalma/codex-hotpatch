#!/usr/bin/env node
import process from "node:process";

import { resolveExplicitReleaseTarget } from "../src/lib/release-target.js";

function usage() {
  process.stdout.write(`resolve-release-target

Required:
  --version <version-or-tag>

Optional:
  --release-tag <tag>     Override the default multiaccount patch release tag
  --field <name>          One of codexRef, codexVersion, releaseTag, or issueTitle
\n`);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected positional argument: ${arg}`);
    }
    const value = argv[i + 1];
    if (value === undefined || (value.startsWith("--") && value.length > 0)) {
      throw new Error(`missing value for ${arg}`);
    }
    options[arg.slice(2).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = value;
    i += 1;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  if (!options.version) {
    throw new Error("--version is required");
  }

  const target = resolveExplicitReleaseTarget(options.version, {
    releaseTag: options.releaseTag ?? null,
  });

  if (options.field) {
    const value = target[options.field];
    if (typeof value !== "string") {
      throw new Error(`unsupported field: ${options.field}`);
    }
    process.stdout.write(`${value}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(target)}\n`);
}

main().catch((error) => {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
});
