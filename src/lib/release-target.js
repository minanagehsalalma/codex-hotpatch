import { normalizeVersionTag } from "./upstream-versions.js";

export function resolveExplicitReleaseTarget(value, { releaseTag = null } = {}) {
  const raw = `${value ?? ""}`.trim();
  if (!raw) {
    throw new Error("explicit upstream target is required");
  }

  const codexVersion = normalizeVersionTag(raw);
  let codexRef = raw;
  if (!/^rust-v/i.test(codexRef) && !/^v/i.test(codexRef)) {
    codexRef = `rust-v${codexRef}`;
  }

  return {
    codexRef,
    codexVersion,
    releaseTag: releaseTag?.trim() ? releaseTag.trim() : `multiaccount-patcher-${codexVersion}`,
    issueTitle: buildFailureIssueTitle(codexVersion),
  };
}

export function buildFailureIssueTitle(version) {
  return `Support upstream Codex ${normalizeVersionTag(version)}`;
}
