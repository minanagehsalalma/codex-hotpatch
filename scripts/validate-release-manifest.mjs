#!/usr/bin/env node
import { promises as fs } from "node:fs";

function usage() {
  process.stdout.write(`validate-release-manifest

Required:
  --manifest <path>
  --repo <owner/repo>
  --tag <release-tag>
`);
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

  for (const key of ["manifest", "repo", "tag"]) {
    if (!options[key]) {
      throw new Error(`missing required option --${key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}`);
    }
  }

  const raw = await fs.readFile(options.manifest, "utf8");
  const manifest = JSON.parse(raw);
  const records = Array.isArray(manifest.records) ? manifest.records : [];
  const expectedPrefix = `https://github.com/${options.repo}/releases/download/${options.tag}/`;

  if (records.length === 0) {
    throw new Error("manifest has no records");
  }

  for (const record of records) {
    if (!record.overlayFilename) {
      throw new Error(`record ${record.id ?? "<unknown>"} missing overlayFilename`);
    }
    if (!record.overlayUrl) {
      throw new Error(`record ${record.id ?? "<unknown>"} missing overlayUrl`);
    }
    if (!record.overlayUrl.startsWith(expectedPrefix)) {
      throw new Error(`record ${record.id ?? "<unknown>"} has unexpected overlayUrl: ${record.overlayUrl}`);
    }
    if (!record.overlayUrl.endsWith(record.overlayFilename)) {
      throw new Error(`record ${record.id ?? "<unknown>"} overlayUrl does not end with overlayFilename`);
    }
  }

  process.stdout.write(`${options.manifest}\n`);
}

main().catch((error) => {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
});
