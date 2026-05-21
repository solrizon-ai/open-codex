#!/bin/zsh
cd "$(dirname "$0")"
echo "==> $(pwd)"
exec pnpm dev
