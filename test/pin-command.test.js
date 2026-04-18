import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { commandPin } from "../src/lib/commands.js";

async function createFakeBundledAuth({ autoSwitch = "ON" } = {}) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-multiaccount-pin-"));
  const binDir = path.join(tempRoot, "node_modules", "@loongphy", "codex-auth", "bin");
  await fs.mkdir(binDir, { recursive: true });

  const captureFile = path.join(tempRoot, "capture.jsonl");
  const stateFile = path.join(tempRoot, "auto-switch.txt");
  await fs.writeFile(stateFile, autoSwitch, "utf8");

  const entrypoint = path.join(binDir, "codex-auth.js");
  await fs.writeFile(
    entrypoint,
    `
const fs = require("node:fs");
const args = process.argv.slice(2);
const captureFile = ${JSON.stringify(captureFile)};
const stateFile = ${JSON.stringify(stateFile)};
const append = (record) => fs.appendFileSync(captureFile, JSON.stringify(record) + "\\n");
const readState = () => fs.readFileSync(stateFile, "utf8").trim();
const writeState = (value) => fs.writeFileSync(stateFile, value, "utf8");

append({ args });

if (args[0] === "status") {
  process.stdout.write("auto-switch: " + readState() + "\\n");
  process.exit(0);
}

if (args[0] === "config" && args[1] === "auto" && args[2] === "disable") {
  writeState("OFF");
  process.exit(0);
}

if (args[0] === "switch") {
  process.stdout.write("switched:" + (args[1] ?? "") + "\\n");
  process.exit(0);
}

process.exit(0);
`,
    "utf8",
  );

  const context = {
    cwd: tempRoot,
    homeDir: tempRoot,
    platform: "linux",
    arch: process.arch,
    projectRoot: tempRoot,
    execPath: process.execPath,
    preferBundledAuth: true,
  };

  return { tempRoot, captureFile, stateFile, context };
}

function captureStdout(run) {
  let stdout = "";
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk, encoding, callback) => {
    stdout += chunk instanceof Uint8Array ? Buffer.from(chunk).toString("utf8") : String(chunk);
    if (typeof encoding === "function") {
      encoding();
    } else if (typeof callback === "function") {
      callback();
    }
    return true;
  });
  return Promise.resolve()
    .then(run)
    .then(
      (value) => {
        process.stdout.write = originalWrite;
        return { value, stdout };
      },
      (error) => {
        process.stdout.write = originalWrite;
        throw error;
      },
    );
}

async function readCapture(file) {
  const raw = await fs.readFile(file, "utf8");
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("commandPin disables auto-switch before switching accounts", async () => {
  const fixture = await createFakeBundledAuth({ autoSwitch: "ON" });
  try {
    const { stdout } = await captureStdout(() => commandPin(fixture.context, ["work"]));
    const capture = await readCapture(fixture.captureFile);

    assert.deepEqual(
      capture.map((entry) => entry.args),
      [["status"], ["config", "auto", "disable"], ["switch", "work"]],
    );
    assert.match(stdout, /pin: auto-switch disabled/);
    assert.match(stdout, /pin: active account is now pinned/);
    assert.equal((await fs.readFile(fixture.stateFile, "utf8")).trim(), "OFF");
  } finally {
    await fs.rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("commandPin skips disable step when auto-switch is already off", async () => {
  const fixture = await createFakeBundledAuth({ autoSwitch: "OFF" });
  try {
    const { stdout } = await captureStdout(() => commandPin(fixture.context, ["personal"]));
    const capture = await readCapture(fixture.captureFile);

    assert.deepEqual(
      capture.map((entry) => entry.args),
      [["status"], ["switch", "personal"]],
    );
    assert.match(stdout, /pin: auto-switch already disabled/);
    assert.match(stdout, /pin: active account is now pinned/);
    assert.equal((await fs.readFile(fixture.stateFile, "utf8")).trim(), "OFF");
  } finally {
    await fs.rm(fixture.tempRoot, { recursive: true, force: true });
  }
});
