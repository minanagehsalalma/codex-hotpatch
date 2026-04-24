import test from "node:test";
import assert from "node:assert/strict";

import {
  npmCommand,
  parsePackJson,
  publishedInstallSpec,
  stopBlockingWindowsAuthProcesses,
} from "../src/lib/toolkit-install.js";

test("publishedInstallSpec points at the GitHub repo", () => {
  assert.equal(publishedInstallSpec(), "github:minanagehsalalma/codex-multiaccount-patcher");
});

test("npmCommand uses npm.cmd on Windows", () => {
  assert.equal(npmCommand("win32"), "npm.cmd");
  assert.equal(npmCommand("linux"), "npm");
});

test("parsePackJson returns the tarball filename", () => {
  const stdout = JSON.stringify([{ filename: "codex-multiaccount-patcher-0.1.0.tgz" }]);
  assert.equal(parsePackJson(stdout), "codex-multiaccount-patcher-0.1.0.tgz");
});

test("parsePackJson rejects malformed output", () => {
  assert.throws(() => parsePackJson("{}"), /tarball filename/);
});

test("stopBlockingWindowsAuthProcesses is a no-op outside Windows contexts", async () => {
  assert.deepEqual(await stopBlockingWindowsAuthProcesses({ platform: "linux" }), {
    skipped: true,
    stopped: [],
  });
});
