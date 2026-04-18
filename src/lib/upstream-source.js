import { normalizeVersionTag } from "./upstream-versions.js";

const SEMVER_LIKE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const KNOWN_TARGETS = [
  {
    os: "ubuntu-latest",
    platform: "linux",
    arch: "x64",
    artifact_suffix: "linux-x64",
    executable_name: "codex",
    github_asset_name: "codex-linux-x64",
  },
  {
    os: "windows-latest",
    platform: "win32",
    arch: "x64",
    artifact_suffix: "win32-x64",
    executable_name: "codex.exe",
    github_asset_name: "codex-win32-x64.exe",
  },
];

export function isSemverLikeTag(value) {
  return SEMVER_LIKE.test(normalizeVersionTag(`${value ?? ""}`.trim()));
}

export function resolveCodexRef(value) {
  const raw = `${value ?? ""}`.trim();
  if (!raw) {
    throw new Error("upstream ref is required");
  }
  if (!isSemverLikeTag(raw)) {
    return raw;
  }
  if (/^rust-v/i.test(raw) || /^v/i.test(raw)) {
    return raw;
  }
  return `rust-v${normalizeVersionTag(raw)}`;
}

export function sanitizeReleaseTagComponent(value) {
  const sanitized = `${value ?? ""}`
    .trim()
    .replace(/[^0-9A-Za-z._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!sanitized) {
    throw new Error("release tag component is empty after sanitization");
  }
  return sanitized;
}

export function normalizeGitHubRepo(value) {
  const repo = `${value ?? ""}`.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\/+$/, "");
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error(`invalid GitHub repo: ${value}`);
  }
  return repo;
}

export function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  switch (`${value}`.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      throw new Error(`invalid boolean flag: ${value}`);
  }
}

export function resolveGitHubReleaseAssetName(platform, arch) {
  const match = KNOWN_TARGETS.find((entry) => entry.platform === platform && entry.arch === arch);
  if (!match) {
    throw new Error(`unsupported GitHub release asset target ${platform}-${arch}`);
  }
  return match.github_asset_name;
}

export function buildUpstreamTargetMatrix(source, { releaseAssets = [] } = {}) {
  if (source === "npm") {
    return KNOWN_TARGETS.map(stripGithubAssetName);
  }
  if (source !== "github-release") {
    throw new Error(`unsupported upstream source ${source}`);
  }

  const assetNames = new Set((releaseAssets ?? []).map((entry) => (typeof entry === "string" ? entry : entry?.name)).filter(Boolean));
  const filtered = KNOWN_TARGETS.filter((entry) => assetNames.has(entry.github_asset_name)).map(stripGithubAssetName);
  if (filtered.length === 0) {
    throw new Error("no supported GitHub release assets found for known targets");
  }
  return filtered;
}

function stripGithubAssetName(entry) {
  const { github_asset_name: _githubAssetName, ...rest } = entry;
  return rest;
}
