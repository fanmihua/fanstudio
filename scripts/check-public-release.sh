#!/usr/bin/env bash
set -euo pipefail

failed=0

deny_path='^(content/private/|private-content/|private-files/|cert/|outputs?/|public/uploads/|ops/server-|settings-backup-|deploy\.sh$|\.env$)'
if git ls-files | grep -E "$deny_path"; then
  echo "[release:check] 发现禁止公开的路径"
  failed=1
fi

secret_pattern='BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}'
if git grep -IlE "$secret_pattern" -- . ':!package-lock.json'; then
  echo "[release:check] 发现疑似密钥文件"
  failed=1
fi

local_path_pattern='/Users/[^/]+/|[A-Za-z]:\\Users\\'
if git grep -IlE "$local_path_pattern" -- . ':!package-lock.json' ':!scripts/check-public-release.sh'; then
  echo "[release:check] 发现本机用户绝对路径"
  failed=1
fi

if [ ! -f .env.example ]; then
  echo "[release:check] 缺少 .env.example"
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "[release:check] 通过：未发现禁止公开的路径、本机绝对路径或高置信密钥"
