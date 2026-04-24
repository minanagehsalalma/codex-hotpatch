import test from "node:test";
import assert from "node:assert/strict";

import { selectLatestSupportedRecord, shouldPreferStoredUpstream } from "../src/lib/runtime-upgrade.js";

test("selectLatestSupportedRecord chooses the newest semver record for the current platform", () => {
  const manifest = {
    schemaVersion: 1,
    records: [
      {
        id: "linux-newer",
        codexVersion: "0.124.0",
        platform: "linux",
        arch: "x64",
        upstreamSha256: "newer",
        overlayUrl: "https://example.test/newer",
      },
      {
        id: "windows-newest",
        codexVersion: "0.125.0",
        platform: "win32",
        arch: "x64",
        upstreamSha256: "windows",
        overlayUrl: "https://example.test/windows",
      },
      {
        id: "linux-older",
        codexVersion: "0.123.0",
        platform: "linux",
        arch: "x64",
        upstreamSha256: "older",
        overlayUrl: "https://example.test/older",
      },
    ],
  };

  assert.equal(selectLatestSupportedRecord(manifest, "linux", "x64")?.id, "linux-newer");
});

test("selectLatestSupportedRecord returns null when no platform record is available", () => {
  const manifest = {
    schemaVersion: 1,
    records: [
      {
        id: "windows-only",
        codexVersion: "0.125.0",
        platform: "win32",
        arch: "x64",
        upstreamSha256: "windows",
        overlayUrl: "https://example.test/windows",
      },
    ],
  };

  assert.equal(selectLatestSupportedRecord(manifest, "linux", "x64"), null);
});

test("shouldPreferStoredUpstream keeps explicit and managed upstream paths sticky", () => {
  assert.equal(shouldPreferStoredUpstream({ upstream: { discoveryMethod: "explicit" } }), true);
  assert.equal(shouldPreferStoredUpstream({ upstream: { discoveryMethod: "managed-download" } }), true);
  assert.equal(shouldPreferStoredUpstream({ upstream: { discoveryMethod: "npm-global" } }), false);
  assert.equal(shouldPreferStoredUpstream({ upstream: {} }), false);
});
