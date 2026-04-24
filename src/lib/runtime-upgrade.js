import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { compareVersions, normalizeVersionTag } from "./upstream-versions.js";
import {
  codexExecutableName,
  ensureDir,
  pathExists,
  platformLabel,
  runCommand,
  sha256File,
} from "./util.js";

const UPSTREAM_TARGETS = {
  "linux-x64": {
    packageVersionSuffix: "linux-x64",
    vendorTriple: "x86_64-unknown-linux-musl",
  },
  "win32-x64": {
    packageVersionSuffix: "win32-x64",
    vendorTriple: "x86_64-pc-windows-msvc",
  },
};

const STICKY_DISCOVERY_METHODS = new Set(["explicit", "managed-download"]);

export function selectLatestSupportedRecord(manifest, platform, arch) {
  const candidates = (manifest?.records ?? [])
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.platform === platform && record.arch === arch);
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const leftVersion = left.record.codexVersion ?? "";
    const rightVersion = right.record.codexVersion ?? "";
    const compared = compareRecordVersions(rightVersion, leftVersion);
    return compared || left.index - right.index;
  });
  return candidates[0].record;
}

export function shouldPreferStoredUpstream(state) {
  return STICKY_DISCOVERY_METHODS.has(state?.upstream?.discoveryMethod);
}

export async function discoverStoredUpstream(context, state) {
  if (!shouldPreferStoredUpstream(state) || !state?.upstream?.vendorBinaryPath) {
    return null;
  }
  if (!(await pathExists(state.upstream.vendorBinaryPath))) {
    return null;
  }
  const upstream = {
    ...state.upstream,
    discoveryMethod: state.upstream.discoveryMethod,
    version: state.upstream.version ?? null,
    packageRoot: state.upstream.packageRoot ?? null,
    vendorPackageRoot: state.upstream.vendorPackageRoot ?? path.dirname(path.dirname(state.upstream.vendorBinaryPath)),
    vendorTriple: state.upstream.vendorTriple ?? null,
    vendorBinaryPath: state.upstream.vendorBinaryPath,
    pathDir: state.upstream.pathDir ?? null,
    shimsDir: state.upstream.shimsDir ?? null,
  };
  if (upstream.pathDir && !(await pathExists(upstream.pathDir))) {
    upstream.pathDir = null;
  }
  return upstream;
}

export async function ensureManagedUpstreamForRecord(context, dirs, record, options = {}) {
  const target = resolveUpstreamTarget(context);
  const installRoot = resolveManagedUpstreamRoot(context, dirs, record);
  const upstream = await buildManagedUpstream(context, installRoot, record, target);
  const existingHash = (await pathExists(upstream.vendorBinaryPath))
    ? await sha256File(upstream.vendorBinaryPath)
    : null;
  if (existingHash === record.upstreamSha256) {
    return upstream;
  }

  await ensureDir(dirs.upstreamsDir);
  const tempRoot = await fs.mkdtemp(path.join(dirs.upstreamsDir, ".tmp-"));
  try {
    const fetchVendorPackage = options.fetchVendorPackage ?? fetchNpmVendorPackage;
    await fetchVendorPackage({
      context,
      record,
      target,
      destinationRoot: tempRoot,
    });
    const tempUpstream = await buildManagedUpstream(context, tempRoot, record, target);
    const actualSha256 = await sha256File(tempUpstream.vendorBinaryPath);
    if (actualSha256 !== record.upstreamSha256) {
      throw new Error(
        `managed upstream hash mismatch for ${record.id}. Expected ${record.upstreamSha256}, got ${actualSha256}.`,
      );
    }

    await fs.rm(installRoot, { recursive: true, force: true });
    await ensureDir(path.dirname(installRoot));
    await fs.rename(tempRoot, installRoot);
    return buildManagedUpstream(context, installRoot, record, target);
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export function resolveManagedUpstreamRoot(context, dirs, record) {
  return path.join(
    dirs.upstreamsDir,
    normalizeVersionTag(record.codexVersion ?? "unknown"),
    platformLabel(context.platform, context.arch),
  );
}

async function buildManagedUpstream(context, installRoot, record, target) {
  const vendorBinaryPath = path.join(
    installRoot,
    "vendor",
    target.vendorTriple,
    "codex",
    codexExecutableName(context.platform),
  );
  const pathDir = path.join(installRoot, "vendor", target.vendorTriple, "path");
  return {
    discoveryMethod: "managed-download",
    version: normalizeVersionTag(record.codexVersion ?? ""),
    packageRoot: installRoot,
    vendorPackageRoot: installRoot,
    vendorTriple: target.vendorTriple,
    vendorBinaryPath,
    pathDir: (await pathExists(pathDir)) ? pathDir : null,
    shimsDir: null,
  };
}

async function fetchNpmVendorPackage({ context, record, target, destinationRoot }) {
  const version = normalizeVersionTag(record.codexVersion);
  const packageVersion = `${version}-${target.packageVersionSuffix}`;
  const metadataUrl = `https://registry.npmjs.org/@openai%2Fcodex/${encodeURIComponent(packageVersion)}`;
  const metadata = await fetchJson(metadataUrl, `npm metadata for @openai/codex@${packageVersion}`);
  const tarballUrl = metadata?.dist?.tarball;
  if (!tarballUrl) {
    throw new Error(`npm metadata for @openai/codex@${packageVersion} does not include a tarball URL`);
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-multiaccount-upstream-"));
  try {
    const tarballPath = path.join(tempRoot, "package.tgz");
    await downloadFile(tarballUrl, tarballPath);

    const extractDir = path.join(tempRoot, "extract");
    await ensureDir(extractDir);
    const extract = await runCommand(resolveTarCommand(), ["-xf", tarballPath, "-C", extractDir]);
    if (extract.code !== 0) {
      throw new Error(`failed to extract upstream package: ${extract.stderr || extract.stdout}`.trim());
    }

    const packageRoot = path.join(extractDir, "package");
    await fs.cp(packageRoot, destinationRoot, { recursive: true, force: true });
    await fs.chmod(
      path.join(destinationRoot, "vendor", target.vendorTriple, "codex", codexExecutableName(context.platform)),
      0o755,
    ).catch(() => {});
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function fetchJson(url, description) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "codex-multiaccount-patcher",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`failed to fetch ${description}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "codex-multiaccount-patcher",
      Accept: "application/octet-stream",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`failed to download upstream package: ${response.status} ${response.statusText}`);
  }
  await ensureDir(path.dirname(destinationPath));
  await fs.writeFile(destinationPath, Buffer.from(await response.arrayBuffer()));
}

function resolveUpstreamTarget(context) {
  const target = UPSTREAM_TARGETS[platformLabel(context.platform, context.arch)];
  if (!target) {
    throw new Error(`unsupported upstream runtime target ${context.platform}-${context.arch}`);
  }
  return target;
}

function resolveTarCommand() {
  if (process.platform !== "win32") {
    return "tar";
  }
  return path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
}

function compareRecordVersions(left, right) {
  try {
    return compareVersions(left, right);
  } catch {
    const leftStable = isSemverLike(left);
    const rightStable = isSemverLike(right);
    if (leftStable && !rightStable) {
      return 1;
    }
    if (!leftStable && rightStable) {
      return -1;
    }
    return 0;
  }
}

function isSemverLike(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalizeVersionTag(`${value ?? ""}`));
}
