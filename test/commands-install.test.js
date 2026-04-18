import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { commandInstall } from "../src/lib/commands.js";
import { appDirs } from "../src/lib/constants.js";
import { createLocalManifestRecord, findManifestRecord, loadManifest } from "../src/lib/manifest.js";
import { loadState } from "../src/lib/state.js";
import { sha256File, writeJson } from "../src/lib/util.js";

test("local overlay installs stay local-only and keep a matching local manifest record", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-multiaccount-install-"));
  try {
    const upstreamPath = path.join(tempRoot, "upstream-codex");
    const overlayPath = path.join(tempRoot, "overlay-codex");
    await fs.writeFile(upstreamPath, "upstream-binary", { mode: 0o755 });
    await fs.writeFile(overlayPath, "patched-binary", { mode: 0o755 });

    const context = {
      cwd: tempRoot,
      homeDir: tempRoot,
      platform: "linux",
      arch: "x64",
      projectRoot: tempRoot,
      execPath: process.execPath,
    };

    await commandInstall(context, {
      path: upstreamPath,
      overlayPath,
    });

    const dirs = appDirs(tempRoot);
    const state = await loadState(dirs.statePath);
    assert.equal(state.manifestSource, null);
    const manifest = await loadManifest(dirs.manifestPath);
    assert.ok(findManifestRecord(manifest, state.lastKnownUpstreamSha256, context.platform, context.arch));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("manifest-backed installs keep their manifest source", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-multiaccount-manifest-"));
  try {
    const upstreamPath = path.join(tempRoot, "upstream-codex");
    const overlayPath = path.join(tempRoot, "overlay-codex");
    const manifestPath = path.join(tempRoot, "manifest.json");
    await fs.writeFile(upstreamPath, "upstream-binary", { mode: 0o755 });
    await fs.writeFile(overlayPath, "patched-binary", { mode: 0o755 });

    const context = {
      cwd: tempRoot,
      homeDir: tempRoot,
      platform: "linux",
      arch: "x64",
      projectRoot: tempRoot,
      execPath: process.execPath,
    };

    const upstreamSha256 = await sha256File(upstreamPath);
    const overlaySha256 = await sha256File(overlayPath);
    const record = createLocalManifestRecord({
      codexVersion: "0.118.0",
      platform: context.platform,
      arch: context.arch,
      upstreamBinaryPath: upstreamPath,
      upstreamSha256,
      overlaySourcePath: overlayPath,
      overlaySourceSha256: overlaySha256,
      managedOverlayPath: null,
    });
    await writeJson(manifestPath, {
      schemaVersion: 1,
      records: [record],
    });

    await commandInstall(context, {
      path: upstreamPath,
      manifest: manifestPath,
    });

    const dirs = appDirs(tempRoot);
    const state = await loadState(dirs.statePath);
    assert.equal(state.manifestSource, manifestPath);
    const manifest = await loadManifest(dirs.manifestPath);
    assert.ok(findManifestRecord(manifest, state.lastKnownUpstreamSha256, context.platform, context.arch));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
