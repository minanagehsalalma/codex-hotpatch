Bundled from the locally validated `C:\Users\ASUS\codex-auth-upstream` build and launcher metadata.

Snapshot contents intentionally include only the code needed at runtime:

- root launcher `bin/codex-auth.js`
- root `package.json` and `LICENSE`
- Windows x64 platform package metadata
- `codex-auth.exe`
- `codex-auth-auto.exe`
- Windows scheduled-task handoff fix for stale helper shutdown during reinstall/disable

Excluded on purpose:

- live auth/account data
- backup `.bak-*` binaries
- user-specific registry or snapshot files

This snapshot is preferred on Windows when the patcher needs its machine-verified fallback auth path instead of a separate install.
