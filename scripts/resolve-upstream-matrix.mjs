#!/usr/bin/env node
import { promises as fs } from "node:fs";

import { buildUpstreamTargetMatrix } from "../src/lib/upstream-source.js";

function usage() {
  process.stdout.write(`resolve-upstream-matrix

Required:
  --source <npm|github-release>

Optional:
  --release-json <path>   JSON file emitted by detect-upstream-release
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
    if (!value || value.startsWith("--")) {
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
  if (!options.source) {
    throw new Error("--source is required");
  }

  let releaseAssets = [];
  if (options.releaseJson) {
    const payload = JSON.parse(await fs.readFile(options.releaseJson, "utf8"));
    releaseAssets = payload.assets ?? [];
  }

  const include = buildUpstreamTargetMatrix(options.source, {
    releaseAssets,
  });
  process.stdout.write(`${JSON.stringify({ include })}\n`);
}

main().catch((error) => {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
});
