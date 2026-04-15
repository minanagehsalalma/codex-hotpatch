import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";

const scriptPath = path.resolve("scripts", "validate-release-manifest.mjs");

async function writeManifest(contents) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-multiaccount-manifest-"));
  const manifestPath = path.join(dir, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(contents, null, 2)}\n`, "utf8");
  return manifestPath;
}

test("validate-release-manifest accepts matching repo and tag URLs", async () => {
  const manifestPath = await writeManifest({
    schemaVersion: 1,
    records: [
      {
        id: "win",
        overlayFilename: "codex.exe",
        overlayUrl: "https://github.com/example/repo/releases/download/release-1/codex.exe",
      },
    ],
  });

  const result = spawnSync(process.execPath, [scriptPath, "--manifest", manifestPath, "--repo", "example/repo", "--tag", "release-1"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("validate-release-manifest rejects stale repo URLs", async () => {
  const manifestPath = await writeManifest({
    schemaVersion: 1,
    records: [
      {
        id: "win",
        overlayFilename: "codex.exe",
        overlayUrl: "https://github.com/example/old-repo/releases/download/release-1/codex.exe",
      },
    ],
  });

  const result = spawnSync(process.execPath, [scriptPath, "--manifest", manifestPath, "--repo", "example/repo", "--tag", "release-1"], {
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unexpected overlayUrl/);
});
